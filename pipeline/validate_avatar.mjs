#!/usr/bin/env node
/**
 * validate_avatar.mjs — fail-fast rig-contract gate for a generated avatar.
 *
 * Asserts an exported GLB (or VRM — a VRM is a glTF binary too) exposes:
 *   1. the 15 Oculus visemes (morph targets prefixed `viseme_`),
 *   2. the ARKit-52 contract morphs (from emoteTypes.ts FacialTarget),
 *   3. the RPM contract bones (Hips/Spine/Spine1/Spine2/Neck/Head/LeftEye/RightEye).
 * Exits non-zero on any missing item, printing exactly what's absent.
 *
 * Usage:
 *   node pipeline/validate_avatar.mjs <path-to.glb|.vrm> [--json]
 *
 * Standalone by design. It prefers three.js `GLTFLoader` for a real load
 * (resolved from the workspace's installed `three`, three-vrm dep), but falls
 * back to parsing the GLB binary JSON chunk directly when three isn't resolvable
 * — the morph/bone NAMES live in that chunk, so the name contract can always be
 * checked with zero dependencies. Pass nothing extra:
 *   node pipeline/validate_avatar.mjs out/Aria.glb
 *
 * three.js note: `three` is a dependency of packages/core. If it isn't hoisted
 * to a resolvable location, this script transparently uses the binary parser;
 * to force the three path, run from a dir where `import('three')` resolves, or
 * see `node --experimental-vm-modules` in the docs. Either path checks the same
 * names.
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import process from 'node:process'

// ---- the rig contract (kept in sync with pipeline/mappings.py & the app) ----

const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
]

// ARKit contract morphs — mirror mappings.ARKIT_CONTRACT_MORPHS, which is drawn
// from emoteTypes.ts FacialTarget (rotation-only fields excluded).
const ARKIT_CONTRACT_MORPHS = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight', 'eyesClosed',
  'browDownLeft', 'browDownRight', 'browInnerUp',
  'browOuterUpLeft', 'browOuterUpRight',
  'jawForward',
  'mouthSmile', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthLeft',
  'mouthPressLeft', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthShrugLower', 'mouthShrugUpper', 'mouthRollLower', 'mouthRollUpper',
  'mouthPucker', 'mouthFunnel', 'mouthClose',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'noseSneerLeft', 'noseSneerRight',
  'cheekSquintLeft', 'cheekSquintRight',
]

const RPM_CONTRACT_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye',
]

// ---- args ----

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const filePath = args.find((a) => !a.startsWith('--'))

if (!filePath) {
  console.error('usage: node pipeline/validate_avatar.mjs <path-to.glb|.vrm> [--json]')
  process.exit(2)
}
if (!existsSync(filePath)) {
  console.error(`file not found: ${filePath}`)
  process.exit(2)
}

// ---- extract {morphNames, boneNames} via three, else via binary parse ----

async function extractViaThree(path) {
  // Try to resolve three + GLTFLoader from the installed workspace deps.
  const three = await import('three')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  // Node has no fetch-for-file; feed the loader an ArrayBuffer via parse().
  const buf = await readFile(path)
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

  const gltf = await new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.parse(arrayBuffer, '', resolve, reject)
  })

  const morphNames = new Set()
  const boneNames = new Set()
  gltf.scene.traverse((obj) => {
    if (obj.isBone) boneNames.add(obj.name)
    if (obj.morphTargetDictionary) {
      for (const name of Object.keys(obj.morphTargetDictionary)) morphNames.add(name)
    }
  })
  return { morphNames, boneNames, via: `three r${three.REVISION}` }
}

function extractViaBinary(buf) {
  // Parse the glTF binary container: header (12B) then chunks.
  // First chunk is JSON; it holds node names, skins.joints, and morph
  // targetNames under mesh.extras / primitive.extras.
  if (buf.readUInt32LE(0) !== 0x46546c67 /* 'glTF' */) {
    throw new Error('not a binary glTF (.glb/.vrm) — magic mismatch')
  }
  const jsonChunkLen = buf.readUInt32LE(12)
  const jsonChunkType = buf.readUInt32LE(16)
  if (jsonChunkType !== 0x4e4f534a /* 'JSON' */) {
    throw new Error('first glTF chunk is not JSON')
  }
  const json = JSON.parse(buf.slice(20, 20 + jsonChunkLen).toString('utf8'))

  const nodes = json.nodes || []
  const boneNames = new Set()
  for (const skin of json.skins || []) {
    for (const j of skin.joints || []) {
      const n = nodes[j]
      if (n && n.name) boneNames.add(n.name)
    }
  }

  const morphNames = new Set()
  for (const mesh of json.meshes || []) {
    const collect = (extras) => {
      const tn = extras && extras.targetNames
      if (Array.isArray(tn)) tn.forEach((n) => morphNames.add(n))
    }
    collect(mesh.extras)
    for (const prim of mesh.primitives || []) collect(prim.extras)
  }
  return { morphNames, boneNames, via: 'binary-parse' }
}

async function extract(path) {
  try {
    return await extractViaThree(path)
  } catch (e) {
    // three not resolvable (workspace deps not hoisted) or parse quirk — fall
    // back to the dependency-free binary name parser.
    if (!asJson) {
      console.error(`[validate] three GLTFLoader unavailable (${e.code || e.message}); `
        + 'using binary parser')
    }
    const buf = await readFile(path)
    return extractViaBinary(buf)
  }
}

// ---- assert & report ----

function missing(required, present) {
  return required.filter((n) => !present.has(n))
}

const { morphNames, boneNames, via } = await extract(filePath)

const missingVisemes = missing(OCULUS_VISEMES, morphNames)
const missingArkit = missing(ARKIT_CONTRACT_MORPHS, morphNames)
const missingBones = missing(RPM_CONTRACT_BONES, boneNames)

const ok = !missingVisemes.length && !missingArkit.length && !missingBones.length
const report = {
  file: basename(filePath),
  via,
  counts: { morphs: morphNames.size, bones: boneNames.size },
  missing: { visemes: missingVisemes, arkit: missingArkit, bones: missingBones },
  ok,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n[validate] ${report.file}  (loaded via ${via})`)
  console.log(`  morph targets: ${morphNames.size}   bones: ${boneNames.size}`)
  const line = (label, list, total) =>
    console.log(`  ${list.length ? '✗' : '✓'} ${label}: ${total - list.length}/${total}`
      + (list.length ? `  MISSING: ${list.join(', ')}` : ''))
  line('visemes', missingVisemes, OCULUS_VISEMES.length)
  line('ARKit morphs', missingArkit, ARKIT_CONTRACT_MORPHS.length)
  line('RPM bones', missingBones, RPM_CONTRACT_BONES.length)
  console.log(ok ? '\n[validate] PASS — rig contract satisfied.\n'
    : '\n[validate] FAIL — rig contract violated.\n')
}

process.exit(ok ? 0 : 1)
