import type { VRM } from '@pixiv/three-vrm'
import type { Camera, Vector3 } from '@react-three/fiber'
import type { Bone, Object3D } from 'three'

// Enhanced error handling types
export type EmoteResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

export type EmotionType = 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep' | 'alert'
export type PlayerVisionType = 'focused' | 'peripheral' | null

export const VRM_EXPRESSIONS = {
  // Basic emotions
  happy: 'happy',
  angry: 'angry',
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',

  // Eye expressions
  blink: 'blink',
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
  // Additional expressions
  neutral: 'neutral'
} as const

export interface FacialTarget {
  // Eye expressions
  eyeBlinkLeft: number
  eyeBlinkRight: number
  eyeSquintLeft: number
  eyeSquintRight: number
  eyeWideLeft: number
  eyeWideRight: number
  eyesLookDown: number
  eyesClosed: number

  // Brow expressions
  browDownLeft: number
  browDownRight: number
  browInnerUp: number
  browOuterUpLeft: number
  browOuterUpRight: number

  // Mouth expressions
  mouthSmile: number
  mouthFrownLeft: number
  mouthFrownRight: number
  mouthDimpleLeft: number
  mouthDimpleRight: number
  mouthLeft: number
  mouthPress: number
  mouthPressLeft: number
  mouthStretchLeft: number
  mouthStretchRight: number
  mouthShrugLower: number
  mouthShrugUpper: number
  mouthRollLower: number
  mouthRollUpper: number
  mouthPucker: number
  mouthFunnel: number
  mouthClose: number
  mouthUpperUpLeft: number
  mouthUpperUpRight: number

  // Nose expressions
  noseSneerLeft: number
  noseSneerRight: number

  // Cheek expressions
  cheekSquintLeft: number
  cheekSquintRight: number

  // Jaw expressions
  jawForward: number

  // Hand expressions (if supported)
  handFistLeft: number
  handFistRight: number

  // Body expressions (if supported)
  chestInhale: number

  // Head rotation (for gaze)
  headRotateX: number
  headRotateY: number
  headRotateZ: number

  // Eye rotation (for gaze)
  eyesRotateX: number
  eyesRotateY: number
}

export interface BlinkState {
  nextBlinkTime: number
  isBlinking: boolean
  blinkStartTime: number
}

export interface GazeNeckState {
  quaternions: {
    current: [number, number, number, number] | null
    default: [number, number, number, number] | null
  }
}

export interface TickState {
  currentTick: keyof FacialTarget | null
  tickStartTime: number
}

export interface GazeState {
  isGazing: boolean
  gazeTime: {
    start: number
    end: number
  }
  isPlayerVisible: boolean
  target: Vector3
  neckOptions: GazeNeckState
}

export interface EmoteState {
  targets: Partial<FacialTarget>
  currentEmotion: EmotionType
  isPerforming: boolean
  performanceStartTime: number
  relaxationTime: number

  // Animation state
  blinkState: BlinkState

  // Gaze state
  gazeState: GazeState

  // Facial ticks state
  tickState: TickState
  // Integration interfaces
  vrm?: VRM
  morphs?: { morphTargetInfluences: number[] }[]
  dictionary?: Record<string, number[]>
  bones?: Record<string, Bone>
  node?: Object3D // avatar
  camera?: Camera // viewer camera
}

// MoodConfiguration moved to emoteConfig.ts

export interface PerformanceData {
  emotion?: EmotionType
  whisper?: { words?: string[]; wtimes?: number[]; wdurations?: number[] } // Whisper data for lip sync coordination
  bcounter?: number // Utterance counter for gaze behavior
  bargein?: boolean // Interruption signal
  relaxTime?: number // Relaxation time 
}

// GazeOptions moved to emoteConfig.ts

export const createEmptyFacialTarget = (): Partial<FacialTarget> => ({
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  eyeSquintLeft: 0,
  eyeSquintRight: 0,
  eyeWideLeft: 0,
  eyeWideRight: 0,
  eyesLookDown: 0,
  eyesClosed: 0,
  browDownLeft: 0,
  browDownRight: 0,
  browInnerUp: 0,
  browOuterUpLeft: 0,
  browOuterUpRight: 0,
  mouthSmile: 0,
  mouthFrownLeft: 0,
  mouthFrownRight: 0,
  mouthDimpleLeft: 0,
  mouthDimpleRight: 0,
  mouthLeft: 0,
  mouthPress: 0,
  mouthPressLeft: 0,
  mouthStretchLeft: 0,
  mouthStretchRight: 0,
  mouthShrugLower: 0,
  mouthShrugUpper: 0,
  mouthRollLower: 0,
  mouthRollUpper: 0,
  mouthPucker: 0,
  mouthFunnel: 0,
  mouthClose: 0,
  mouthUpperUpLeft: 0,
  mouthUpperUpRight: 0,
  noseSneerLeft: 0,
  noseSneerRight: 0,
  cheekSquintLeft: 0,
  cheekSquintRight: 0,
  jawForward: 0,
  handFistLeft: 0,
  handFistRight: 0,
  chestInhale: 0,
  headRotateX: 0,
  headRotateY: 0,
  headRotateZ: 0,
  eyesRotateX: 0,
  eyesRotateY: 0
})
