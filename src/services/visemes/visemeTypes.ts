import type { VRM } from "@pixiv/three-vrm"

export interface VisemeTarget {
  PP: number      // Remove "viseme_" prefix but keep all 14
  FF: number
  TH: number
  DD: number
  kk: number
  CH: number
  SS: number
  nn: number
  RR: number
  aa: number
  E: number
  I: number
  O: number
  U: number
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
  PP: 0,
  FF: 0,
  TH: 0,
  DD: 0,
  kk: 0,
  CH: 0,
  SS: 0,
  nn: 0,
  RR: 0,
  aa: 0,
  E: 0,
  I: 0,
  O: 0,
  U: 0
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
  isVRMMode?: boolean  // ADD: Flag to determine which system to use
}

export interface WhisperData {
  words?: string[]
  wtimes?: number[]
  wdurations?: number[]
}

export interface LipsyncResult {
  anim?: VisemeSequenceItem[]
}
