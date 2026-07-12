#!/usr/bin/env node
/**
 * Optimize a VRM/GLB safely (no round-trip through a modeler):
 *  1. remove dead morph targets (HumGen design keys: Male / LIVE_KEY* / cor_* pose
 *     correctives — none are bound by VRM expressions or drivable in the web runtime),
 *  2. recompress embedded textures (downscale + JPEG for color, PNG for normals/alpha),
 *  3. prune now-orphaned accessors + bufferViews, reindex all references, repack the
 *     buffer 4-byte aligned.
 * Geometry that the face/visemes need, skinning, and every VRM extension (VRMC_vrm,
 * MToon, node_constraint) are preserved byte-for-byte in their JSON; only removed
 * morph deltas + old texture bytes leave.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [src, out] = process.argv.slice(2)
const buf = readFileSync(src)
const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
const bin = buf.slice(20 + jsonLen + 8)

const DEAD = (n) => n === 'Male' || n === 'LIVE_KEY_PERMANENT' || n === 'LIVE_KEY_TEMP_' || n.startsWith('cor_')

// ---- 1. remove dead morph targets, recording per-mesh old→new morph index maps ----
let removedTargets = 0
const morphMap = new Map() // meshIndex -> [oldIndex]=>newIndex (or -1 if removed)
json.meshes.forEach((mesh, mi) => {
  const names = mesh.extras && mesh.extras.targetNames
  if (!names) return
  const keep = names.map((n) => !DEAD(n))
  if (keep.every(Boolean)) return
  removedTargets += keep.filter((k) => !k).length
  let next = 0
  morphMap.set(mi, keep.map((k) => (k ? next++ : -1)))
  mesh.extras.targetNames = names.filter((_, i) => keep[i])
  if (Array.isArray(mesh.weights)) mesh.weights = mesh.weights.filter((_, i) => keep[i])
  for (const prim of mesh.primitives) {
    if (prim.targets) prim.targets = prim.targets.filter((_, i) => keep[i])
  }
})

// ---- 1b. remap VRM expression morphTargetBind indices (they reference morphs by index) ----
const nodeMesh = (n) => (json.nodes[n] ? json.nodes[n].mesh : undefined)
let remapped = 0, droppedBinds = 0
const vrm = json.extensions && json.extensions.VRMC_vrm
if (vrm && vrm.expressions) {
  for (const grp of [vrm.expressions.preset, vrm.expressions.custom]) {
    for (const key of Object.keys(grp || {})) {
      const binds = grp[key].morphTargetBinds
      if (!binds) continue
      grp[key].morphTargetBinds = binds
        .map((mb) => {
          const map = morphMap.get(nodeMesh(mb.node))
          if (!map) return mb // that mesh wasn't pruned
          const ni = map[mb.index]
          if (ni === -1 || ni == null) { droppedBinds++; return null } // bound a removed morph — drop
          if (ni !== mb.index) remapped++
          return { ...mb, index: ni }
        })
        .filter(Boolean)
    }
  }
}
console.log(`VRM expression binds remapped: ${remapped}, dropped: ${droppedBinds}`)

// ---- 2. recompress textures (into a map keyed by ORIGINAL bufferView index) ----
const tmp = mkdtempSync(join(tmpdir(), 'aria-'))
const magick = (a) => {
  const r = spawnSync('magick', a, { encoding: 'buffer' })
  if (r.status !== 0) throw new Error('magick: ' + r.stderr)
}
function policy(name) {
  const n = (name || '').toLowerCase()
  if (/norm|normal/.test(n)) return /skin/.test(n) ? { res: 512, fmt: 'png' } : { res: 256, fmt: 'png' }
  if (/mask|alpha|eyelash|haircap|brow/.test(n)) return { res: 256, fmt: 'png' }
  if (/female 09|skin|eye_color/.test(n)) return { res: 1024, fmt: 'jpg', q: 90 }
  return { res: 512, fmt: 'jpg', q: 85 }
}
const newTexBytes = new Map() // origBufferViewIndex -> Buffer
let origTex = 0, newTex = 0
for (let i = 0; i < (json.images || []).length; i++) {
  const im = json.images[i]
  if (im.bufferView == null) continue
  const v = json.bufferViews[im.bufferView]
  const bytes = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)
  origTex += bytes.length
  const inExt = (im.mimeType || 'png').includes('jpeg') ? 'jpg' : 'png'
  const inF = join(tmp, `i${i}.${inExt}`)
  writeFileSync(inF, bytes)
  const p = policy(im.name)
  const outF = join(tmp, `o${i}.${p.fmt}`)
  const args = [inF, '-resize', `${p.res}x${p.res}>`]
  if (p.fmt === 'jpg') args.push('-quality', String(p.q), '-background', 'white', '-flatten')
  args.push(outF)
  magick(args)
  const nb = readFileSync(outF)
  newTex += nb.length
  newTexBytes.set(im.bufferView, nb)
  im.mimeType = p.fmt === 'jpg' ? 'image/jpeg' : 'image/png'
}

// ---- 3. prune orphaned accessors + bufferViews, reindex, repack ----
const usedAcc = new Set()
for (const mesh of json.meshes || []) {
  for (const prim of mesh.primitives) {
    for (const a of Object.values(prim.attributes)) usedAcc.add(a)
    if (prim.indices != null) usedAcc.add(prim.indices)
    for (const t of prim.targets || []) for (const a of Object.values(t)) usedAcc.add(a)
  }
}
for (const skin of json.skins || []) if (skin.inverseBindMatrices != null) usedAcc.add(skin.inverseBindMatrices)
for (const anim of json.animations || []) for (const s of anim.samplers) { usedAcc.add(s.input); usedAcc.add(s.output) }

const accOldToNew = new Map()
const newAccessors = []
json.accessors.forEach((acc, i) => {
  if (!usedAcc.has(i)) return
  accOldToNew.set(i, newAccessors.length)
  newAccessors.push(acc)
})

// bufferViews used by surviving accessors (+ sparse) and by images
const usedBV = new Set()
for (const acc of newAccessors) {
  if (acc.bufferView != null) usedBV.add(acc.bufferView)
  if (acc.sparse) { usedBV.add(acc.sparse.indices.bufferView); usedBV.add(acc.sparse.values.bufferView) }
}
for (const im of json.images || []) if (im.bufferView != null) usedBV.add(im.bufferView)

const bvOldToNew = new Map()
const newBVMeta = [] // {old}
json.bufferViews.forEach((v, i) => {
  if (!usedBV.has(i)) return
  bvOldToNew.set(i, newBVMeta.length)
  newBVMeta.push(i)
})

// remap accessor references
for (const acc of newAccessors) {
  if (acc.bufferView != null) acc.bufferView = bvOldToNew.get(acc.bufferView)
  if (acc.sparse) {
    acc.sparse.indices.bufferView = bvOldToNew.get(acc.sparse.indices.bufferView)
    acc.sparse.values.bufferView = bvOldToNew.get(acc.sparse.values.bufferView)
  }
}
for (const im of json.images || []) if (im.bufferView != null) im.bufferView = bvOldToNew.get(im.bufferView)
for (const mesh of json.meshes || []) {
  for (const prim of mesh.primitives) {
    for (const k of Object.keys(prim.attributes)) prim.attributes[k] = accOldToNew.get(prim.attributes[k])
    if (prim.indices != null) prim.indices = accOldToNew.get(prim.indices)
    if (prim.targets) prim.targets = prim.targets.map((t) => {
      const nt = {}; for (const k of Object.keys(t)) nt[k] = accOldToNew.get(t[k]); return nt
    })
  }
}
for (const skin of json.skins || []) if (skin.inverseBindMatrices != null) skin.inverseBindMatrices = accOldToNew.get(skin.inverseBindMatrices)
for (const anim of json.animations || []) for (const s of anim.samplers) { s.input = accOldToNew.get(s.input); s.output = accOldToNew.get(s.output) }

// repack buffer from surviving bufferViews (image bytes swapped in)
const parts = []
let cursor = 0
const newBufferViews = []
for (const oldIdx of newBVMeta) {
  const v = json.bufferViews[oldIdx]
  const bytes = newTexBytes.has(oldIdx) ? newTexBytes.get(oldIdx) : bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)
  if (cursor % 4 !== 0) { const pad = 4 - (cursor % 4); parts.push(Buffer.alloc(pad)); cursor += pad }
  const nv = { buffer: 0, byteOffset: cursor, byteLength: bytes.length }
  if (v.byteStride != null && !newTexBytes.has(oldIdx)) nv.byteStride = v.byteStride
  if (v.target != null && !newTexBytes.has(oldIdx)) nv.target = v.target
  newBufferViews.push(nv)
  parts.push(bytes); cursor += bytes.length
}
let newBin = Buffer.concat(parts)
if (newBin.length % 4 !== 0) newBin = Buffer.concat([newBin, Buffer.alloc(4 - (newBin.length % 4))])

json.accessors = newAccessors
json.bufferViews = newBufferViews
json.buffers = [{ byteLength: newBin.length }]

let newJson = Buffer.from(JSON.stringify(json), 'utf8')
if (newJson.length % 4 !== 0) newJson = Buffer.concat([newJson, Buffer.alloc(4 - (newJson.length % 4), 0x20)])
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + newJson.length + 8 + newBin.length, 8)
const jh = Buffer.alloc(8); jh.writeUInt32LE(newJson.length, 0); jh.writeUInt32LE(0x4e4f534a, 4)
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4)
writeFileSync(out, Buffer.concat([h, jh, newJson, bh, newBin]))

const sz = readFileSync(out).length
console.log(`dead morph targets removed: ${removedTargets}`)
console.log(`accessors ${json.accessors.length} (kept) ; bufferViews ${newBufferViews.length}`)
console.log(`textures ${(origTex / 1048576).toFixed(1)}MB -> ${(newTex / 1048576).toFixed(1)}MB`)
console.log(`FILE ${(buf.length / 1048576).toFixed(2)}MB -> ${(sz / 1048576).toFixed(2)} MiB  ${sz <= 25 * 1048576 ? '✓ under 25 MiB' : '✗ OVER'}`)
