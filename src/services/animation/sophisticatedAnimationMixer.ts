/**
 * Sophisticated Animation Mixer for Ready Player Me Animations
 * 
 * This advanced mixer system uses the master Animations.json index to provide
 * sophisticated animation blending, sequencing, and management capabilities.
 */

import { loadAnimationIndex, getCachedAnimationIndex } from './animationIndexLoader'
import type { AnimationEntry, AnimationIndex } from './animationIndexLoader'
import type { AnimationClip } from './animationTypes'

export interface AnimationData extends AnimationEntry {}

export interface AnimationSequence {
  id: string
  name: string
  animations: AnimationData[]
  totalDuration: number
  loop: boolean
}

export interface MixerProfile {
  name: string
  gender: 'masculine' | 'feminine'
  categoryWeights: Record<string, number>
  sequencePreferences: string[]
  blendingStyle: 'smooth' | 'sharp' | 'dynamic'
  transitionSpeed: number
  preferredTags?: string[]
}

export class SophisticatedAnimationMixer {
  private currentGender: 'masculine' | 'feminine' = 'masculine'
  private currentProfile: MixerProfile | null = null
  private animationCache = new Map<string, AnimationData>()
  private sequenceCache = new Map<string, AnimationSequence>()
  private currentAnimation: AnimationData | null = null
  private animationQueue: AnimationData[] = []
  private initialized = false

  constructor() {
    this.initializeAnimationCache()
  }

  /**
   * Initialize the animation cache from the master index
   */
  private async initializeAnimationCache(): Promise<void> {
    try {
      console.log('Loading animation index...')
      const animationIndex = await loadAnimationIndex()
      
      const animations = animationIndex.animations as Record<string, Record<string, Record<string, AnimationData>>>
      
      for (const gender of ['masculine', 'feminine'] as const) {
        if (animations[gender]) {
          for (const category of Object.keys(animations[gender])) {
            const categoryAnimations = animations[gender][category]
            for (const animName of Object.keys(categoryAnimations)) {
              const animData = categoryAnimations[animName] as AnimationData
              this.animationCache.set(animData.id, animData)
            }
          }
        }
      }

      this.initialized = true
      console.log(`Initialized animation mixer with ${this.animationCache.size} animations`)
    } catch (error) {
      console.error('Failed to initialize animation cache:', error)
      this.initialized = false
    }
  }

  /**
   * Set the gender for animation filtering
   */
  setGender(gender: 'masculine' | 'feminine'): void {
    this.currentGender = gender
    console.log(`Set animation gender to: ${gender}`)
  }

  /**
   * Set the mixer profile for intelligent animation selection
   */
  setProfile(profile: MixerProfile): void {
    this.currentProfile = profile
    this.currentGender = profile.gender
    console.log(`Set mixer profile: ${profile.name}`)
  }

  /**
   * Get all available animations
   */
  getAllAnimations(): AnimationData[] {
    return Array.from(this.animationCache.values())
  }

  /**
   * Check if mixer is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.initialized) return

    // Poll for initialization
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.initialized) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  /**
   * Get animations by gender
   */
  getAnimationsByGender(gender?: 'masculine' | 'feminine'): AnimationData[] {
    const targetGender = gender || this.currentGender
    return Array.from(this.animationCache.values()).filter(anim => anim.gender === targetGender)
  }

  /**
   * Get animations by category
   */
  getAnimationsByCategory(category: string, gender?: 'masculine' | 'feminine'): AnimationData[] {
    const targetGender = gender || this.currentGender
    return Array.from(this.animationCache.values()).filter(
      anim => anim.category === category && anim.gender === targetGender
    )
  }

  /**
   * Get animations by tags
   */
  getAnimationsByTags(tags: string[], gender?: 'masculine' | 'feminine'): AnimationData[] {
    const targetGender = gender || this.currentGender
    return Array.from(this.animationCache.values()).filter(
      anim => anim.gender === targetGender && 
        tags.some(tag => anim.tags.includes(tag))
    )
  }

  /**
   * Find animation by name or ID
   */
  findAnimation(query: string): AnimationData | null {
    // Try by ID first
    if (this.animationCache.has(query)) {
      return this.animationCache.get(query)!
    }

    // Try by name
    for (const anim of this.animationCache.values()) {
      if (anim.name === query || anim.displayName.toLowerCase() === query.toLowerCase()) {
        return anim
      }
    }

    return null
  }

  /**
   * Get a weighted random animation from a category
   */
  getRandomAnimationFromCategory(category: string): AnimationData | null {
    const animations = this.getAnimationsByCategory(category)
    if (animations.length === 0) return null

    // If we have a profile, use weighted selection
    if (this.currentProfile) {
      const categoryWeight = this.currentProfile.categoryWeights[category] || 1
      const weightedAnimations = animations.map(anim => ({
        ...anim,
        adjustedWeight: anim.weight * categoryWeight
      }))

      // Weighted random selection
      const totalWeight = weightedAnimations.reduce((sum, anim) => sum + anim.adjustedWeight, 0)
      let random = Math.random() * totalWeight
      
      for (const anim of weightedAnimations) {
        random -= anim.adjustedWeight
        if (random <= 0) {
          return anim
        }
      }
    }

    // Fallback to simple random
    return animations[Math.floor(Math.random() * animations.length)]
  }

  /**
   * Create an intelligent animation sequence
   */
  createSequence(
    name: string, 
    categories: string[], 
    options: {
      duration?: number
      transitionStyle?: 'smooth' | 'sharp' | 'dynamic'
      preferredTags?: string[]
      loop?: boolean
    } = {}
  ): AnimationSequence {
    const animations: AnimationData[] = []
    let totalDuration = 0

    for (const category of categories) {
      let candidateAnimations = this.getAnimationsByCategory(category)

      // Filter by preferred tags if specified
      if (options.preferredTags) {
        candidateAnimations = candidateAnimations.filter(anim =>
          options.preferredTags!.some(tag => anim.tags.includes(tag))
        )
      }

      // Select animation based on profile or random
      const selectedAnimation = this.selectAnimationFromCandidates(candidateAnimations)
      if (selectedAnimation) {
        animations.push(selectedAnimation)
        totalDuration += selectedAnimation.duration
      }
    }

    const sequence: AnimationSequence = {
      id: `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      animations,
      totalDuration,
      loop: options.loop || false
    }

    this.sequenceCache.set(sequence.id, sequence)
    return sequence
  }

  /**
   * Select the best animation from candidates based on profile
   */
  private selectAnimationFromCandidates(candidates: AnimationData[]): AnimationData | null {
    if (candidates.length === 0) return null

    if (!this.currentProfile) {
      return candidates[Math.floor(Math.random() * candidates.length)]
    }

    // Score animations based on profile preferences
    const scoredAnimations = candidates.map(anim => {
      let score = anim.weight

      // Boost score for preferred tags
      if (this.currentProfile!.preferredTags) {
        const tagMatches = this.currentProfile!.preferredTags.filter(tag => anim.tags.includes(tag)).length
        score += tagMatches * 0.5
      }

      // Adjust for category weight
      const categoryWeight = this.currentProfile!.categoryWeights[anim.category] || 1
      score *= categoryWeight

      return { animation: anim, score }
    })

    // Sort by score and select from top candidates with some randomness
    scoredAnimations.sort((a, b) => b.score - a.score)
    const topCandidates = scoredAnimations.slice(0, Math.min(3, scoredAnimations.length))
    
    return topCandidates[Math.floor(Math.random() * topCandidates.length)].animation
  }

  /**
   * Get animation statistics
   */
  getStatistics(): {
    totalAnimations: number
    animationsByGender: Record<string, number>
    animationsByCategory: Record<string, number>
    averageDuration: number
  } {
    const allAnimations = Array.from(this.animationCache.values())
    
    if (allAnimations.length === 0) {
      return {
        totalAnimations: 0,
        animationsByGender: {},
        animationsByCategory: {},
        averageDuration: 0
      }
    }
    
    const byGender = allAnimations.reduce((acc, anim) => {
      acc[anim.gender] = (acc[anim.gender] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byCategory = allAnimations.reduce((acc, anim) => {
      acc[anim.category] = (acc[anim.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const averageDuration = allAnimations.reduce((sum, anim) => sum + anim.duration, 0) / allAnimations.length

    return {
      totalAnimations: allAnimations.length,
      animationsByGender: byGender,
      animationsByCategory: byCategory,
      averageDuration
    }
  }

  /**
   * Convert AnimationData to legacy AnimationClip format
   */
  toAnimationClip(animData: AnimationData): AnimationClip {
    return {
      name: animData.displayName,
      path: animData.localPath,
      duration: animData.duration,
      weight: animData.weight,
      blendTime: animData.blendTime,
      category: animData.category as any,
      priority: animData.priority,
      speed: 1.0,
      loopCount: animData.loop ? Infinity : 1
    }
  }

  /**
   * Get current animation queue
   */
  getQueue(): AnimationData[] {
    return [...this.animationQueue]
  }

  /**
   * Add animation to queue
   */
  queueAnimation(animation: AnimationData): void {
    this.animationQueue.push(animation)
  }

  /**
   * Clear animation queue
   */
  clearQueue(): void {
    this.animationQueue = []
  }
}

// Predefined mixer profiles for common use cases
export const MIXER_PROFILES: Record<string, MixerProfile> = {
  'Professional Male': {
    name: 'Professional Male',
    gender: 'masculine',
    categoryWeights: {
      idle: 2.0,
      gesture: 1.5,
      communication: 1.8,
      expression: 1.2,
      movement: 1.0,
      action: 0.8
    },
    sequencePreferences: ['idle', 'gesture', 'communication'],
    blendingStyle: 'smooth',
    transitionSpeed: 1.0,
    preferredTags: ['professional', 'formal', 'calm']
  },

  'Casual Female': {
    name: 'Casual Female',
    gender: 'feminine',
    categoryWeights: {
      idle: 1.5,
      gesture: 1.8,
      expression: 2.0,
      communication: 1.6,
      movement: 1.2,
      action: 1.4
    },
    sequencePreferences: ['expression', 'gesture', 'communication'],
    blendingStyle: 'dynamic',
    transitionSpeed: 1.2,
    preferredTags: ['casual', 'friendly', 'expressive']
  },

  'Energetic Male': {
    name: 'Energetic Male',
    gender: 'masculine',
    categoryWeights: {
      action: 2.0,
      movement: 1.8,
      gesture: 1.6,
      expression: 1.4,
      communication: 1.2,
      idle: 0.8
    },
    sequencePreferences: ['action', 'movement', 'gesture'],
    blendingStyle: 'sharp',
    transitionSpeed: 1.5,
    preferredTags: ['energetic', 'dynamic', 'active']
  },

  'Graceful Female': {
    name: 'Graceful Female',
    gender: 'feminine',
    categoryWeights: {
      movement: 1.8,
      expression: 1.6,
      gesture: 1.5,
      action: 1.4,
      communication: 1.3,
      idle: 1.2
    },
    sequencePreferences: ['movement', 'expression', 'gesture'],
    blendingStyle: 'smooth',
    transitionSpeed: 0.8,
    preferredTags: ['graceful', 'elegant', 'smooth']
  }
}

// Singleton instance
let mixerInstance: SophisticatedAnimationMixer | null = null

export function useSophisticatedAnimationMixer(): SophisticatedAnimationMixer {
  if (!mixerInstance) {
    mixerInstance = new SophisticatedAnimationMixer()
  }
  return mixerInstance
}

export default SophisticatedAnimationMixer