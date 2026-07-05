/**
 * Facial capability tiers — the "several facial-animation systems for heads of varying
 * detail" model. A loaded head is classified into the richest tier it can drive; the
 * facial driver then maps the unified emotion/viseme vocabulary onto whatever channels
 * that tier exposes, falling back gracefully toward the VRM-standard baseline.
 *
 * Strategy: **standardize on VRM where possible.** VRM 1.0's expression system carries
 * the standard mouth visemes + emotion presets AND arbitrary *custom* expressions, so a
 * detailed head (HumGen, and eventually MetaHuman via an ARKit bridge) can ship its
 * ARKit-52 / FACS detail as VRM custom expressions and flow through one runtime path.
 * Non-VRM GLB heads are supported via morph-target names as a compatibility tier.
 *
 * See docs/FACIAL-ANIMATION-PLAN.md.
 */

/** VRM 1.0 standard expression preset names (the portable baseline). */
export const VRM_STANDARD_EXPRESSIONS = [
  // mouth visemes
  'aa', 'ih', 'ou', 'ee', 'oh',
  // emotion presets
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
  // blink + look
  'blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight'
] as const

/** Oculus/Meta visemes (the 15 `viseme_*` morphs richer GLB heads carry). */
export const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
  'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E',
  'viseme_I', 'viseme_O', 'viseme_U'
] as const

/**
 * The canonical detailed vocabulary: the 52 ARKit blendshapes. This is the superset the
 * driver speaks internally; lower tiers receive a down-mapped subset, MetaHuman bridges
 * up from it. HumGen's `prepare_for_arkit` and RPM pro models emit this set.
 */
export const ARKIT_52 = [
  // eyes (14)
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft',
  'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight',
  'eyeSquintRight', 'eyeWideRight',
  // jaw (4)
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  // mouth (23)
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  // brows (5)
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  // cheeks (3)
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  // nose (2)
  'noseSneerLeft', 'noseSneerRight',
  // tongue (1)
  'tongueOut'
] as const

export type FacialTierId = 'none' | 'vrm-basic' | 'oculus-viseme' | 'arkit' | 'facs' | 'metahuman'

export interface FacialTier {
  id: FacialTierId
  /** Higher = more facial detail; the detector picks the highest rank a head satisfies. */
  rank: number
  label: string
  /** Human summary of the facial detail this tier delivers. */
  detail: string
  /** Approx. addressable facial channels. */
  channels: number
}

export const FACIAL_TIERS: Record<FacialTierId, FacialTier> = {
  none: { id: 'none', rank: 0, label: 'None', detail: 'No morphs/expressions — body only', channels: 0 },
  'vrm-basic': {
    id: 'vrm-basic', rank: 1, label: 'VRM standard',
    detail: '5 mouth visemes + emotion presets (happy/angry/sad/relaxed/surprised) + blink/look',
    channels: 12
  },
  'oculus-viseme': {
    id: 'oculus-viseme', rank: 2, label: 'Oculus visemes',
    detail: '15 phoneme visemes for richer lip-sync (+ partial ARKit expression)',
    channels: 15
  },
  arkit: {
    id: 'arkit', rank: 3, label: 'ARKit-52',
    detail: 'Full ARKit blendshapes — per-eye, brow, cheek, jaw, and lip detail',
    channels: 52
  },
  facs: {
    id: 'facs', rank: 4, label: 'FACS',
    detail: 'Anatomical FACS action units (HumGen) — muscle-driven micro-expression',
    channels: 43
  },
  metahuman: {
    id: 'metahuman', rank: 5, label: 'MetaHuman (roadmap)',
    detail: 'Rig-logic controls (~700), ARKit-compatible — photoreal, bridged via ARKit',
    channels: 700
  }
}

/** Case-insensitive membership over a head's available morph/expression names. */
function coverage(available: Set<string>, vocab: readonly string[]): number {
  let hit = 0
  for (const name of vocab) if (available.has(name.toLowerCase())) hit++
  return hit / vocab.length
}

/**
 * Classify a head by the richest facial tier its morph/expression names satisfy.
 *
 * @param names   morph-target keys (GLB) or VRM expression names the head exposes.
 * @param opts.isVRM   the head is a VRM (expression-manager path) — never below vrm-basic
 *                     if it has the standard mouth visemes.
 */
export function detectFacialTier(names: string[], opts: { isVRM?: boolean } = {}): FacialTierId {
  const set = new Set(names.map((n) => n.toLowerCase()))

  // ARKit is the detailed runtime tier: treat >=60% of the 52 as "ARKit-class".
  if (coverage(set, ARKIT_52) >= 0.6) return 'arkit'
  // Oculus visemes present (>=10 of 15) → richer lip-sync than VRM's 5.
  if (coverage(set, OCULUS_VISEMES) >= 0.66) return 'oculus-viseme'
  // VRM standard mouth visemes present → the portable baseline.
  const vrmMouth = ['aa', 'ih', 'ou', 'ee', 'oh']
  if (coverage(set, vrmMouth) >= 0.8 || (opts.isVRM && coverage(set, vrmMouth) >= 0.6)) {
    return 'vrm-basic'
  }
  return 'none'
}

export function describeFacialTier(id: FacialTierId): FacialTier {
  return FACIAL_TIERS[id]
}
