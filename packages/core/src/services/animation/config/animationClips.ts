import type { AnimationClip } from '../animationTypes'
import * as THREE from 'three'

export const ANIMATION_CLIPS = {
  // Idle animations
  'idle_loop': {
    name: 'idle_loop',
    path: '/assets/animations/vrm/idle_loop.vrma',
    duration: 5000, // Will be updated from actual animation file
    weight: 1,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    loopCount: Infinity, // Infinite loops
    blendCurve: 'easeInOut',
    speed: 1
  },

  // Gesture animations
  
  'victory_sign': {
    name: 'victory_sign',
    path: '/assets/animations/vrm/victory_sign.vrma',
    duration: 2500, // Will be updated from actual animation file
    weight: 0.5,
    blendTime: 600,
    category: 'action',
    priority: 3,
    loopCount: 1,
    blendCurve: 'easeOut',
    speed: 0.8
  },
  'surprise_greet': {
    name: 'surprise_greet',
    path: '/assets/animations/vrm/surprise_greet.vrma',
    duration: 3000, // Will be updated from actual animation file
    weight: 0.6,
    blendTime: 700,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    blendCurve: 'easeInOut',
    speed: 0.9
  },
  'pose': {
    name: 'pose',
    path: '/assets/animations/vrm/pose.vrma',
    duration: 2000, // Will be updated from actual animation file
    weight: 0.3,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    blendCurve: 'easeInOut',
    speed: 1
  },
  'finger_gun': {
    name: 'finger_gun',
    path: '/assets/animations/vrm/finger_gun.vrma',
    duration: 2000, // Will be updated from actual animation file
    weight: 0.4,
    blendTime: 500,
    category: 'action',
    priority: 3,
    loopCount: 1,
    blendCurve: 'easeOut',
    speed: 1
  },
  // Action animations
  'dance_move': {
    name: 'dance_move',
    path: '/assets/animations/vrm/dance_move.vrma',
    duration: 3500, // Will be updated from actual animation file
    weight: 0.7,
    blendTime: 800,
    category: 'action',
    priority: 5,
    loopCount: 1,
    blendCurve: 'easeInOut',
    speed: 0.9
  },
} as Record<string, AnimationClip>

/**
 * Updates animation clip durations from the actual THREE.AnimationClip objects
 * This should be called after animations are loaded to ensure accurate durations
 */
export const updateAnimationDurations = (threeAnimations: THREE.AnimationClip[]): void => {
  threeAnimations.forEach((threeClip) => {
    const clipKey = Object.keys(ANIMATION_CLIPS).find(
      key => ANIMATION_CLIPS[key].name === threeClip.name
    ) 
    if (clipKey && threeClip.duration) {
      ANIMATION_CLIPS[clipKey].duration = Math.round(threeClip.duration * .6 * 1000) 
    }
  })
}

export const getAnimationClips = (): AnimationClip[] => {
  return Object.values(ANIMATION_CLIPS)
}

export const getClipsByCategory = (category: AnimationClip['category']): AnimationClip[] => {
  return Object.values(ANIMATION_CLIPS).filter((clip) => clip.category === category)
}

export const getRandomClip = (category?: AnimationClip['category']): AnimationClip => {
  const clips = category ? getClipsByCategory(category) : Object.values(ANIMATION_CLIPS)
  return clips[Math.floor(Math.random() * clips.length)]
}

export const getClipsByPriority = (priority: number): AnimationClip[] => {
  return Object.values(ANIMATION_CLIPS).filter((clip) => clip.priority <= priority)
}

// Type for animation keys
export type AnimationKey = keyof typeof ANIMATION_CLIPS

// Helper function to get animation by key
export const getAnimationByKey = (key: AnimationKey): AnimationClip => {
  return ANIMATION_CLIPS[key]
}
