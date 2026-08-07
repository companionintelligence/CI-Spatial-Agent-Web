import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  DioramaProps,
  PropTargetMaxDim,
  PROP_NEEDS_REEXPORT,
  PROP_SCALE_TOLERANCE,
  type DioramaPropName
} from './DioramaProps'
// The measurement lives in scripts/prop-glb.mjs so the repair tool and this test
// cannot disagree about what a prop measures.
import { measureGlbFile } from '../../../../../../scripts/prop-glb.mjs'

/**
 * The diorama's props are re-exported from Sketchfab-sourced FBX/.blend originals
 * by a headless Blender step that is supposed to normalize each mesh to the real
 * machine's dimensions and drop the source's backdrop set (docs/DIORAMA.md). When
 * that step does not finish, the GLB keeps its source units and its scenery — and
 * a 1.7 m mainframe ships as a 184 m room.
 *
 * Nothing caught that. It reached a committed product screenshot as an unreadable
 * wall of colour filling the frame, because the camera was standing inside the
 * asset. This test reads the GLB headers straight off disk and measures what was
 * actually shipped.
 *
 * Reads /assets/props — the committed source of truth — NOT apps/web/public,
 * which is gitignored and only populated by `pnpm predev`/`prebuild`. An earlier
 * version of this test pointed at the public dir and therefore skipped every case
 * in a fresh checkout and in CI, which is the same as not existing.
 */

const here = dirname(fileURLToPath(import.meta.url))
const propsDir = join(here, '../../../../../../assets/props')

const entries = Object.entries(DioramaProps) as Array<[DioramaPropName, string]>
const fileFor = (url: string) => join(propsDir, url.replace(/^\/assets\/props\//, ''))
const placed = entries.filter(([name]) => !PROP_NEEDS_REEXPORT.includes(name))

describe('diorama prop GLBs', () => {
  it('ships a file for every prop in the catalog', () => {
    for (const [name, url] of entries) {
      expect(existsSync(fileFor(url)), `${name}: ${url} is missing from /assets/props`).toBe(true)
    }
  })

  it('declares a target dimension for every prop in the catalog', () => {
    for (const [name] of entries) {
      expect(PropTargetMaxDim[name], `${name} has no target dimension`).toBeGreaterThan(0)
    }
  })

  // The invariant the product depends on: everything the diorama places is the
  // size of the real machine, straight from the file, with no runtime correction.
  it.each(placed)('%s is shipped at its real-world size', (name, url) => {
    const target = PropTargetMaxDim[name]
    const { maxDim } = measureGlbFile(fileFor(url))
    expect(maxDim, `${name} ships at ${maxDim.toFixed(2)} m against a ${target} m target`)
      .toBeLessThan(target * PROP_SCALE_TOLERANCE)
    expect(maxDim).toBeGreaterThan(target / PROP_SCALE_TOLERANCE)
  })

  // docs/DIORAMA.md: "floor-aligned at its own origin, centered in X/Y". A prop
  // that fails this sinks into the floor or stands off its mark, and PROP_LAYOUT
  // has no per-prop correction to absorb it.
  it.each(placed)('%s is floor-aligned and centred', (_name, url) => {
    const { min, max } = measureGlbFile(fileFor(url))
    const height = max[1] - min[1]
    expect(Math.abs(min[1]), 'floor offset').toBeLessThan(0.02 * Math.max(height, 0.1))
    expect(Math.abs(min[0] + max[0]) / 2, 'X centre offset').toBeLessThan(0.05 * (max[0] - min[0]))
    expect(Math.abs(min[2] + max[2]) / 2, 'Z centre offset').toBeLessThan(0.05 * (max[2] - min[2]))
  })

  /**
   * Props excluded for what is INSIDE the bounding box rather than for the size of
   * the box. A bounding box cannot see this class of break, so it has to be listed.
   *
   * This list exists because the previous version of the test asserted that the
   * exclusion list was EXACTLY the set of out-of-scale files — which quietly asserted
   * that scale is the only way a prop can be broken. It is not.
   */
  const EXCLUDED_FOR_CONTENT: DioramaPropName[] = ['IBM 1401 Mainframe (1959)']

  // Pins the exclusion list to what is actually broken. A good re-export makes this
  // fail and tells you to delete the entry, instead of the prop staying out of the
  // room forever because nobody remembered it was.
  it('excludes every out-of-scale prop, plus the ones excluded for content', () => {
    const outOfRange = entries
      .filter(([name, url]) => {
        const ratio = measureGlbFile(fileFor(url)).maxDim / PropTargetMaxDim[name]
        return ratio > PROP_SCALE_TOLERANCE || ratio < 1 / PROP_SCALE_TOLERANCE
      })
      .map(([name]) => name)
    for (const name of outOfRange) expect(PROP_NEEDS_REEXPORT).toContain(name)
    const extra = PROP_NEEDS_REEXPORT.filter((n) => !outOfRange.includes(n))
    expect([...extra].sort()).toEqual([...EXCLUDED_FOR_CONTENT].sort())
  })

  /**
   * The 1401 mainframe measures like a repaired prop and renders like an empty box.
   *
   * The assertion this replaces was "has the 1401 mainframe backdrop set pruned":
   * largest dimension < 2 m and floor at 0. Both still hold — 0.59 x 0.93 x 1.03 m,
   * floor 0.000 — and both are true of a file with no 1401 in it. Rendered alone on a
   * neutral background the whole visible contents are a white slab, three floating flat
   * blue plates above it, and a scatter of dots. The prune took the machine with the
   * backdrop, the box stayed plausible, and the green check said the repair worked.
   *
   * So this pins the measured numbers as a REGRESSION MARKER, not as a pass: while the
   * file measures exactly this, it is the known-empty one and stays in
   * PROP_NEEDS_REEXPORT. A real re-export changes these numbers, fails this test, and
   * that failure is the instruction to look at the render and put the prop back.
   */
  it('pins the 1401 mainframe as the known-empty export', () => {
    const { size, min } = measureGlbFile(fileFor(DioramaProps['IBM 1401 Mainframe (1959)']))
    expect(PROP_NEEDS_REEXPORT).toContain('IBM 1401 Mainframe (1959)')
    expect(size.map((n: number) => +n.toFixed(2))).toEqual([0.59, 0.93, 1.03])
    expect(min[1], 'floor').toBeCloseTo(0, 3)
  })
})
