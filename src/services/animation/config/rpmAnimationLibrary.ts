import type { AnimationClip } from '../animationTypes'

/**
 * Ready Player Me Animation Library Integration
 * Source: https://github.com/readyplayerme/animation-library
 * 
 * This file creates an index of the 400+ free animations from RPM's animation library,
 * organized by gender (masculine/feminine) and categories for seamless integration
 * with the existing animation system.
 */

// Base URL for RPM animation library
const RPM_BASE_URL = 'https://github.com/readyplayerme/animation-library/raw/master'

/**
 * RPM Animation Categories based on their library structure
 */
export type RPMAnimationCategory = 
  | 'idle' 
  | 'gesture' 
  | 'movement' 
  | 'expression' 
  | 'action' 
  | 'communication'
  | 'dance'
  | 'sport'
  | 'fighting'
  | 'emote'

/**
 * Gender variants for animations
 */
export type AnimationGender = 'masculine' | 'feminine'

/**
 * Extended animation clip interface for RPM animations
 */
export interface RPMAnimationClip extends Omit<AnimationClip, 'path'> {
  gender: AnimationGender
  rpmId: string // Original RPM animation ID
  remotePath: string // Remote URL path
  localPath?: string // Local cached path (when downloaded)
  description?: string
  tags?: string[]
}

/**
 * RPM Animation Library Index
 * This comprehensive list includes animations from both masculine and feminine categories
 * from the Ready Player Me animation library
 */
export const RPM_ANIMATION_LIBRARY: RPMAnimationClip[] = [
  // === IDLE ANIMATIONS ===
  {
    name: 'RPM Idle',
    rpmId: 'idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/idle.glb`,
    duration: 5000,
    weight: 1,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    speed: 1,
    loopCount: Infinity,
    blendCurve: 'easeInOut',
    description: 'Standard idle pose',
    tags: ['basic', 'loop']
  },
  {
    name: 'RPM Casual Idle',
    rpmId: 'casual_idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/casual_idle.glb`,
    duration: 6000,
    weight: 0.8,
    blendTime: 1200,
    category: 'idle',
    priority: 1,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Relaxed casual idle stance'
  },
  {
    name: 'RPM Breathing Idle',
    rpmId: 'breathing_idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/breathing_idle.glb`,
    duration: 4000,
    weight: 0.9,
    blendTime: 800,
    category: 'idle',
    priority: 1,
    speed: 1,
    loopCount: Infinity,
    description: 'Subtle breathing idle animation'
  },

  // Feminine idle animations
  {
    name: 'RPM Feminine Idle',
    rpmId: 'idle',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/idle.glb`,
    duration: 5000,
    weight: 1,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    speed: 1,
    loopCount: Infinity,
    description: 'Standard feminine idle pose'
  },
  {
    name: 'RPM Feminine Casual Idle',
    rpmId: 'casual_idle',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/casual_idle.glb`,
    duration: 6000,
    weight: 0.8,
    blendTime: 1200,
    category: 'idle',
    priority: 1,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Relaxed feminine casual idle'
  },

  // === GESTURE ANIMATIONS ===
  {
    name: 'RPM Wave',
    rpmId: 'wave',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/wave.glb`,
    duration: 3000,
    weight: 0.7,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Friendly waving gesture'
  },
  {
    name: 'RPM Point',
    rpmId: 'point',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/point.glb`,
    duration: 2500,
    weight: 0.6,
    blendTime: 400,
    category: 'gesture',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Pointing gesture'
  },
  {
    name: 'RPM Thumbs Up',
    rpmId: 'thumbs_up',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/thumbs_up.glb`,
    duration: 2000,
    weight: 0.5,
    blendTime: 300,
    category: 'gesture',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Thumbs up approval gesture'
  },
  {
    name: 'RPM Clap',
    rpmId: 'clap',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/clap.glb`,
    duration: 3000,
    weight: 0.4,
    blendTime: 500,
    category: 'gesture',
    priority: 3,
    speed: 1,
    loopCount: 3,
    description: 'Applauding gesture'
  },

  // Feminine gestures
  {
    name: 'RPM Feminine Wave',
    rpmId: 'wave',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/wave.glb`,
    duration: 3000,
    weight: 0.7,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Elegant feminine wave'
  },
  {
    name: 'RPM Feminine Gesture',
    rpmId: 'elegant_gesture',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/elegant_gesture.glb`,
    duration: 4000,
    weight: 0.6,
    blendTime: 600,
    category: 'gesture',
    priority: 2,
    speed: 0.8,
    loopCount: 1,
    description: 'Elegant hand gesture'
  },

  // === MOVEMENT ANIMATIONS ===
  {
    name: 'RPM Walk',
    rpmId: 'walk',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/walk.glb`,
    duration: 2000,
    weight: 0.8,
    blendTime: 800,
    category: 'movement',
    priority: 2,
    speed: 1,
    loopCount: Infinity,
    description: 'Standard walking cycle'
  },
  {
    name: 'RPM Run',
    rpmId: 'run',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/run.glb`,
    duration: 1500,
    weight: 0.9,
    blendTime: 600,
    category: 'movement',
    priority: 3,
    speed: 1.2,
    loopCount: Infinity,
    description: 'Running cycle'
  },
  {
    name: 'RPM Turn Left',
    rpmId: 'turn_left',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/turn_left.glb`,
    duration: 1500,
    weight: 0.7,
    blendTime: 400,
    category: 'movement',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Turn left movement'
  },
  {
    name: 'RPM Turn Right',
    rpmId: 'turn_right',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/turn_right.glb`,
    duration: 1500,
    weight: 0.7,
    blendTime: 400,
    category: 'movement',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Turn right movement'
  },

  // Feminine movements
  {
    name: 'RPM Feminine Walk',
    rpmId: 'walk',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/walk.glb`,
    duration: 2200,
    weight: 0.8,
    blendTime: 800,
    category: 'movement',
    priority: 2,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Elegant feminine walk'
  },

  // === EXPRESSION ANIMATIONS ===
  {
    name: 'RPM Thinking',
    rpmId: 'thinking',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/thinking.glb`,
    duration: 4000,
    weight: 0.8,
    blendTime: 700,
    category: 'expression',
    priority: 2,
    speed: 0.8,
    loopCount: 1,
    description: 'Thoughtful contemplation'
  },
  {
    name: 'RPM Surprised',
    rpmId: 'surprised',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/surprised.glb`,
    duration: 2000,
    weight: 0.5,
    blendTime: 300,
    category: 'expression',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Surprise reaction'
  },
  {
    name: 'RPM Laugh',
    rpmId: 'laugh',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/laugh.glb`,
    duration: 3500,
    weight: 0.6,
    blendTime: 500,
    category: 'expression',
    priority: 3,
    speed: 1,
    loopCount: 1,
    description: 'Laughter expression'
  },
  {
    name: 'RPM Confused',
    rpmId: 'confused',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/confused.glb`,
    duration: 3000,
    weight: 0.4,
    blendTime: 600,
    category: 'expression',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Confused expression'
  },

  // Feminine expressions
  {
    name: 'RPM Feminine Smile',
    rpmId: 'smile',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/smile.glb`,
    duration: 2500,
    weight: 0.7,
    blendTime: 400,
    category: 'expression',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Warm smile'
  },

  // === ACTION ANIMATIONS ===
  {
    name: 'RPM Dance',
    rpmId: 'dance',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/dance.glb`,
    duration: 8000,
    weight: 0.8,
    blendTime: 1200,
    category: 'action',
    priority: 4,
    speed: 1,
    loopCount: 2,
    description: 'Dance movement'
  },
  {
    name: 'RPM Bow',
    rpmId: 'bow',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/bow.glb`,
    duration: 3000,
    weight: 0.6,
    blendTime: 600,
    category: 'action',
    priority: 3,
    speed: 1,
    loopCount: 1,
    description: 'Respectful bow'
  },
  {
    name: 'RPM Salute',
    rpmId: 'salute',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/salute.glb`,
    duration: 2500,
    weight: 0.5,
    blendTime: 500,
    category: 'action',
    priority: 3,
    speed: 1,
    loopCount: 1,
    description: 'Military salute'
  },

  // === COMMUNICATION ANIMATIONS ===
  {
    name: 'RPM Talk',
    rpmId: 'talk',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/talk.glb`,
    duration: 4000,
    weight: 0.8,
    blendTime: 500,
    category: 'communication',
    priority: 1,
    speed: 1,
    loopCount: 2,
    description: 'Speaking gestures'
  },
  {
    name: 'RPM Explain',
    rpmId: 'explain',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/explain.glb`,
    duration: 5000,
    weight: 0.7,
    blendTime: 600,
    category: 'communication',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Explanatory gestures'
  },
  {
    name: 'RPM Present',
    rpmId: 'present',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/present.glb`,
    duration: 4500,
    weight: 0.6,
    blendTime: 700,
    category: 'communication',
    priority: 2,
    speed: 1,
    loopCount: 1,
    description: 'Presentation gestures'
  },

  // Feminine communication
  {
    name: 'RPM Feminine Talk',
    rpmId: 'talk',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/talk.glb`,
    duration: 4200,
    weight: 0.8,
    blendTime: 500,
    category: 'communication',
    priority: 1,
    speed: 0.95,
    loopCount: 2,
    description: 'Feminine speaking gestures'
  }

  // Note: This is a representative sample. The actual RPM library contains 400+ animations
  // This structure can be extended to include all animations from the library
]

/**
 * Utility functions for working with RPM animations
 */

export function getRPMAnimationsByGender(gender: AnimationGender): RPMAnimationClip[] {
  return RPM_ANIMATION_LIBRARY.filter(anim => anim.gender === gender)
}

export function getRPMAnimationsByCategory(category: RPMAnimationCategory, gender?: AnimationGender): RPMAnimationClip[] {
  let filtered = RPM_ANIMATION_LIBRARY.filter(anim => anim.category === category)
  if (gender) {
    filtered = filtered.filter(anim => anim.gender === gender)
  }
  return filtered
}

export function getRPMAnimationById(rpmId: string, gender: AnimationGender): RPMAnimationClip | undefined {
  return RPM_ANIMATION_LIBRARY.find(anim => anim.rpmId === rpmId && anim.gender === gender)
}

export function convertRPMToAnimationClips(rpmAnimations: RPMAnimationClip[]): AnimationClip[] {
  return rpmAnimations.map(rpmAnim => ({
    name: rpmAnim.name,
    path: rpmAnim.localPath || rpmAnim.remotePath,
    duration: rpmAnim.duration,
    weight: rpmAnim.weight,
    blendTime: rpmAnim.blendTime,
    category: rpmAnim.category,
    priority: rpmAnim.priority,
    speed: rpmAnim.speed,
    loopCount: rpmAnim.loopCount,
    blendCurve: rpmAnim.blendCurve
  }))
}

/**
 * Animation mixer configuration for different personalities/contexts
 */
export interface RPMAnimationMixer {
  name: string
  description: string
  gender: AnimationGender
  categories: RPMAnimationCategory[]
  weights: Record<RPMAnimationCategory, number>
  defaultBlendTime: number
  cycleInterval: number
}

export const RPM_ANIMATION_MIXERS: RPMAnimationMixer[] = [
  {
    name: 'Professional Male',
    description: 'Professional masculine avatar animations',
    gender: 'masculine',
    categories: ['idle', 'gesture', 'communication', 'expression'],
    weights: {
      idle: 40,
      gesture: 25,
      communication: 20,
      expression: 15,
      movement: 0,
      action: 0,
      dance: 0,
      sport: 0,
      fighting: 0,
      emote: 0
    },
    defaultBlendTime: 800,
    cycleInterval: 8000
  },
  {
    name: 'Professional Female',
    description: 'Professional feminine avatar animations',
    gender: 'feminine',
    categories: ['idle', 'gesture', 'communication', 'expression'],
    weights: {
      idle: 35,
      gesture: 30,
      communication: 25,
      expression: 10,
      movement: 0,
      action: 0,
      dance: 0,
      sport: 0,
      fighting: 0,
      emote: 0
    },
    defaultBlendTime: 900,
    cycleInterval: 7500
  },
  {
    name: 'Casual Male',
    description: 'Casual masculine avatar with varied animations',
    gender: 'masculine',
    categories: ['idle', 'gesture', 'movement', 'expression', 'action'],
    weights: {
      idle: 25,
      gesture: 20,
      movement: 15,
      expression: 20,
      action: 20,
      communication: 0,
      dance: 0,
      sport: 0,
      fighting: 0,
      emote: 0
    },
    defaultBlendTime: 600,
    cycleInterval: 10000
  },
  {
    name: 'Casual Female',
    description: 'Casual feminine avatar with varied animations',
    gender: 'feminine',
    categories: ['idle', 'gesture', 'movement', 'expression', 'action'],
    weights: {
      idle: 20,
      gesture: 25,
      movement: 15,
      expression: 25,
      action: 15,
      communication: 0,
      dance: 0,
      sport: 0,
      fighting: 0,
      emote: 0
    },
    defaultBlendTime: 700,
    cycleInterval: 9000
  }
]