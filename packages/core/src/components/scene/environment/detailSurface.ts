/**
 * detailSurface — the shared procedural "what is this paint actually like" map.
 *
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 *
 * Four of the diorama's props ship with every texture stripped and the other eight ship
 * baseColour only (see PROP_TEXTURES_LOST in DioramaProps.ts for the measurement and the
 * cause). Nothing in the set has a normal, metallic-roughness or occlusion map — not here and
 * not upstream. So the large flat faces of a 1.2 m cabinet have literally no surface: under a
 * moving highlight they are one uniform value edge to edge, which is the "plastic" read.
 *
 * This module makes ONE small tiling detail map — fine grain and a slow, low-contrast
 * unevenness, the orange peel of sprayed enamel over sheet steel — and nothing else. It carries
 * NO markings: no logos, no labels, no model numbers, no panel graphics, no decals. Those exist
 * in the real assets' lost textures and the honest way to get them back is to re-export the
 * source, not to draw a plausible IBM nameplate in a canvas. A wrong marking on a real machine
 * is worse than a blank one.
 *
 * It is generated rather than shipped so there is no file to fetch, nothing to keep in sync
 * with the asset pack, and no CDN in the path. 256px, built once, reused by every prop; the
 * per-prop tiling rate is the only thing that varies (see SURFACE_FINISH.detailRepeat).
 */
import * as THREE from 'three'

const SIZE = 256

/**
 * Mean of the roughness map, measured off the generated image.
 *
 * three multiplies `material.roughness` by the map's green channel, so a map that averages
 * below 1 silently sands every finish smoother than the number in SURFACE_FINISH says. The
 * material divides by this constant when it applies the map, which keeps the table's roughness
 * values meaning "the effective average", which is the only reading that is useful to tune
 * against.
 */
export const DETAIL_ROUGHNESS_MEAN = 0.86

/** Tileable value noise: a wrapped lattice of random values, smoothstep-interpolated. */
function lattice(cells: number, seed: number): Float32Array {
  const grid = new Float32Array(cells * cells)
  let state = seed >>> 0
  for (let i = 0; i < grid.length; i++) {
    // xorshift32 — deterministic, so every build of the app gets the same surface.
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    grid[i] = ((state >>> 0) % 100000) / 100000
  }
  return grid
}

function sampleLattice(grid: Float32Array, cells: number, u: number, v: number): number {
  const x = u * cells
  const y = v * cells
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const at = (ix: number, iy: number) =>
    grid[(((iy % cells) + cells) % cells) * cells + (((ix % cells) + cells) % cells)]
  const a = at(x0, y0)
  const b = at(x0 + 1, y0)
  const c = at(x0, y0 + 1)
  const d = at(x0 + 1, y0 + 1)
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy
}

/**
 * The height field the normal and the roughness are both derived from, so the two agree: where
 * the paint is proud it is also a little glossier, which is how a real sprayed panel behaves.
 *
 * WEIGHTED TOWARD THE FINE END, and that is a correction, not a preference. The first version
 * of this file put most of the amplitude in the lowest octave, on the theory that the big slow
 * wave is what survives at a 1280x720 framing. It survives all right: rendered at detailRepeat
 * 5 on a 1.2 m cabinet it made every machine in the rank look like it was cast in rough
 * concrete. Painted sheet steel has almost no low-frequency relief — what it has is a fine
 * even grain and a very slight long-wave in the GLOSS, which is a roughness signal, not a
 * normal one. Hence: the height field is mostly high-frequency, the normal map is sampled from
 * it at a tight tiling rate, and the slow unevenness is carried by the roughness map at a much
 * coarser one (SurfaceFinish.mottleRepeat).
 */
function heightField(): Float32Array {
  const octaves = [
    { cells: 4, amp: 0.18, seed: 0x9e3779b9 },
    { cells: 24, amp: 0.32, seed: 0x85ebca6b },
    { cells: 96, amp: 0.5, seed: 0xc2b2ae35 }
  ].map((o) => ({ ...o, grid: lattice(o.cells, o.seed) }))

  const h = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0
      for (const o of octaves) sum += o.amp * sampleLattice(o.grid, o.cells, x / SIZE, y / SIZE)
      h[y * SIZE + x] = sum
    }
  }

  // Normalise to 0..1 so the octave amplitudes above stay readable as ratios.
  let min = Infinity
  let max = -Infinity
  for (const v of h) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - min) / span
  return h
}

function toTexture(data: Uint8ClampedArray): THREE.DataTexture {
  const tex = new THREE.DataTexture(Uint8Array.from(data), SIZE, SIZE, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  // These props are seen at grazing angles down a receding rank, which is exactly the case
  // trilinear filtering blurs to nothing. Without anisotropy the detail is gone by the third
  // cabinet; with it the rank keeps its surface all the way to the wall.
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

let cached: { normal: THREE.Texture; roughness: THREE.Texture } | null = null

/**
 * Build (once) the shared detail normal and roughness maps.
 *
 * The returned textures are module-scoped singletons with `repeat` at 1. Callers that need a
 * different tiling rate must take a `.clone()` — see detailMapsFor.
 */
function buildDetailMaps() {
  if (cached) return cached
  const h = heightField()

  const normal = new Uint8ClampedArray(SIZE * SIZE * 4)
  const rough = new Uint8ClampedArray(SIZE * SIZE * 4)
  // Height-to-normal scale. Tuned so the map is a surface, not a hammered finish: the whole
  // point is that it should be invisible as a pattern and only felt as a break-up. 2.4 was
  // the concrete.
  const relief = 1.0
  const at = (x: number, y: number) => h[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)]

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      // Central differences, wrapped, so the tile is seamless in both axes.
      const dx = (at(x + 1, y) - at(x - 1, y)) * relief
      const dy = (at(x, y + 1) - at(x, y - 1)) * relief
      const len = Math.hypot(dx, dy, 1)
      normal[i] = ((-dx / len) * 0.5 + 0.5) * 255
      normal[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      normal[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      normal[i + 3] = 255

      // Proud paint is slightly glossier than the hollows: roughness runs 0.72..1.0 with the
      // height field inverted. DETAIL_ROUGHNESS_MEAN is the average of this ramp.
      const r = 1 - (1 - at(x, y)) * 0.28
      rough[i] = 0
      rough[i + 1] = r * 255
      rough[i + 2] = 0
      rough[i + 3] = 255
    }
  }

  cached = { normal: toTexture(normal), roughness: toTexture(rough) }
  return cached
}

const tiled = new Map<number, { normal: THREE.Texture; roughness: THREE.Texture }>()

/**
 * The detail maps at a given tiling rate, cached per rate so twelve props share at most a
 * handful of texture objects (a clone shares the source image; only the sampler state differs).
 *
 * Returns null when there is no repeat to apply, and on any renderer where the maps cannot be
 * built — this file is imported by a component that also runs under node in tests.
 */
export function detailMapsFor(repeat: number): { normal: THREE.Texture; roughness: THREE.Texture } | null {
  if (!(repeat > 0)) return null
  const key = Math.round(repeat * 100) / 100
  const hit = tiled.get(key)
  if (hit) return hit
  let base: ReturnType<typeof buildDetailMaps>
  try {
    base = buildDetailMaps()
  } catch {
    return null
  }
  const made = {
    normal: base.normal.clone(),
    roughness: base.roughness.clone()
  }
  for (const t of [made.normal, made.roughness]) {
    t.repeat.set(key, key)
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.needsUpdate = true
  }
  tiled.set(key, made)
  return made
}
