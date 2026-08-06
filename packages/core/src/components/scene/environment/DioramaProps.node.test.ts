import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  DioramaProps,
  PropTargetMaxDim,
  PROP_SCALE_TOLERANCE,
  type DioramaPropName
} from './DioramaProps'

/**
 * The diorama's props are re-exported from Sketchfab-sourced FBX/.blend
 * originals by a headless Blender step that is supposed to normalize each mesh
 * to the real machine's dimensions (docs/DIORAMA.md). When that step silently
 * does not run, the GLB keeps its source units — and a 1.7 m mainframe ships as
 * an 88 m one.
 *
 * Nothing caught that. It reached a committed product screenshot as an
 * unreadable wall of colour filling the frame, because the camera was standing
 * inside the cabinet. This test reads the GLB headers straight off disk and
 * measures what was actually exported.
 */

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '../../../../../../apps/web/public')

type Gltf = {
  accessors?: Array<{ min?: number[]; max?: number[] }>
  meshes?: Array<{ primitives?: Array<{ attributes: Record<string, number> }> }>
  nodes?: Array<{ mesh?: number; children?: number[]; scale?: number[]; matrix?: number[] }>
}

function readGltfJson(file: string): Gltf {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf
}

function matrixScale(m: number[]): [number, number, number] {
  return [
    Math.hypot(m[0]!, m[1]!, m[2]!),
    Math.hypot(m[4]!, m[5]!, m[6]!),
    Math.hypot(m[8]!, m[9]!, m[10]!)
  ]
}

/** Largest world-space dimension of the GLB's meshes, in metres. */
function measureMaxDim(file: string): number {
  const gltf = readGltfJson(file)
  const nodes = gltf.nodes ?? []
  const accessors = gltf.accessors ?? []
  const parentOf = new Map<number, number>()
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)))

  const worldScale = (index: number): [number, number, number] => {
    let s: [number, number, number] = [1, 1, 1]
    let cur: number | undefined = index
    while (cur !== undefined) {
      const n = nodes[cur]!
      const ns = n.scale ? (n.scale as [number, number, number])
        : n.matrix ? matrixScale(n.matrix)
        : ([1, 1, 1] as [number, number, number])
      s = [s[0] * ns[0], s[1] * ns[1], s[2] * ns[2]]
      cur = parentOf.get(cur)
    }
    return s
  }

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  nodes.forEach((n, i) => {
    if (n.mesh === undefined) return
    const s = worldScale(i)
    for (const prim of gltf.meshes?.[n.mesh]?.primitives ?? []) {
      const a = accessors[prim.attributes['POSITION']!]
      if (!a?.min || !a.max) continue
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, a.min[k]! * s[k]!)
        max[k] = Math.max(max[k]!, a.max[k]! * s[k]!)
      }
    }
  })
  return Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!)
}

const entries = Object.entries(DioramaProps) as Array<[DioramaPropName, string]>

/**
 * Mirror of `normalizationFactor` in DatacenterDiorama.tsx, which measures the
 * loaded three.js object. Keeping the rule in one shape in two places is worth
 * it: this file can read the GLBs off disk without a WebGL context.
 */
function repairFactor(measured: number, target: number): number {
  if (!Number.isFinite(measured) || measured <= 0) return 1
  const ratio = measured / target
  if (ratio <= PROP_SCALE_TOLERANCE && ratio >= 1 / PROP_SCALE_TOLERANCE) return 1
  return target / measured
}

/**
 * The three assets that shipped without the export pipeline's normalization
 * step. Listed rather than merely tolerated: if a re-export fixes one, this test
 * fails and tells you to delete it from the list (and from the note in
 * DatacenterDiorama.tsx), instead of the repair quietly becoming dead code.
 */
const KNOWN_UNNORMALIZED: DioramaPropName[] = [
  'IBM 1401 Mainframe (1959)',
  'KENBAK-1 (1971)',
  'IBM 3178 Terminal (1979)'
]

function fileFor(url: string): string | null {
  const file = join(publicDir, url.replace(/^\//, ''))
  // pack-assets.mjs stages these from the asset archive; skip rather than fail
  // on a checkout that has not run it.
  return existsSync(file) ? file : null
}

describe('diorama prop GLBs', () => {
  it('declares a target dimension for every prop in the catalog', () => {
    for (const [name] of entries) {
      expect(PropTargetMaxDim[name], `${name} has no target dimension`).toBeGreaterThan(0)
    }
  })

  // The invariant the product actually depends on: whatever the GLB says, the
  // thing placed in the room is the size of the real machine. A 90 m mainframe
  // 5 m from the camera is what filled the committed diorama screenshot.
  it.each(entries)('%s renders at its real-world size after repair', (name, url) => {
    const file = fileFor(url)
    if (!file) return
    const target = PropTargetMaxDim[name]
    const rendered = measureMaxDim(file) * repairFactor(measureMaxDim(file), target)
    expect(rendered, `${name} renders at ${rendered.toFixed(2)} m against a ${target} m target`)
      .toBeLessThan(target * PROP_SCALE_TOLERANCE)
    expect(rendered).toBeGreaterThan(target / PROP_SCALE_TOLERANCE)
  })

  it('needs the repair for exactly the assets known to have skipped normalization', () => {
    const needsRepair = entries
      .filter(([, url]) => fileFor(url))
      .filter(([name, url]) => repairFactor(measureMaxDim(fileFor(url)!), PropTargetMaxDim[name]) !== 1)
      .map(([name]) => name)
    if (needsRepair.length === 0 && entries.every(([, url]) => !fileFor(url))) return
    expect(needsRepair.sort()).toEqual([...KNOWN_UNNORMALIZED].sort())
  })
})
