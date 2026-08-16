/**
 * visemeTable.ts
 *
 * Universal character-to-viseme mapping and ARKit blendshape target definitions.
 *
 * Maps characters (Latin, IPA, international scripts) to canonical visemes,
 * which resolve directly to 52 Apple ARKit blendshape morph target influences.
 */

export type VisemeId =
  | 'sil'       // Silence / rest
  | 'PP'        // Bilabial plosive: p, b, m
  | 'FF'        // Labiodental fricative: f, v
  | 'TH'        // Dental fricative: th, dh
  | 'DD'        // Alveolar stop: t, d, n, l
  | 'DD_RETRO'  // Retroflex stop
  | 'KK'        // Velar stop: k, g, ng
  | 'CH'        // Post-alveolar affricate: ch, j, sh, zh
  | 'SS'        // Alveolar sibilant: s, z
  | 'NN'        // Nasal: n, m, ng
  | 'RR'        // Rhotic: r
  | 'AA'        // Open vowel: a, aa, ah (jaw wide open)
  | 'EE'        // Close front vowel: ee, i (lips spread)
  | 'IH'        // Near-close front: short i
  | 'OH'        // Mid back rounded: o (lips rounded)
  | 'OO'        // Close back rounded: oo, u (lips pursed)
  | 'ASPIRATE'  // Aspirated burst: h, kh, gh, ph

export interface VisemeWeights {
  jawOpen: number
  mouthClose: number
  mouthFunnel: number
  mouthPucker: number
  mouthSmileLeft: number
  mouthSmileRight: number
  mouthStretchLeft: number
  mouthStretchRight: number
  mouthRollLower: number
  mouthRollUpper: number
  mouthShrugLower: number
  mouthShrugUpper: number
  mouthPressLeft: number
  mouthPressRight: number
  mouthLowerDownLeft: number
  mouthLowerDownRight: number
  mouthUpperUpLeft: number
  mouthUpperUpRight: number
  tongueOut: number
}

export const ARKIT_LIP_SYNC_TARGETS: (keyof VisemeWeights)[] = [
  'jawOpen',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'tongueOut'
]

const W0: VisemeWeights = {
  jawOpen: 0,
  mouthClose: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthStretchLeft: 0,
  mouthStretchRight: 0,
  mouthRollLower: 0,
  mouthRollUpper: 0,
  mouthShrugLower: 0,
  mouthShrugUpper: 0,
  mouthPressLeft: 0,
  mouthPressRight: 0,
  mouthLowerDownLeft: 0,
  mouthLowerDownRight: 0,
  mouthUpperUpLeft: 0,
  mouthUpperUpRight: 0,
  tongueOut: 0
}

function w(overrides: Partial<VisemeWeights>): VisemeWeights {
  return { ...W0, ...overrides }
}

export const VISEME_WEIGHTS: Record<VisemeId, VisemeWeights> = {
  sil: w({ mouthClose: 0.1 }),
  PP: w({ mouthClose: 0.7, mouthPressLeft: 0.4, mouthPressRight: 0.4 }),
  FF: w({
    jawOpen: 0.1,
    mouthFunnel: 0.3,
    mouthUpperUpLeft: 0.2,
    mouthUpperUpRight: 0.2,
    mouthRollLower: 0.3
  }),
  TH: w({
    jawOpen: 0.15,
    tongueOut: 0.3,
    mouthLowerDownLeft: 0.1,
    mouthLowerDownRight: 0.1
  }),
  DD: w({
    jawOpen: 0.2,
    mouthStretchLeft: 0.1,
    mouthStretchRight: 0.1,
    mouthShrugUpper: 0.15
  }),
  DD_RETRO: w({
    jawOpen: 0.3,
    mouthStretchLeft: 0.15,
    mouthStretchRight: 0.15,
    mouthShrugLower: 0.15,
    mouthRollLower: 0.1
  }),
  KK: w({
    jawOpen: 0.15,
    mouthShrugLower: 0.1,
    mouthShrugUpper: 0.1
  }),
  CH: w({
    jawOpen: 0.15,
    mouthFunnel: 0.35,
    mouthPucker: 0.15,
    mouthShrugUpper: 0.1
  }),
  SS: w({
    jawOpen: 0.05,
    mouthStretchLeft: 0.25,
    mouthStretchRight: 0.25,
    mouthSmileLeft: 0.1,
    mouthSmileRight: 0.1
  }),
  NN: w({
    mouthClose: 0.4,
    mouthPressLeft: 0.2,
    mouthPressRight: 0.2,
    mouthShrugLower: 0.1
  }),
  RR: w({
    jawOpen: 0.2,
    mouthFunnel: 0.15,
    mouthShrugUpper: 0.1
  }),
  AA: w({
    jawOpen: 0.6,
    mouthLowerDownLeft: 0.2,
    mouthLowerDownRight: 0.2,
    mouthStretchLeft: 0.1,
    mouthStretchRight: 0.1
  }),
  EE: w({
    jawOpen: 0.15,
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    mouthStretchLeft: 0.2,
    mouthStretchRight: 0.2
  }),
  IH: w({
    jawOpen: 0.2,
    mouthSmileLeft: 0.2,
    mouthSmileRight: 0.2,
    mouthStretchLeft: 0.1,
    mouthStretchRight: 0.1
  }),
  OH: w({
    jawOpen: 0.35,
    mouthFunnel: 0.25,
    mouthPucker: 0.15
  }),
  OO: w({
    jawOpen: 0.1,
    mouthFunnel: 0.45,
    mouthPucker: 0.4
  }),
  ASPIRATE: w({
    jawOpen: 0.35,
    mouthFunnel: 0.2,
    mouthShrugLower: 0.2,
    mouthShrugUpper: 0.15,
    mouthLowerDownLeft: 0.1,
    mouthLowerDownRight: 0.1
  })
}

export const CHAR_TO_VISEME: Record<string, VisemeId> = {
  // Latin Vowels
  a: 'AA',
  e: 'EE',
  i: 'IH',
  o: 'OH',
  u: 'OO',

  // Latin Consonants
  p: 'PP',
  b: 'PP',
  m: 'PP',
  f: 'FF',
  v: 'FF',
  t: 'DD',
  d: 'DD',
  n: 'NN',
  l: 'DD',
  k: 'KK',
  g: 'KK',
  c: 'KK',
  j: 'CH',
  x: 'KK',
  q: 'KK',
  s: 'SS',
  z: 'SS',
  r: 'RR',
  w: 'OO',
  y: 'EE',
  h: 'ASPIRATE',

  // Common IPA symbols
  'ə': 'AA',
  'ʌ': 'AA',
  'æ': 'AA',
  'ɑ': 'AA',
  'ɒ': 'AA',
  'ɐ': 'AA',
  'ɪ': 'IH',
  'ɛ': 'IH',
  'ʊ': 'OO',
  'ɔ': 'OH',
  'θ': 'TH',
  'ð': 'TH',
  'ʃ': 'CH',
  'ʒ': 'CH',
  'ʧ': 'CH',
  'ʤ': 'CH',
  'ŋ': 'NN',
  'ɹ': 'RR',
  'ɾ': 'RR'
}

export function getVisemeForChar(char: string): VisemeId {
  const key = char.length === 1 ? char.toLowerCase() : char
  return CHAR_TO_VISEME[key] ?? 'sil'
}

export function getVisemeWeights(char: string): VisemeWeights {
  return VISEME_WEIGHTS[getVisemeForChar(char)]
}

export function textToVisemeSequence(text: string): VisemeId[] {
  const result: VisemeId[] = []
  for (const char of text) {
    result.push(getVisemeForChar(char))
  }
  return result
}

export function isAspiratedViseme(id: VisemeId): boolean {
  return id === 'ASPIRATE'
}

export function isRetroflexViseme(id: VisemeId): boolean {
  return id === 'DD_RETRO'
}
