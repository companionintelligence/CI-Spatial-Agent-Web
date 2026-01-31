import type { VRM } from '@pixiv/three-vrm'

export interface VisemeTarget {
  viseme_PP: number // Remove "viseme_" prefix but keep all 14
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

// ADD: 5-viseme interface for VRM models
export interface VRMVisemeTarget {
  aa: number
  ee: number
  ih: number
  oh: number
  ou: number
}

// ADD: Union type for flexibility
export type AnyVisemeTarget = VisemeTarget | VRMVisemeTarget

// KEEP: Original create function for GLB
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

// ADD: VRM create function
export const createEmptyVRMVisemeTarget = (): VRMVisemeTarget => ({
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0
})

export interface VisemeSequenceItem {
  template: { name: string }
  ts: [number, number, number]
  vs: Record<string, [null, number, number]>
  viseme?: string
  time?: number
  duration?: number
}

export interface VisemeState {
  targets: VisemeTarget | VRMVisemeTarget
  dirty: Partial<VisemeTarget> | Partial<VRMVisemeTarget>
  sequence: VisemeSequenceItem[]
  vrm?: VRM
  morphs?: { morphTargetInfluences: number[] }[]
  dictionary?: Record<string, number[]>
  isVRMMode?: boolean // ADD: Flag to determine which system to use
}

export interface WhisperData {
  words?: string[]
  wtimes?: number[]
  wdurations?: number[]
}

export interface LipsyncResult {
  anim?: VisemeSequenceItem[]
}
