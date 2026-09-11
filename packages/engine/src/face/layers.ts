import type { FaceRegion } from './regions'
import type { LayerSpec } from './types'

/**
 * The canonical layer stack, in priority order.
 *
 * Region ownership here is the contract that replaced "whoever writes last wins".
 * Read it as: what is this producer *entitled* to move?
 */
export const FACE_LAYERS = {
  /** Resting/mood baseline. Everything else sits on top of it. */
  BASE: 'base',
  /** Emotional expression from the emote service. */
  EMOTION: 'emotion',
  /** Lip-sync. Claims the mouth exclusively while audio is actually playing. */
  SPEECH: 'speech',
  /** Blinks, saccades, gaze, acoustic brows — the autonomous vitality engine. */
  VITALITY: 'vitality',
  /** Test harness and scripted capture. Beats everything, by design. */
  OVERRIDE: 'override'
} as const

export type FaceLayerId = (typeof FACE_LAYERS)[keyof typeof FACE_LAYERS]

const EMOTION_REGIONS: readonly FaceRegion[] = ['brows', 'eyelids', 'cheeks', 'lips', 'nose']
const SPEECH_REGIONS: readonly FaceRegion[] = ['jaw', 'lips', 'tongue']
const VITALITY_REGIONS: readonly FaceRegion[] = ['eyelids', 'gaze', 'brows', 'cheeks']

export const DEFAULT_FACE_LAYERS: readonly LayerSpec[] = [
  { id: FACE_LAYERS.BASE, priority: 0, blend: 'replace' },

  // Emotion may shape the lips (a smile is a mouth expression) but never the jaw:
  // jaw opening belongs to speech, and letting emotion move it made reactions read
  // as chewing.
  { id: FACE_LAYERS.EMOTION, priority: 10, blend: 'max', owns: EMOTION_REGIONS },

  // Speech replaces rather than maxes: a viseme is a specific shape, not an
  // intensity to be blended with whatever else wanted the same key.
  { id: FACE_LAYERS.SPEECH, priority: 20, blend: 'replace', owns: SPEECH_REGIONS },

  // Vitality sits ABOVE emotion on the eyes: a blink must close a lid that a
  // "surprised" baseline is holding wide, or the avatar simply stops blinking
  // whenever it is expressive.
  { id: FACE_LAYERS.VITALITY, priority: 30, blend: 'max', owns: VITALITY_REGIONS },

  { id: FACE_LAYERS.OVERRIDE, priority: 100, blend: 'replace' }
]
