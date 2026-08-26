import { VISEME_KEY_PREFIX } from '../regions'
import type { FaceRig } from '../types'

/**
 * VrmExpressionFaceRig — canonical ARKit weights onto a VRM expression manager.
 *
 * VRM 1.0 ships a small standard vocabulary (five mouth shapes, blink, look, and
 * six emotion presets) but ALSO supports arbitrary custom expressions. Detailed
 * heads — HumGen's `prepare_for_arkit` output, the Aria avatar — export the full
 * ARKit-52 as custom expressions, so the right behaviour is:
 *
 *   1. If the VRM exposes the canonical ARKit name, drive it directly. Full fidelity.
 *   2. Otherwise fold down to the VRM standard set. Lossy but portable.
 *
 * Folding is many-to-one (`mouthSmile*` and `mouthStretch*` both land on `ee`), so
 * a frame's contributions are accumulated by max and flushed on commit rather than
 * written as they arrive — otherwise the last ARKit key processed would win and
 * the mouth would flicker between the shapes that share a target.
 */

type VrmStandard = 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'blink' | 'lookUp' | 'lookDown' | 'lookLeft' | 'lookRight'

/** ARKit key → (VRM standard expression, contribution scale). */
const ARKIT_TO_VRM: Readonly<Record<string, readonly [VrmStandard, number]>> = {
  jawOpen: ['aa', 1],
  mouthFunnel: ['oh', 1],
  mouthPucker: ['ou', 1],
  mouthRollLower: ['ou', 0.8],
  mouthSmileLeft: ['ee', 1],
  mouthSmileRight: ['ee', 1],
  mouthStretchLeft: ['ee', 0.8],
  mouthStretchRight: ['ih', 0.8],
  mouthShrugUpper: ['ih', 1],

  eyeBlinkLeft: ['blink', 1],
  eyeBlinkRight: ['blink', 1],

  eyeLookUpLeft: ['lookUp', 1],
  eyeLookUpRight: ['lookUp', 1],
  eyeLookDownLeft: ['lookDown', 1],
  eyeLookDownRight: ['lookDown', 1],
  eyeLookOutLeft: ['lookLeft', 1],
  eyeLookInRight: ['lookLeft', 1],
  eyeLookInLeft: ['lookRight', 1],
  eyeLookOutRight: ['lookRight', 1]
}

/** Oculus viseme id → VRM mouth shape, for the `viseme:` fast path. */
const OCULUS_TO_VRM: Readonly<Record<string, VrmStandard>> = {
  aa: 'aa', E: 'ee', I: 'ih', O: 'oh', U: 'ou',
  PP: 'ou', FF: 'ee', TH: 'aa', DD: 'aa', kk: 'ih',
  CH: 'ee', SS: 'ee', nn: 'ih', RR: 'aa', sil: 'aa'
}

export interface VrmExpressionManagerLike {
  expressionMap?: Record<string, unknown>
  setValue(name: string, value: number): void
  update?(): void
}

export class VrmExpressionFaceRig implements FaceRig {
  private readonly manager: VrmExpressionManagerLike
  private readonly available: Set<string>
  /** Accumulated folded weights for this frame, flushed on commit(). */
  private readonly pending = new Map<string, number>()
  /** Standard targets that had a value last commit, so they can be cleared. */
  private readonly live = new Set<string>()

  constructor(manager: VrmExpressionManagerLike) {
    this.manager = manager
    this.available = new Set(Object.keys(manager.expressionMap ?? {}))
  }

  /** True when this VRM carries ARKit names as custom expressions. */
  get hasArkitExpressions(): boolean {
    return this.available.has('jawOpen')
  }

  has(key: string): boolean {
    if (key.startsWith(VISEME_KEY_PREFIX)) {
      const id = key.slice(VISEME_KEY_PREFIX.length)
      const folded = OCULUS_TO_VRM[id]
      return this.available.has(id) || (folded !== undefined && this.available.has(folded))
    }
    if (this.available.has(key)) return true
    const mapped = ARKIT_TO_VRM[key]
    return mapped !== undefined && this.available.has(mapped[0])
  }

  write(key: string, value: number): void {
    if (key.startsWith(VISEME_KEY_PREFIX)) {
      const id = key.slice(VISEME_KEY_PREFIX.length)
      // A VRM exporting Oculus names outright takes the exact shape.
      if (this.available.has(id)) return this.accumulate(id, value)
      const folded = OCULUS_TO_VRM[id]
      if (folded && this.available.has(folded)) this.accumulate(folded, value)
      return
    }

    // Full-fidelity path: the head speaks ARKit natively.
    if (this.available.has(key)) return this.accumulate(key, value)

    const mapped = ARKIT_TO_VRM[key]
    if (mapped && this.available.has(mapped[0])) this.accumulate(mapped[0], value * mapped[1])
  }

  commit(): void {
    // Clear targets that were live last frame and got nothing this frame, so a
    // folded expression cannot stick after its ARKit sources went quiet.
    for (const name of this.live) {
      if (!this.pending.has(name)) this.safeSet(name, 0)
    }
    this.live.clear()

    for (const [name, value] of this.pending) {
      this.safeSet(name, value)
      if (value > 0) this.live.add(name)
    }
    this.pending.clear()

    this.manager.update?.()
  }

  private accumulate(name: string, value: number): void {
    const previous = this.pending.get(name)
    if (previous === undefined || value > previous) this.pending.set(name, Math.min(1, Math.max(0, value)))
  }

  private safeSet(name: string, value: number): void {
    try {
      this.manager.setValue(name, value)
    } catch {
      // A VRM can advertise an expression it cannot actually drive (empty binds
      // are common in converted models). Skipping is correct; throwing here would
      // take down the whole render loop for one cosmetic channel.
    }
  }
}
