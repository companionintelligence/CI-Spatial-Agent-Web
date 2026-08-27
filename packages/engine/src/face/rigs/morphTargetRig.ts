import { VISEME_KEY_PREFIX } from '../regions'
import type { FaceRig } from '../types'

/**
 * The only thing this adapter needs from a mesh. Structural rather than
 * `THREE.Mesh` so the face package stays renderer-free and unit-testable with a
 * plain object — three.js meshes satisfy it as-is.
 */
export interface MorphTargetMeshLike {
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[]
}

/**
 * MorphTargetFaceRig — canonical ARKit weights onto glTF morph targets.
 *
 * Handles the three channel families a GLB head may carry, in preference order:
 *
 *   1. ARKit-52 morphs (`jawOpen`, `eyeBlinkLeft`, …) — written directly.
 *   2. Oculus visemes (`viseme_aa` …) — driven from an explicit `viseme:` key when
 *      a producer supplies one, otherwise DERIVED from the ARKit mouth weights.
 *   3. Legacy aliases (`Blink`, `eyesClosed`, `mouthOpen`) — the lowest common
 *      denominator on older/exported heads.
 *
 * The derivation in (2) is lossy and always has been: it is a guess at a phonetic
 * shape from muscle activations. It lives here, once, instead of being inlined in
 * the render loop — and `viseme:` lets it be bypassed entirely once the TTS engine
 * reports real viseme ids.
 */

/** ARKit key → the Oculus viseme it most nearly implies, with a scale factor. */
const ARKIT_TO_OCULUS: Readonly<Record<string, readonly [string, number]>> = {
  jawOpen: ['viseme_aa', 1],
  mouthSmileLeft: ['viseme_E', 1],
  mouthStretchLeft: ['viseme_I', 1],
  mouthFunnel: ['viseme_O', 1],
  mouthPucker: ['viseme_U', 1],
  mouthClose: ['viseme_PP', 1],
  mouthRollLower: ['viseme_FF', 1],
  tongueOut: ['viseme_TH', 1],
  mouthShrugUpper: ['viseme_DD', 1],
  mouthShrugLower: ['viseme_kk', 1],
  mouthSmileRight: ['viseme_SS', 1],
  mouthPressLeft: ['viseme_nn', 1]
}

/** Canonical key → legacy single-morph aliases some heads ship instead. */
const LEGACY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  jawOpen: ['mouthOpen'],
  eyeBlinkLeft: ['Blink', 'eyesClosed'],
  eyeBlinkRight: ['Blink', 'eyesClosed']
}

interface Target {
  influences: number[]
  index: number
}

export class MorphTargetFaceRig implements FaceRig {
  /** Canonical (or raw morph) name → every mesh slot it drives. */
  private readonly targets = new Map<string, Target[]>()
  private readonly available = new Set<string>()

  constructor(meshes: readonly MorphTargetMeshLike[]) {
    for (const mesh of meshes) {
      const dictionary = mesh.morphTargetDictionary
      const influences = mesh.morphTargetInfluences
      if (!dictionary || !influences) continue
      for (const [name, index] of Object.entries(dictionary)) {
        this.available.add(name)
        const list = this.targets.get(name)
        const target: Target = { influences, index }
        if (list) list.push(target)
        else this.targets.set(name, [target])
      }
    }
  }

  /** True when this head carries any Oculus `viseme_*` morph. */
  get hasOculusVisemes(): boolean {
    return this.available.has('viseme_aa')
  }

  has(key: string): boolean {
    if (key.startsWith(VISEME_KEY_PREFIX)) {
      return this.available.has(`viseme_${key.slice(VISEME_KEY_PREFIX.length)}`)
    }
    if (this.available.has(key)) return true
    if (this.hasOculusVisemes && key in ARKIT_TO_OCULUS) return true
    return (LEGACY_ALIASES[key] ?? []).some((alias) => this.available.has(alias))
  }

  write(key: string, value: number): void {
    if (key.startsWith(VISEME_KEY_PREFIX)) {
      this.writeRaw(`viseme_${key.slice(VISEME_KEY_PREFIX.length)}`, value)
      return
    }

    const wroteCanonical = this.writeRaw(key, value)

    // Mirror onto an Oculus viseme only when the head has no ARKit key of its
    // own to carry the shape; a head with both would otherwise get the same
    // articulation twice and over-open.
    if (!wroteCanonical && this.hasOculusVisemes) {
      const mapped = ARKIT_TO_OCULUS[key]
      if (mapped) this.writeRaw(mapped[0], value * mapped[1])
    }

    if (!wroteCanonical) {
      for (const alias of LEGACY_ALIASES[key] ?? []) this.writeRaw(alias, value)
    }
  }

  private writeRaw(name: string, value: number): boolean {
    const targets = this.targets.get(name)
    if (!targets) return false
    for (const t of targets) t.influences[t.index] = value
    return true
  }
}
