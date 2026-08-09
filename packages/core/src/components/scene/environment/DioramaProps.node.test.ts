import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  DioramaProps,
  PropTargetMaxDim,
  DEFAULT_FINISH,
  PROP_GEOMETRY_CROP,
  PROP_NEEDS_REEXPORT,
  PROP_SCALE_TOLERANCE,
  PROP_SURFACE,
  PROP_TEXTURES_LOST,
  PROP_TINT,
  SURFACE_FINISH,
  type DioramaPropName,
  type SurfaceFinishName
} from './DioramaProps'
// The measurement lives in scripts/prop-glb.mjs so the repair tool and this test
// cannot disagree about what a prop measures.
import { measureGlbFile, readGlbJson } from '../../../../../../scripts/prop-glb.mjs'

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

  /**
   * The RAMAC's detached tape reel — the "floating disc" in the product frames.
   *
   * Same shape of problem as the 1401 above and the same shape of guard: the file measures
   * perfectly plausibly (1.75 x 1.33 x 0.51 m, floor 0, inside tolerance for a 1.7 m target)
   * and still ships a reel hanging in mid air off the cabinet's right face. A bounding box
   * cannot see it, so the numbers that PROVE it is still there are pinned here.
   *
   * DatacenterDiorama crops it at load (PROP_GEOMETRY_CROP). If a re-export ever removes the
   * reel at source, the asset's X extent shrinks toward the cabinet's own 1.20 m, this test
   * fails, and the failure is the instruction to delete the crop rather than leave the app
   * cutting geometry off a file that no longer needs it.
   */
  it('pins the RAMAC 305 as still shipping its detached tape reel', () => {
    const crop = PROP_GEOMETRY_CROP['IBM RAMAC 305 (1956)']
    expect(crop, 'the RAMAC crop is what removes the floating reel').toBeDefined()
    expect(crop!.axis).toBe('x')

    const { size, min, max } = measureGlbFile(fileFor(DioramaProps['IBM RAMAC 305 (1956)']))
    // 1.75 m across, of which the cabinet is ~1.20 m: the surplus IS the reel.
    expect(+size[0].toFixed(2), 'X extent while the reel is still in the file').toBe(1.75)
    // The crop plane has to fall strictly inside the asset, or it is a silent no-op that
    // removes nothing and leaves the disc on screen.
    expect(crop!.keepBelow).toBeGreaterThan(min[0])
    expect(crop!.keepBelow).toBeLessThan(max[0])
    // ...and it has to sit in the empty gap between cabinet and reel, not through the machine.
    expect(crop!.keepBelow, 'crop plane is outboard of the cabinet side panel').toBeGreaterThan(0.32)
    expect(crop!.keepBelow, 'crop plane is inboard of the nearest floating vertex').toBeLessThan(0.4)
  })

  // Grading a prop the diorama never places is dead configuration that reads as intent.
  it('only tints props the diorama can actually place', () => {
    for (const name of Object.keys(PROP_TINT) as DioramaPropName[]) {
      expect(DioramaProps[name], `${name} is not in the catalog`).toBeDefined()
      expect(PROP_NEEDS_REEXPORT, `${name} is tinted but excluded`).not.toContain(name)
    }
  })

  // A tint is a multiplier on an existing base colour. Above 1 it is a brightener, which is
  // the opposite of the clipping problem PROP_TINT exists to solve; at or below 0 it is black.
  it('keeps every tint a darkening multiplier', () => {
    for (const [name, tint] of Object.entries(PROP_TINT)) {
      expect(tint, `${name} tint is RGB`).toHaveLength(3)
      for (const channel of tint as number[]) {
        expect(channel, `${name} tint channel`).toBeGreaterThan(0)
        expect(channel, `${name} tint channel`).toBeLessThanOrEqual(1)
      }
    }
  })

  /**
   * The four texture-stripped exports — the third class of broken prop, and the one every
   * measurement above is blind to.
   *
   * Same shape of guard as the 1401 and the RAMAC pins: these files measure correctly, are
   * floor-aligned, are inside scale tolerance, and still ship with `images` empty, so their
   * materials fall back to a flat grey. That fallback is the entire reason the rank cabinets
   * render as near-white boxes. PROP_TEXTURES_LOST explains the cause (all four are the
   * `.blend`-sourced props, whose packed images the basename relink in fbx2glb.py cannot
   * resolve) and names the fix.
   *
   * A good re-export puts images back, this fails, and the failure is the instruction to
   * delete the entry and re-grade PROP_TINT against a prop that finally has an albedo.
   */
  it('pins the texture-stripped exports as still shipping no images', () => {
    for (const name of PROP_TEXTURES_LOST) {
      const gltf = readGlbJson(fileFor(DioramaProps[name]))
      expect(gltf.images ?? [], `${name} unexpectedly ships images — re-export landed?`).toHaveLength(0)
      expect(gltf.textures ?? [], `${name} unexpectedly ships textures`).toHaveLength(0)
      expect(DioramaProps[name], `${name} is not in the catalog`).toBeDefined()
    }
  })

  // The inverse: every OTHER prop still has its textures. Without this the list above could be
  // quietly extended to cover a fresh regression instead of the regression being fixed.
  it('every prop not on the lost-texture list still ships its images', () => {
    const lost = new Set<DioramaPropName>(PROP_TEXTURES_LOST)
    for (const [name, url] of entries) {
      if (lost.has(name)) continue
      const gltf = readGlbJson(fileFor(url))
      expect((gltf.images ?? []).length, `${name} has lost its textures`).toBeGreaterThan(0)
    }
  })

  // A finish name that does not exist silently falls back to the material's shipped values,
  // which is the failure this whole table exists to end.
  it('only names finishes that exist', () => {
    const known = new Set(Object.keys(SURFACE_FINISH))
    expect(known.has(DEFAULT_FINISH), 'DEFAULT_FINISH').toBe(true)
    for (const [name, surface] of Object.entries(PROP_SURFACE)) {
      expect(known.has(surface!.finish), `${name} finish ${surface!.finish}`).toBe(true)
      for (const [material, finish] of Object.entries(surface!.byMaterial ?? {})) {
        expect(known.has(finish), `${name}/${material} finish ${finish}`).toBe(true)
      }
    }
  })

  // Physically-plausible bounds. metalness/roughness outside 0..1 is undefined in three, and a
  // roughness of 0 on painted steel is a mirror — the exact "toy" look the table is fixing.
  it('keeps every finish inside plausible PBR bounds', () => {
    for (const [name, finish] of Object.entries(SURFACE_FINISH) as Array<[SurfaceFinishName, (typeof SURFACE_FINISH)[SurfaceFinishName]]>) {
      expect(finish.metalness, `${name} metalness`).toBeGreaterThanOrEqual(0)
      expect(finish.metalness, `${name} metalness`).toBeLessThanOrEqual(1)
      expect(finish.roughness, `${name} roughness`).toBeGreaterThan(0.02)
      expect(finish.roughness, `${name} roughness`).toBeLessThanOrEqual(1)
      expect(finish.envMapIntensity, `${name} envMapIntensity`).toBeGreaterThanOrEqual(0)
      expect(finish.detailStrength, `${name} detailStrength`).toBeGreaterThanOrEqual(0)
      // A loose normal-map tiling rate is what made the cabinets look like cast concrete.
      if (finish.detailStrength > 0) {
        expect(finish.detailRepeat, `${name} detailRepeat`).toBeGreaterThanOrEqual(8)
      }
      // ...and the roughness mottle has to stay coarser than the grain or the two collapse
      // into one frequency and the large flat faces go back to a constant.
      if (finish.mottleRepeat > 0) {
        expect(finish.mottleRepeat, `${name} mottleRepeat`).toBeLessThan(finish.detailRepeat)
      }
    }
  })

  /**
   * Per-material overrides are keyed by the GLB's OWN material names. A rename in a re-export
   * would silently drop the override — a glass drive window quietly rendered as paint, which is
   * exactly the kind of regression nobody notices in a thumbnail.
   */
  it('only overrides materials that exist in the prop', () => {
    for (const [propName, surface] of Object.entries(PROP_SURFACE)) {
      const overrides = Object.keys(surface!.byMaterial ?? {})
      if (overrides.length === 0) continue
      const gltf = readGlbJson(fileFor(DioramaProps[propName as DioramaPropName]))
      const shipped = new Set((gltf.materials ?? []).map((m: { name?: string }) => m.name))
      for (const material of overrides) {
        expect(shipped.has(material), `${propName} has no material named ${material}`).toBe(true)
      }
    }
  })

  // Configuring a finish for a prop the diorama never places is dead configuration that reads
  // as intent — the same rule PROP_TINT is held to.
  it('only assigns finishes to props the diorama can actually place', () => {
    for (const name of Object.keys(PROP_SURFACE) as DioramaPropName[]) {
      expect(DioramaProps[name], `${name} is not in the catalog`).toBeDefined()
      expect(PROP_NEEDS_REEXPORT, `${name} has a finish but is excluded`).not.toContain(name)
    }
  })
})
