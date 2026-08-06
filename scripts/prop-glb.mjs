#!/usr/bin/env node
/**
 * prop-glb.mjs — measure and repair the diorama prop GLBs in /assets/props.
 *
 *   node scripts/prop-glb.mjs                 # measure every prop
 *   node scripts/prop-glb.mjs --nodes <file>  # per-mesh-node breakdown of one prop
 *   node scripts/prop-glb.mjs --repair        # apply the source repairs below
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * docs/DIORAMA.md promises every prop arrives "floor-aligned at its own origin,
 * centered in X/Y, and scaled so its largest dimension equals the real machine's,
 * so placements in DatacenterDiorama.tsx need no per-prop correction." Three of
 * the twelve did not, and the reason is NOT a missing scale step — it is per-file
 * and needs a per-file answer. Measured with the routine below (full TRS chain,
 * eight transformed corners per accessor box):
 *
 *   ibm-1401-mainframe.glb  269 mesh nodes in TWO unrelated coordinate clusters.
 *       Nodes 0-28 (node scale 0.004) are a 0.59 x 0.93 x 1.03 m cabinet — the
 *       actual IBM 1401, already at real-world scale. Nodes 29-268 (node scale
 *       0.360) are a 184 x 44 x 160 unit structure of floor and ceiling slabs and
 *       structural ironwork ("Ferro_Meio", "Ferro_Emvolta") — the Sketchfab
 *       source's backdrop set, which DIORAMA.md's pipeline is supposed to drop
 *       and did not. That backdrop is what makes the file measure 184 m.
 *       REPAIRED HERE: the scene keeps the cabinet cluster and drops the backdrop.
 *
 *   kenbak-1.glb            79 mesh nodes. The machine body is ~36 x 28 x 14
 *       units; three PowerCord* nodes float 25 units above its top face, which is
 *       what stretches the measured box to 55 units in Y. Dropping them still
 *       leaves an asset whose aspect (2.6 : 2 : 1) does not match a real KENBAK-1
 *       (2.6 : 1 : 1.5), so there is more wrong with it than a stray node.
 *       NOT REPAIRED — see DioramaProps.ts PROP_NEEDS_REEXPORT.
 *
 *   ibm-3178-terminal.glb   3 mesh nodes: `ibm_3178` at 0.27 x 0.25 x 0.30 m
 *       (real-world scale) plus `ibm_3178_col` at 29 x 22 x 40 units and
 *       `display` at 18 x 13 x 2 units. Two scales of the same terminal in one
 *       file; which is authoritative is a question for whoever has the source.
 *       NOT REPAIRED — see DioramaProps.ts PROP_NEEDS_REEXPORT.
 *
 * ── What a repair here is and is not ─────────────────────────────────────────
 * Pruning a scene graph is a rigid, verifiable edit: the JSON chunk's scene node
 * list changes, the binary chunk is copied through byte for byte, and the result
 * is re-measured before it is written. It is NOT a re-export. It does not shrink
 * the file (the pruned meshes' buffer views stay in the BIN chunk, unreferenced),
 * relink textures, or fix pivots inside a mesh. When the source archive
 * (`llm-metahuman/scene/`, with fbx2glb.py) is available, re-export properly and
 * delete the entry from REPAIRS.
 *
 * Idempotent: a repaired file reports "already repaired" and is not rewritten.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const propsDir = join(repoRoot, 'assets', 'props')

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a

/**
 * Source repairs, keyed by file. `keepRoots` selects which of the scene's root
 * nodes survive; `expect` is the world-space size the pruned scene must measure,
 * asserted before anything is written.
 */
const REPAIRS = {
  'ibm-1401-mainframe.glb': {
    // The cabinet cluster is scene roots 0-28 (every node carrying scale 0.004);
    // 29-268 are the backdrop set at scale 0.360.
    keepRoots: (gltf, index) => (gltf.nodes[index].scale ?? [1])[0] < 0.01,
    expect: [0.59, 0.93, 1.03],
    why: 'drop the Sketchfab backdrop set, keep the 1401 cabinet'
  }
}

// ── GLB container ─────────────────────────────────────────────────────────────

function readGlb(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${file}: not a GLB`)
  const chunks = []
  let off = 12
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off)
    const type = buf.readUInt32LE(off + 4)
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) })
    off += 8 + len + ((4 - (len % 4)) % 4)
  }
  const json = chunks.find((c) => c.type === CHUNK_JSON)
  if (!json) throw new Error(`${file}: no JSON chunk`)
  return { chunks, gltf: JSON.parse(json.data.toString('utf8')) }
}

function writeGlb(file, chunks, gltf) {
  const out = chunks.map((c) =>
    c.type === CHUNK_JSON ? { type: c.type, data: Buffer.from(JSON.stringify(gltf), 'utf8') } : c
  )
  const header = Buffer.alloc(12)
  const parts = [header]
  let total = 12
  for (const c of out) {
    // glTF 2.0 §4.4.2: JSON chunks pad with spaces, BIN chunks with zeroes.
    const pad = (4 - (c.data.length % 4)) % 4
    const h = Buffer.alloc(8)
    h.writeUInt32LE(c.data.length + pad, 0)
    h.writeUInt32LE(c.type, 4)
    parts.push(h, c.data, Buffer.alloc(pad, c.type === CHUNK_JSON ? 0x20 : 0x00))
    total += 8 + c.data.length + pad
  }
  header.writeUInt32LE(GLB_MAGIC, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(total, 8)
  writeFileSync(file, Buffer.concat(parts))
}

// ── measurement ───────────────────────────────────────────────────────────────

function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice()
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale ?? [1, 1, 1]
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz
  const xx = qx * x2, xy = qx * y2, xz = qx * z2
  const yy = qy * y2, yz = qy * z2, zz = qz * z2
  const wx = qw * x2, wy = qw * y2, wz = qw * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1
  ]
}

function multiply(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  }
  return o
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/**
 * World-space bounds of the default scene.
 *
 * Transforms all eight corners of each POSITION accessor's own box through the
 * full TRS chain. The tempting shortcut — multiplying accessor min/max by the
 * node's scale only — is wrong for any rotated or translated child, and these
 * assets are nothing but rotated, translated children.
 */
export function measureGltf(gltf) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const scene = gltf.scenes?.[gltf.scene ?? 0]
  const walk = (index, parent) => {
    const node = gltf.nodes[index]
    const world = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) {
      for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
        const acc = gltf.accessors?.[prim.attributes?.POSITION]
        if (!acc?.min || !acc?.max) continue
        for (let corner = 0; corner < 8; corner++) {
          const p = [
            corner & 1 ? acc.max[0] : acc.min[0],
            corner & 2 ? acc.max[1] : acc.min[1],
            corner & 4 ? acc.max[2] : acc.min[2]
          ]
          const w = [
            world[0] * p[0] + world[4] * p[1] + world[8] * p[2] + world[12],
            world[1] * p[0] + world[5] * p[1] + world[9] * p[2] + world[13],
            world[2] * p[0] + world[6] * p[1] + world[10] * p[2] + world[14]
          ]
          for (let i = 0; i < 3; i++) {
            if (w[i] < min[i]) min[i] = w[i]
            if (w[i] > max[i]) max[i] = w[i]
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child, world)
  }
  for (const root of scene?.nodes ?? []) walk(root, IDENTITY)
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  return { min, max, size, maxDim: Math.max(...size) }
}

export function measureGlbFile(file) {
  return measureGltf(readGlb(file).gltf)
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const fmt = (b) => `${b.size.map((v) => v.toFixed(2).padStart(7)).join(' x')}   floor ${b.min[1].toFixed(3).padStart(8)}`

if (argv[0] === '--nodes') {
  const { gltf } = readGlb(join(propsDir, argv[1]))
  gltf.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return
    const acc = gltf.accessors[gltf.meshes[n.mesh].primitives[0].attributes.POSITION]
    const s = n.scale ?? [1, 1, 1]
    const t = n.translation ?? [0, 0, 0]
    const size = [0, 1, 2].map((k) => (acc.max[k] - acc.min[k]) * Math.abs(s[k]))
    console.log(
      `${String(i).padStart(4)} ${(n.name ?? '').slice(0, 28).padEnd(30)}` +
      ` size${size.map((v) => v.toFixed(2).padStart(9)).join('')}` +
      ` at${t.map((v) => v.toFixed(1).padStart(8)).join('')}`
    )
  })
  process.exit(0)
}

const repair = argv.includes('--repair')
const MARKER = 'prune+recentre v1'
let rewritten = 0

for (const [file, spec] of Object.entries(REPAIRS)) {
  const path = join(propsDir, file)
  const { chunks, gltf } = readGlb(path)
  const before = measureGltf(gltf)

  if (gltf.asset?.extras?.ciPropRepair === MARKER) {
    console.log(`  ${file.padEnd(26)} already repaired  ${fmt(before)}`)
    continue
  }

  // 1. prune: keep only the roots this asset's repair says are the machine.
  const scene = gltf.scenes[gltf.scene ?? 0]
  const rootsBefore = scene.nodes.length
  scene.nodes = scene.nodes.filter((i) => spec.keepRoots(gltf, i))
  const pruned = measureGltf(gltf)
  const off = spec.expect.map((v, i) => Math.abs(pruned.size[i] - v))
  if (Math.max(...off) > 0.01) {
    throw new Error(`${file}: pruned scene measures ${pruned.size.map((v) => v.toFixed(2)).join(' x ')}, expected ${spec.expect.join(' x ')}`)
  }

  // 2. recentre: the rest of what docs/DIORAMA.md promises — floor-aligned at
  //    the origin and centred in X and Z. Pruning alone left this cabinet 0.30 m
  //    behind its own origin, which at its back-wall placement (z = -4.9) pushed
  //    it through the shell's back wall at z = -5.3. A wrapper node with a
  //    translation only: no scale, no rotation, geometry untouched.
  const centre = [0, 1, 2].map((i) => (pruned.min[i] + pruned.max[i]) / 2)
  gltf.nodes.push({
    name: 'ci-recentre',
    translation: [-centre[0], -pruned.min[1], -centre[2]],
    children: [...scene.nodes]
  })
  scene.nodes = [gltf.nodes.length - 1]

  const after = measureGltf(gltf)
  const centred = Math.abs(after.min[0] + after.max[0]) < 1e-4
    && Math.abs(after.min[2] + after.max[2]) < 1e-4
    && Math.abs(after.min[1]) < 1e-4
  if (!centred) throw new Error(`${file}: recentre did not land on the origin`)

  gltf.asset = { ...(gltf.asset ?? {}), extras: { ...(gltf.asset?.extras ?? {}), ciPropRepair: MARKER } }

  console.log(`  ${file.padEnd(26)} ${spec.why}`)
  console.log(`  ${''.padEnd(26)}   before ${fmt(before)}  (${rootsBefore} roots)`)
  console.log(`  ${''.padEnd(26)}   after  ${fmt(after)}  (${scene.nodes.length} root, ${rootsBefore - (gltf.nodes[gltf.nodes.length - 1].children?.length ?? 0)} dropped)`)
  if (repair) { writeGlb(path, chunks, gltf); rewritten++ }
}

console.log('')
for (const f of ['commodore-pet', 'engelbart-mouse', 'ibm-1401-cpu', 'ibm-1401-mainframe', 'ibm-2401-tape', 'ibm-3178-terminal', 'ibm-3350-disk', 'ibm-ramac-305', 'kenbak-1', 'plugboard', 'prologica-cp500', 'xerox-alto']) {
  console.log(`  ${(f + '.glb').padEnd(26)} ${fmt(measureGlbFile(join(propsDir, `${f}.glb`)))}`)
}
console.log(repair ? `\n[prop-glb] rewrote ${rewritten} file(s)` : '\n[prop-glb] measure only — pass --repair to apply')
