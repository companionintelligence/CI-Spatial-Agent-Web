import { VISEME_KEY_PREFIX } from '@ci-avatar/engine'

import type { VisemeState } from '../visemes/visemeTypes'
import type { VisemeWeights } from '../visemes/visemeTable'
import { ARKIT_LIP_SYNC_TARGETS } from '../visemes/visemeTable'

/**
 * Which engine gets the mouth this frame.
 *
 * There are two lip-sync producers in the tree and they used to BOTH write the rig
 * every frame, in sequence — the single largest reason the avatar's mouth looked
 * wrong. They are not equivalent, so the fix is not to blend them; it is to state
 * the preference and feed exactly one:
 *
 *  - `sequence` — the legacy word-timed path (LipsyncEn over whisper-style word
 *    timings). When it has a live entry it knows the actual phonetic shape, which
 *    beats anything inferred from the spectrum.
 *  - `acoustic` — FFT energy blended with a per-character timing estimate. The
 *    fallback, and today the only source in browser-TTS mode.
 *  - `none` — silence. The compositor's release ramp closes the mouth.
 *
 * Once real phoneme timestamps arrive from the TTS engine (HeadTTS/Kokoro), the
 * `sequence` branch becomes the normal path and `acoustic` degrades to amplitude
 * only. This function is the seam where that happens.
 */
export type SpeechSourceKind = 'sequence' | 'acoustic' | 'none'

/** Legacy VRM 5-expression target names → the Oculus viseme id they represent. */
const VRM_TARGET_TO_VISEME: Readonly<Record<string, string>> = {
  aa: 'aa',
  ee: 'E',
  ih: 'I',
  oh: 'O',
  ou: 'U'
}

/**
 * Is the word-timed sequence actually driving the mouth right now?
 *
 * Mirrors `visemesUpdate`'s own active-window filter rather than merely checking
 * that a sequence exists — a queued-but-not-yet-started utterance must not take
 * the mouth away from the acoustic path and freeze it shut.
 */
export function isSequenceActive(state: VisemeState, now: number = performance.now()): boolean {
  const sequence = state.sequence
  if (!sequence || sequence.length === 0) return false
  for (const item of sequence) {
    if (item.ts[0] <= now && item.ts[1] >= now) return true
  }
  return false
}

/**
 * Convert the legacy service's current targets into canonical `viseme:` keys.
 *
 * Publishing the viseme IDENTITY rather than a set of ARKit muscle weights keeps
 * the shape lossless for heads that carry `viseme_*` morphs, and lets the rig
 * adapter fold it down for those that do not — instead of the render loop
 * hand-rolling a different approximation for each rig type, as it did before.
 */
export function sequenceContributions(state: VisemeState): Record<string, number> {
  const targets = state.targets as unknown as Record<string, number> | undefined
  if (!targets) return {}

  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(targets)) {
    if (typeof value !== 'number' || value <= 0) continue
    if (state.isVRMMode) {
      const id = VRM_TARGET_TO_VISEME[key]
      if (id) out[`${VISEME_KEY_PREFIX}${id}`] = value
    } else if (key.startsWith('viseme_')) {
      out[`${VISEME_KEY_PREFIX}${key.slice('viseme_'.length)}`] = value
    }
  }
  return out
}

/** Convert blended acoustic/phonetic weights into canonical ARKit contributions. */
export function acousticContributions(weights: VisemeWeights): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of ARKIT_LIP_SYNC_TARGETS) {
    const value = weights[key]
    if (typeof value === 'number' && value > 0) out[key] = value
  }
  return out
}

export interface SpeechSourceInput {
  visemeState?: VisemeState
  /** Blended FFT + phonetic weights, or null when there is no audio at all. */
  acoustic: VisemeWeights | null
  /** True while audio is actually playing — gates the exclusive mouth claim. */
  isSpeaking: boolean
  now?: number
}

export interface SpeechSourceResult {
  kind: SpeechSourceKind
  contributions: Record<string, number>
  /**
   * Whether speech should take the mouth exclusively this frame. Only true while
   * something is genuinely driving it: a silent avatar must hand the lips back so
   * an emotion can smile with them.
   */
  claimsMouth: boolean
}

export function selectSpeechSource(input: SpeechSourceInput): SpeechSourceResult {
  const { visemeState, acoustic, isSpeaking, now } = input

  if (visemeState && isSequenceActive(visemeState, now)) {
    const contributions = sequenceContributions(visemeState)
    if (Object.keys(contributions).length > 0) {
      return { kind: 'sequence', contributions, claimsMouth: true }
    }
  }

  if (acoustic && isSpeaking) {
    const contributions = acousticContributions(acoustic)
    if (Object.keys(contributions).length > 0) {
      return { kind: 'acoustic', contributions, claimsMouth: true }
    }
  }

  return { kind: 'none', contributions: {}, claimsMouth: false }
}
