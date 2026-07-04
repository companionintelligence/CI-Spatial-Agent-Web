import * as THREE from 'three'

export type AnimationCategory = 'idle' | 'gesture' | 'movement' | 'expression' | 'action' | 'communication'

export type BlendCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic'

export interface AnimationClip {
  name: string
  path: string
  duration: number // populated by the actual animation file
  weight: number
  blendTime: number
  category: AnimationCategory
  priority: number
  speed: number
  // Loop configuration
  loopCount: number // Infinity = infinite loops, 1 = once, 2+ = specific count (defaults to Infinity for idle, 1 for others)

  // Blending configuration
  blendCurve?: BlendCurve // Advisory easing hint (native crossFadeTo ramps linearly; reserved for future additive layering)

  // Blend mode. 'normal' replaces the base pose; 'additive' layers on top of the current base clip.
  // Additive requires the action to be created with THREE.AdditiveAnimationBlendMode and an
  // additive clip (see makeAdditiveClip); defaults to 'normal'.
  blendMode?: 'normal' | 'additive'
}

export interface AnimationState {
  enabled: boolean
  // Active animation clips
  currentClip: AnimationClip | null
  nextClip: AnimationClip | null

  // Transition info
  transitionProgress: number
  transitionDuration: number
  isTransitioning: boolean

  // Timing
  lastChangeTime: number
  currentPersonality: string

  // Cycling control


  // Personality & sequence control
  cyclingState: {
    nextCycleTime: number
    isActive: boolean
    cycleInterval: number
    randomizeInterval: boolean
    cyclingEnabled: boolean
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

  // Name of the action currently fading out during a native crossfade, so its
  // 'finished' event is ignored and it can be stopped once the fade completes.
  previousClipName?: string

  // Bound mixer 'finished' listener, retained so it can be detached on reset/re-setup.
  mixerFinishedListener?: THREE.EventListener<THREE.AnimationMixerEventMap['finished'], 'finished', THREE.AnimationMixer>
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
  clip: AnimationClip
  immediate?: boolean
  loopCount?: number
  blendTime?: number
  speed?: number
}
