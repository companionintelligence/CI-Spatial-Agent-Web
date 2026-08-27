import { regionOf } from '@ci-avatar/engine'

/**
 * Translate the emote service's expression vocabulary into canonical ARKit keys.
 *
 * The emote configs are written in a TalkingHead-flavoured shorthand that is
 * *mostly* ARKit-52 but not entirely: a handful of names are symmetric shorthands
 * (`mouthSmile` for both corners), and a handful are not facial morphs at all
 * (`headRotateX`, `handFistLeft`).
 *
 * Previously those names were looked up straight against the rig's morph
 * dictionary, so any that did not happen to match were a silent no-op — which is
 * why several authored emotions never visibly reached the face. Making the
 * translation explicit means an unmapped name is a bug someone can see, not a
 * shrug.
 */

/** Shorthand → the canonical keys it actually drives. */
const SYMMETRIC_ALIASES: Readonly<Record<string, readonly string[]>> = {
  mouthSmile: ['mouthSmileLeft', 'mouthSmileRight'],
  eyesClosed: ['eyeBlinkLeft', 'eyeBlinkRight'],
  eyesLookDown: ['eyeLookDownLeft', 'eyeLookDownRight'],
  eyesLookUp: ['eyeLookUpLeft', 'eyeLookUpRight'],
  mouthFrown: ['mouthFrownLeft', 'mouthFrownRight'],
  browDown: ['browDownLeft', 'browDownRight'],
  browOuterUp: ['browOuterUpLeft', 'browOuterUpRight']
}

/**
 * Names the emote configs carry that are NOT facial morph targets — bone
 * rotations and hand poses. Listed explicitly so they are dropped deliberately
 * rather than by accident, and so adding a real driver for them later is a
 * one-line change here.
 */
const NON_FACIAL = new Set(['eyesRotateX', 'eyesRotateY', 'headRotateX', 'headRotateY', 'headRotateZ', 'handFistLeft', 'handFistRight'])

export interface EmoteTranslation {
  weights: Record<string, number>
  /** Emote keys that are neither canonical nor mapped — surfaced, not swallowed. */
  unmapped: string[]
}

export function translateEmoteTargets(targets: Readonly<Record<string, unknown>>): EmoteTranslation {
  const weights: Record<string, number> = {}
  const unmapped: string[] = []

  for (const [key, raw] of Object.entries(targets)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    if (NON_FACIAL.has(key)) continue

    const aliases = SYMMETRIC_ALIASES[key]
    if (aliases) {
      for (const canonical of aliases) {
        // Several shorthands can target the same canonical key; keep the strongest.
        weights[canonical] = Math.max(weights[canonical] ?? 0, raw)
      }
      continue
    }

    if (regionOf(key)) {
      weights[key] = Math.max(weights[key] ?? 0, raw)
      continue
    }

    unmapped.push(key)
  }

  return { weights, unmapped }
}
