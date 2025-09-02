/**
 * Advanced Animation Mixer Service
 * 
 * This service provides a comprehensive animation mixing system that integrates
 * the existing animation system with the Ready Player Me animation library.
 * It supports gender-specific animations, personality-based mixing, and 
 * intelligent animation sequencing.
 */

import * as THREE from 'three'
import type { AnimationClip, AnimationState, AnimationPerformanceData } from '../animationTypes'
import { ANIMATION_CLIPS } from '../config/animationClips'
import { 
  RPM_ANIMATION_LIBRARY, 
  RPM_ANIMATION_MIXERS, 
  getRPMAnimationsByGender,
  getRPMAnimationsByCategory,
  type RPMAnimationClip,
  type AnimationGender,
  type RPMAnimationMixer
} from '../config/rpmAnimationLibrary'
import { 
  EXTENDED_RPM_ANIMATIONS,
  getExtendedRPMAnimationsByCategory,
  getRandomExtendedRPMAnimation,
  getRPMLibraryStats
} from '../config/extendedRPMAnimations'

export interface EnhancedAnimationState extends AnimationState {
  // Enhanced properties for RPM integration
  currentGender: AnimationGender
  rpmMixerConfig: RPMAnimationMixer | null
  animationLibraryMode: 'local' | 'rpm' | 'mixed'
  
  // Caching for performance
  rpmAnimationCache: Map<string, RPMAnimationClip>
  genderFilteredAnimations: AnimationClip[]
  
  // Statistics
  stats: {
    totalAnimations: number
    rpmAnimations: number
    localAnimations: number
    byCategory: Record<string, number>
  }
}

export class RPMAnimationMixer {
  private state: EnhancedAnimationState
  private rpmAnimations: RPMAnimationClip[]
  private allAnimations: AnimationClip[]

  constructor(initialGender: AnimationGender = 'masculine') {
    this.rpmAnimations = [...RPM_ANIMATION_LIBRARY, ...EXTENDED_RPM_ANIMATIONS]
    this.allAnimations = ANIMATION_CLIPS
    
    // Initialize enhanced state
    this.state = this.initializeEnhancedState(initialGender)
    
    console.log('RPM Animation Mixer initialized:', this.getStatistics())
  }

  private initializeEnhancedState(gender: AnimationGender): EnhancedAnimationState {
    const stats = this.calculateStatistics()
    
    return {
      // Base animation state properties
      currentClip: null,
      nextClip: null,
      transitionProgress: 0,
      transitionDuration: 0,
      isTransitioning: false,
      lastChangeTime: 0,
      cycleInterval: 10000,
      randomizeInterval: false,
      enabled: true,
      cyclingState: {
        nextCycleTime: 0,
        isActive: true,
        currentPersonality: 'professional',
        lastCategory: 'idle'
      },
      cachedClips: [],
      queue: [],
      mixer: undefined,
      actions: undefined,
      avatar: undefined,

      // Enhanced properties
      currentGender: gender,
      rpmMixerConfig: this.getDefaultMixerConfig(gender),
      animationLibraryMode: 'mixed',
      rpmAnimationCache: new Map(),
      genderFilteredAnimations: this.getGenderFilteredAnimations(gender),
      stats
    }
  }

  private calculateStatistics() {
    const rpmStats = getRPMLibraryStats()
    const localAnimations = ANIMATION_CLIPS.filter(clip => 
      !this.rpmAnimations.some(rpm => rpm.name === clip.name)
    )

    return {
      totalAnimations: ANIMATION_CLIPS.length,
      rpmAnimations: rpmStats.total,
      localAnimations: localAnimations.length,
      byCategory: rpmStats.byCategory
    }
  }

  private getDefaultMixerConfig(gender: AnimationGender): RPMAnimationMixer {
    return RPM_ANIMATION_MIXERS.find(mixer => 
      mixer.gender === gender && mixer.name.includes('Professional')
    ) || RPM_ANIMATION_MIXERS[0]
  }

  private getGenderFilteredAnimations(gender: AnimationGender): AnimationClip[] {
    // Get RPM animations for the specified gender
    const rpmForGender = this.rpmAnimations
      .filter(rpm => rpm.gender === gender)
      .map(rpm => ({
        name: rpm.name,
        path: rpm.localPath || rpm.remotePath,
        duration: rpm.duration,
        weight: rpm.weight,
        blendTime: rpm.blendTime,
        category: rpm.category,
        priority: rpm.priority,
        speed: rpm.speed,
        loopCount: rpm.loopCount,
        blendCurve: rpm.blendCurve
      }))

    // Combine with local animations
    const localAnimations = ANIMATION_CLIPS.filter(clip => 
      !this.rpmAnimations.some(rpm => rpm.name === clip.name)
    )

    return [...localAnimations, ...rpmForGender]
  }

  /**
   * Set the avatar gender and update available animations
   */
  public setGender(gender: AnimationGender): void {
    this.state.currentGender = gender
    this.state.rpmMixerConfig = this.getDefaultMixerConfig(gender)
    this.state.genderFilteredAnimations = this.getGenderFilteredAnimations(gender)
    this.state.cachedClips = this.state.genderFilteredAnimations
    
    console.log(`Animation mixer set to ${gender} gender:`, {
      availableAnimations: this.state.genderFilteredAnimations.length,
      mixerConfig: this.state.rpmMixerConfig?.name
    })
  }

  /**
   * Set animation library mode
   */
  public setLibraryMode(mode: 'local' | 'rpm' | 'mixed'): void {
    this.state.animationLibraryMode = mode
    
    switch (mode) {
      case 'local':
        this.state.cachedClips = ANIMATION_CLIPS.filter(clip => 
          !this.rpmAnimations.some(rpm => rpm.name === clip.name)
        )
        break
      case 'rpm':
        this.state.cachedClips = this.getGenderFilteredAnimations(this.state.currentGender)
          .filter(clip => this.rpmAnimations.some(rpm => rpm.name === clip.name))
        break
      case 'mixed':
      default:
        this.state.cachedClips = this.state.genderFilteredAnimations
        break
    }
    
    console.log(`Animation library mode set to ${mode}:`, {
      availableAnimations: this.state.cachedClips.length
    })
  }

  /**
   * Set RPM mixer configuration
   */
  public setMixerConfig(mixerName: string): boolean {
    const mixer = RPM_ANIMATION_MIXERS.find(m => m.name === mixerName)
    if (!mixer) {
      console.warn(`RPM mixer config '${mixerName}' not found`)
      return false
    }

    this.state.rpmMixerConfig = mixer
    this.state.currentGender = mixer.gender
    this.state.cycleInterval = mixer.cycleInterval
    
    // Update available animations based on mixer categories
    const mixerAnimations = this.state.genderFilteredAnimations.filter(clip =>
      mixer.categories.includes(clip.category as any)
    )
    
    this.state.cachedClips = mixerAnimations
    
    console.log(`RPM mixer config applied: ${mixerName}`, {
      gender: mixer.gender,
      categories: mixer.categories,
      availableAnimations: mixerAnimations.length
    })
    
    return true
  }

  /**
   * Get animation by category with gender filtering
   */
  public getAnimationsByCategory(category: string, useRPMWeights: boolean = true) {
    let animations = this.state.cachedClips.filter(clip => clip.category === category)
    
    if (useRPMWeights && this.state.rpmMixerConfig) {
      // Apply RPM mixer weights
      const categoryWeight = this.state.rpmMixerConfig.weights[category as keyof typeof this.state.rpmMixerConfig.weights]
      if (categoryWeight && categoryWeight > 0) {
        // Boost animations of this category
        animations = animations.map(anim => ({
          ...anim,
          weight: anim.weight * (categoryWeight / 10) // Normalize weight
        }))
      }
    }
    
    return animations
  }

  /**
   * Get a random animation with intelligent selection
   */
  public getRandomAnimation(category?: string, usePersonality: boolean = true): AnimationClip | null {
    let candidateAnimations = this.state.cachedClips
    
    if (category) {
      candidateAnimations = this.getAnimationsByCategory(category, usePersonality)
    }
    
    if (candidateAnimations.length === 0) {
      return null
    }
    
    // Weighted random selection
    const totalWeight = candidateAnimations.reduce((sum, anim) => sum + anim.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const animation of candidateAnimations) {
      random -= animation.weight
      if (random <= 0) {
        return animation
      }
    }
    
    // Fallback to last animation
    return candidateAnimations[candidateAnimations.length - 1]
  }

  /**
   * Queue an RPM animation by ID
   */
  public queueRPMAnimation(rpmId: string, overrides?: Partial<AnimationPerformanceData>): boolean {
    const rpmAnimation = this.rpmAnimations.find(rpm => 
      rpm.rpmId === rpmId && rpm.gender === this.state.currentGender
    )
    
    if (!rpmAnimation) {
      console.warn(`RPM animation '${rpmId}' not found for gender '${this.state.currentGender}'`)
      return false
    }
    
    const animationClip = this.state.cachedClips.find(clip => clip.name === rpmAnimation.name)
    if (!animationClip) {
      console.warn(`Animation clip '${rpmAnimation.name}' not found in current library`)
      return false
    }
    
    const performanceData: AnimationPerformanceData = {
      name: rpmAnimation.name,
      category: rpmAnimation.category,
      duration: rpmAnimation.duration,
      loopCount: rpmAnimation.loopCount,
      blendTime: rpmAnimation.blendTime,
      speed: rpmAnimation.speed,
      immediate: false,
      ...overrides
    }
    
    // Queue the animation (this would integrate with the existing animation service)
    if (!this.state.queue) this.state.queue = []
    this.state.queue.push({
      clip: animationClip,
      blendTime: performanceData.blendTime || rpmAnimation.blendTime
    })
    
    console.log(`Queued RPM animation: ${rpmId} (${rpmAnimation.name})`)
    return true
  }

  /**
   * Get available mixer configurations
   */
  public getAvailableMixers(): RPMAnimationMixer[] {
    return RPM_ANIMATION_MIXERS
  }

  /**
   * Get current state and statistics
   */
  public getState(): EnhancedAnimationState {
    return this.state
  }

  /**
   * Get comprehensive statistics
   */
  public getStatistics() {
    return {
      ...this.state.stats,
      currentGender: this.state.currentGender,
      libraryMode: this.state.animationLibraryMode,
      mixerConfig: this.state.rpmMixerConfig?.name,
      cachedAnimations: this.state.cachedClips.length,
      queueLength: this.state.queue?.length || 0,
      rpmLibraryStats: getRPMLibraryStats()
    }
  }

  /**
   * Validate animation availability
   */
  public validateAnimationAvailability(): {
    valid: AnimationClip[]
    invalid: AnimationClip[]
    missing: string[]
  } {
    const valid: AnimationClip[] = []
    const invalid: AnimationClip[] = []
    const missingRPM: string[] = []
    
    for (const clip of this.state.cachedClips) {
      // Check if this is an RPM animation
      const rpmAnim = this.rpmAnimations.find(rpm => rpm.name === clip.name)
      
      if (rpmAnim) {
        // For RPM animations, we assume they're available remotely
        // In a real implementation, you'd want to check if they're locally cached
        if (rpmAnim.localPath || rpmAnim.remotePath) {
          valid.push(clip)
        } else {
          invalid.push(clip)
          missingRPM.push(rpmAnim.rpmId)
        }
      } else {
        // For local animations, add validation logic as needed
        valid.push(clip) // Assume local animations are available
      }
    }
    
    return {
      valid,
      invalid,
      missing: missingRPM
    }
  }

  /**
   * Export configuration for persistence
   */
  public exportConfig() {
    return {
      gender: this.state.currentGender,
      mixerConfig: this.state.rpmMixerConfig?.name,
      libraryMode: this.state.animationLibraryMode,
      cycleInterval: this.state.cycleInterval,
      enabled: this.state.enabled
    }
  }

  /**
   * Import configuration
   */
  public importConfig(config: any): boolean {
    try {
      if (config.gender) {
        this.setGender(config.gender)
      }
      
      if (config.mixerConfig) {
        this.setMixerConfig(config.mixerConfig)
      }
      
      if (config.libraryMode) {
        this.setLibraryMode(config.libraryMode)
      }
      
      if (typeof config.cycleInterval === 'number') {
        this.state.cycleInterval = config.cycleInterval
      }
      
      if (typeof config.enabled === 'boolean') {
        this.state.enabled = config.enabled
      }
      
      console.log('RPM Animation Mixer configuration imported successfully')
      return true
    } catch (error) {
      console.error('Failed to import RPM Animation Mixer configuration:', error)
      return false
    }
  }
}

/**
 * Global RPM Animation Mixer instance
 * This can be used throughout the application for centralized animation management
 */
export const globalRPMAnimationMixer = new RPMAnimationMixer()

/**
 * Hook-like function to get the global mixer instance
 */
export function useRPMAnimationMixer(): RPMAnimationMixer {
  return globalRPMAnimationMixer
}