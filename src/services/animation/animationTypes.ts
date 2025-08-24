import * as THREE from 'three'

export type AnimationCategory = 'idle' | 'gesture' | 'movement' | 'expression' | 'action' | 'communication'

export type BlendCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic'

export interface AnimationClip {
  name: string
  path: string
  duration: number
  weight: number
  blendTime: number
  category: AnimationCategory
  priority: number
  speed: number
  // Loop configuration
  loopCount: number // Infinity = infinite loops, 1 = once, 2+ = specific count (defaults to Infinity for idle, 1 for others)

  // Blending configuration
  blendCurve?: BlendCurve // Easing function for transitions (defaults to 'linear')
}

export interface AnimationState {
  // Active animation clips
  currentClip: AnimationClip | null
  nextClip: AnimationClip | null

  // Transition info
  transitionProgress: number
  transitionDuration: number
  isTransitioning: boolean

  // Timing
  lastChangeTime: number

  // Cycling control
  cycleInterval: number
  randomizeInterval: boolean
  enabled: boolean

  // Personality & sequence control
  cyclingState: {
    nextCycleTime: number
    isActive: boolean
    currentPersonality: string
    lastCategory?: AnimationCategory
  }

  // Cache for personality-specific clips
  cachedClips: AnimationClip[]

  // Pending animations queue
  queue?: { clip: AnimationClip; blendTime: number }[]

  // Core Three.js integration
  mixer?: THREE.AnimationMixer
  actions?: Record<string, THREE.AnimationAction>
  avatar?: THREE.Object3D
}

export interface PersonalityConfiguration {
  defaultCycleInterval: number
  blendTime: number
  randomizeOrder: boolean
  categories: AnimationCategory[]
  weights: {
    idle: number
    gesture: number
    movement: number
    expression: number
    action: number
    communication: number
  }
}

export interface AnimationPerformanceData {
  personality?: string
  name: string
  category?: AnimationCategory
  duration?: number
  immediate?: boolean
  loopCount?: number
  blendTime?: number
  speed?: number
}
