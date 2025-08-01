export interface VisemeTarget {
  viseme_PP: number
  viseme_FF: number
  viseme_TH: number
  viseme_DD: number
  viseme_kk: number
  viseme_CH: number
  viseme_SS: number
  viseme_nn: number
  viseme_RR: number
  viseme_aa: number
  viseme_E: number
  viseme_I: number
  viseme_O: number
  viseme_U: number
}

export interface VisemeSequenceItem {
  template: { name: string }
  ts: [number, number, number] // [begin, peak, end] timestamps
  vs: Partial<Record<keyof VisemeTarget, [null, number, number]>>
  viseme?: string
  time?: number
  duration?: number
}

export interface VisemeState {
  targets: VisemeTarget
  dirty: Partial<VisemeTarget>
  sequence: VisemeSequenceItem[]
  vrm?: { expressionManager: { setValue: (key: string, value: number) => void } }
  morphs?: { morphTargetInfluences: number[] }[]
  dictionary?: Record<string, number[]> // Mapping for non-VRM avatars
}

export interface WhisperData {
  words?: string[]
  wtimes?: number[]
  wdurations?: number[]
}

export interface LipsyncResult {
  anim?: VisemeSequenceItem[]
}

export const createEmptyVisemeTarget = (): VisemeTarget => ({
  viseme_PP: 0,
  viseme_FF: 0,
  viseme_TH: 0,
  viseme_DD: 0,
  viseme_kk: 0,
  viseme_CH: 0,
  viseme_SS: 0,
  viseme_nn: 0,
  viseme_RR: 0,
  viseme_aa: 0,
  viseme_E: 0,
  viseme_I: 0,
  viseme_O: 0,
  viseme_U: 0
})
