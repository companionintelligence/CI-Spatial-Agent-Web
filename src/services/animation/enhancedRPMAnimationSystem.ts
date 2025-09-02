/**
 * Enhanced RPM Animation System
 * 
 * A sophisticated animation system that uses the master Animations.json index
 * and provides advanced animation management, GLB asset loading, and intelligent mixing.
 */

import type { AnimationState, AnimationPerformanceData } from './animationTypes'
import { SophisticatedAnimationMixer, useSophisticatedAnimationMixer, MIXER_PROFILES } from './sophisticatedAnimationMixer'
import type { AnimationData, AnimationSequence, MixerProfile } from './sophisticatedAnimationMixer'
import { loadAnimationIndex, getCachedAnimationIndex } from './animationIndexLoader'
import type { AnimationIndex } from './animationIndexLoader'

export interface EnhancedRPMConfig {
  gender: 'masculine' | 'feminine'
  profile: string | MixerProfile
  autoLoadAssets: boolean
  preferLocalAssets: boolean
  enableSequencing: boolean
  cacheSize: number
  fallbackToRemote: boolean
}

export interface AnimationAsset {
  id: string
  url: string
  loaded: boolean
  loading: boolean
  error?: string
  glbData?: any
}

export interface SystemStatus {
  initialized: boolean
  totalAnimations: number
  loadedAssets: number
  currentGender: 'masculine' | 'feminine'
  currentProfile: string
  queueLength: number
  statistics: any
}

export class EnhancedRPMAnimationSystem {
  private mixer: SophisticatedAnimationMixer
  private config: EnhancedRPMConfig
  private assetCache = new Map<string, AnimationAsset>()
  private currentSequence: AnimationSequence | null = null
  private isInitialized = false
  private loadingPromises = new Map<string, Promise<void>>()

  constructor(config: Partial<EnhancedRPMConfig> = {}) {
    this.config = {
      gender: 'masculine',
      profile: 'Professional Male',
      autoLoadAssets: false,
      preferLocalAssets: true,
      enableSequencing: true,
      cacheSize: 100,
      fallbackToRemote: true,
      ...config
    }

    this.mixer = useSophisticatedAnimationMixer()
    this.initialize()
  }

  /**
   * Initialize the animation system
   */
  private async initialize(): Promise<void> {
    console.log('Initializing Enhanced RPM Animation System...', this.config)

    // Wait for mixer initialization
    await this.mixer.waitForInitialization()

    // Configure mixer
    this.mixer.setGender(this.config.gender)
    
    // Set profile
    if (typeof this.config.profile === 'string') {
      const profile = MIXER_PROFILES[this.config.profile]
      if (profile) {
        this.mixer.setProfile(profile)
      }
    } else {
      this.mixer.setProfile(this.config.profile)
    }

    // Pre-load essential animations if enabled
    if (this.config.autoLoadAssets) {
      await this.preloadEssentialAnimations()
    }

    this.isInitialized = true
    console.log('Enhanced RPM Animation System initialized successfully')
  }

  /**
   * Pre-load essential animations (idle, basic gestures)
   */
  private async preloadEssentialAnimations(): Promise<void> {
    const essentialCategories = ['idle', 'gesture']
    const promises: Promise<void>[] = []

    for (const category of essentialCategories) {
      const animations = this.mixer.getAnimationsByCategory(category)
      for (const anim of animations.slice(0, 3)) { // Load first 3 from each category
        promises.push(this.loadAnimationAsset(anim))
      }
    }

    try {
      await Promise.all(promises)
      console.log('Essential animations preloaded successfully')
    } catch (error) {
      console.warn('Failed to preload some essential animations:', error)
    }
  }

  /**
   * Load an animation asset (GLB file)
   */
  async loadAnimationAsset(animation: AnimationData): Promise<void> {
    if (this.assetCache.has(animation.id)) {
      const cached = this.assetCache.get(animation.id)!
      if (cached.loaded || cached.loading) return
    }

    // Check if already loading
    if (this.loadingPromises.has(animation.id)) {
      return this.loadingPromises.get(animation.id)!
    }

    const loadPromise = this.doLoadAnimationAsset(animation)
    this.loadingPromises.set(animation.id, loadPromise)
    
    try {
      await loadPromise
    } finally {
      this.loadingPromises.delete(animation.id)
    }
  }

  /**
   * Actually load the animation asset
   */
  private async doLoadAnimationAsset(animation: AnimationData): Promise<void> {
    console.log(`Loading animation asset: ${animation.displayName}`)

    const asset: AnimationAsset = {
      id: animation.id,
      url: this.config.preferLocalAssets ? animation.localPath : animation.remotePath,
      loaded: false,
      loading: true
    }

    this.assetCache.set(animation.id, asset)

    try {
      // Try to load the asset
      const response = await fetch(asset.url)
      
      if (!response.ok) {
        // Fallback to remote if local fails and fallback is enabled
        if (this.config.fallbackToRemote && this.config.preferLocalAssets) {
          console.log(`Local asset failed, trying remote for: ${animation.displayName}`)
          const remoteResponse = await fetch(animation.remotePath)
          
          if (!remoteResponse.ok) {
            throw new Error(`Failed to load asset from both local and remote: ${response.status}`)
          }
          
          asset.glbData = await remoteResponse.arrayBuffer()
          asset.url = animation.remotePath
        } else {
          throw new Error(`Failed to load asset: ${response.status}`)
        }
      } else {
        asset.glbData = await response.arrayBuffer()
      }

      asset.loaded = true
      asset.loading = false
      console.log(`Successfully loaded: ${animation.displayName}`)

    } catch (error) {
      asset.loading = false
      asset.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to load animation asset: ${animation.displayName}`, error)
      
      // Keep the asset in cache even if failed for retry logic
    }
  }

  /**
   * Play a specific animation
   */
  async playAnimation(
    query: string,
    options: {
      immediate?: boolean
      speed?: number
      loop?: boolean
      preload?: boolean
    } = {}
  ): Promise<boolean> {
    const animation = this.mixer.findAnimation(query)
    if (!animation) {
      console.warn(`Animation not found: ${query}`)
      return false
    }

    // Load asset if needed
    if (options.preload !== false) {
      await this.loadAnimationAsset(animation)
    }

    // Check if asset is available
    const asset = this.assetCache.get(animation.id)
    if (!asset || !asset.loaded) {
      console.warn(`Animation asset not loaded: ${animation.displayName}`)
      return false
    }

    console.log(`Playing animation: ${animation.displayName}`)
    
    // Here you would integrate with your actual animation system
    // For now, we'll just log the action
    // this.animationService.playClip(this.mixer.toAnimationClip(animation), options)

    return true
  }

  /**
   * Play a random animation from category
   */
  async playRandomFromCategory(category: string): Promise<boolean> {
    const animation = this.mixer.getRandomAnimationFromCategory(category)
    if (!animation) {
      console.warn(`No animations found in category: ${category}`)
      return false
    }

    return this.playAnimation(animation.id)
  }

  /**
   * Create and play an animation sequence
   */
  async createAndPlaySequence(
    name: string,
    categories: string[],
    options: {
      duration?: number
      loop?: boolean
      preload?: boolean
    } = {}
  ): Promise<AnimationSequence | null> {
    if (!this.config.enableSequencing) {
      console.warn('Animation sequencing is disabled')
      return null
    }

    const sequence = this.mixer.createSequence(name, categories, options)
    this.currentSequence = sequence

    // Preload all animations in the sequence
    if (options.preload !== false) {
      const loadPromises = sequence.animations.map(anim => this.loadAnimationAsset(anim))
      await Promise.all(loadPromises)
    }

    console.log(`Created sequence: ${sequence.name} with ${sequence.animations.length} animations`)
    
    // Play the sequence
    // Implementation would depend on your animation system
    for (const animation of sequence.animations) {
      console.log(`Sequence step: ${animation.displayName}`)
      // await this.playAnimation(animation.id, { immediate: false })
    }

    return sequence
  }

  /**
   * Set the current gender
   */
  setGender(gender: 'masculine' | 'feminine'): void {
    this.config.gender = gender
    this.mixer.setGender(gender)
    console.log(`Changed gender to: ${gender}`)
  }

  /**
   * Set the mixer profile
   */
  setProfile(profileName: string): boolean {
    const profile = MIXER_PROFILES[profileName]
    if (!profile) {
      console.warn(`Profile not found: ${profileName}`)
      return false
    }

    this.config.profile = profileName
    this.mixer.setProfile(profile)
    console.log(`Changed profile to: ${profileName}`)
    return true
  }

  /**
   * Get all available animations for current gender
   */
  getAvailableAnimations(): AnimationData[] {
    return this.mixer.getAnimationsByGender()
  }

  /**
   * Get animations by category
   */
  getAnimationsByCategory(category: string): AnimationData[] {
    return this.mixer.getAnimationsByCategory(category)
  }

  /**
   * Search animations
   */
  searchAnimations(query: string): AnimationData[] {
    const allAnimations = this.mixer.getAnimationsByGender()
    const lowerQuery = query.toLowerCase()
    
    return allAnimations.filter(anim =>
      anim.displayName.toLowerCase().includes(lowerQuery) ||
      anim.name.toLowerCase().includes(lowerQuery) ||
      anim.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Get system status
   */
  getStatus(): SystemStatus {
    const loadedAssets = Array.from(this.assetCache.values()).filter(asset => asset.loaded).length
    
    return {
      initialized: this.isInitialized,
      totalAnimations: this.mixer.getAllAnimations().length,
      loadedAssets,
      currentGender: this.config.gender,
      currentProfile: typeof this.config.profile === 'string' ? this.config.profile : this.config.profile.name,
      queueLength: this.mixer.getQueue().length,
      statistics: this.mixer.getStatistics()
    }
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const animIndex = getCachedAnimationIndex()
    return animIndex?.categories || ['idle', 'gesture', 'movement', 'expression', 'action', 'communication']
  }

  /**
   * Get available profiles
   */
  getAvailableProfiles(): string[] {
    return Object.keys(MIXER_PROFILES)
  }

  /**
   * Preload animations by category
   */
  async preloadCategory(category: string): Promise<void> {
    const animations = this.mixer.getAnimationsByCategory(category)
    const promises = animations.map(anim => this.loadAnimationAsset(anim))
    
    try {
      await Promise.all(promises)
      console.log(`Preloaded category: ${category} (${animations.length} animations)`)
    } catch (error) {
      console.warn(`Failed to preload some animations in category: ${category}`, error)
    }
  }

  /**
   * Clear asset cache
   */
  clearCache(): void {
    this.assetCache.clear()
    console.log('Animation asset cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    total: number
    loaded: number
    loading: number
    failed: number
    cacheSize: number
  } {
    const assets = Array.from(this.assetCache.values())
    
    return {
      total: assets.length,
      loaded: assets.filter(a => a.loaded).length,
      loading: assets.filter(a => a.loading).length,
      failed: assets.filter(a => a.error).length,
      cacheSize: this.config.cacheSize
    }
  }

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean {
    return this.isInitialized && this.mixer.isInitialized()
  }

  /**
   * Wait for system initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.isInitialized) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  /**
   * Export current configuration
   */
  exportConfig(): EnhancedRPMConfig {
    return { ...this.config }
  }

  /**
   * Import configuration
   */
  importConfig(config: Partial<EnhancedRPMConfig>): void {
    this.config = { ...this.config, ...config }
    this.initialize() // Re-initialize with new config
  }
}

// Singleton instance
let systemInstance: EnhancedRPMAnimationSystem | null = null

export function useEnhancedRPMSystem(config?: Partial<EnhancedRPMConfig>): EnhancedRPMAnimationSystem {
  if (!systemInstance) {
    systemInstance = new EnhancedRPMAnimationSystem(config)
  }
  return systemInstance
}

export { MIXER_PROFILES }
export type { AnimationData, AnimationSequence, MixerProfile }
export default EnhancedRPMAnimationSystem