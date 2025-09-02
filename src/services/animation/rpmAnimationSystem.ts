/**
 * RPM Animation System Integration
 * 
 * This service integrates all RPM animation components:
 * - Animation library and mixer
 * - Asset management and caching  
 * - Integration with existing animation service
 * - Provides a unified API for the application
 */

import type { AnimationState, AnimationPerformanceData } from '../animationTypes'
import { RPMAnimationMixer, useRPMAnimationMixer } from '../rpmAnimationMixer'
import { RPMAnimationAssetManager, useRPMAssetManager } from '../rpmAssetManager'
import type { AnimationGender } from '../config/rpmAnimationLibrary'
import type { AssetDownloadProgress } from '../rpmAssetManager'

export interface RPMAnimationSystemConfig {
  // Avatar configuration
  avatarGender: AnimationGender
  mixerProfile: string // Professional Male, Casual Female, etc.
  
  // Asset management
  autoDownload: boolean
  preferLocal: boolean
  maxConcurrentDownloads: number
  
  // Animation behavior
  enableRPMAnimations: boolean
  libraryMode: 'local' | 'rpm' | 'mixed'
  blendWithExisting: boolean
  
  // Performance
  preloadCategories: string[]
  cacheDirectory: string
}

export interface RPMSystemStatus {
  initialized: boolean
  animationCount: number
  cachedCount: number
  failedCount: number
  downloadingCount: number
  currentGender: AnimationGender
  mixerProfile: string | null
  libraryMode: string
}

export class RPMAnimationSystem {
  private mixer: RPMAnimationMixer
  private assetManager: RPMAnimationAssetManager
  private config: RPMAnimationSystemConfig
  private initialized: boolean = false

  constructor(config: Partial<RPMAnimationSystemConfig> = {}) {
    this.config = {
      avatarGender: 'masculine',
      mixerProfile: 'Professional Male',
      autoDownload: false,
      preferLocal: true,
      maxConcurrentDownloads: 3,
      enableRPMAnimations: true,
      libraryMode: 'mixed',
      blendWithExisting: true,
      preloadCategories: ['idle', 'gesture', 'communication'],
      cacheDirectory: '/assets/animations/rpm',
      ...config
    }

    // Initialize components
    this.mixer = useRPMAnimationMixer()
    this.assetManager = useRPMAssetManager()
    
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      console.log('Initializing RPM Animation System...', this.config)

      // Configure mixer
      this.mixer.setGender(this.config.avatarGender)
      this.mixer.setLibraryMode(this.config.libraryMode)
      
      if (this.config.mixerProfile) {
        this.mixer.setMixerConfig(this.config.mixerProfile)
      }

      // Preload animations if auto-download is enabled
      if (this.config.autoDownload && this.config.preloadCategories.length > 0) {
        await this.preloadAnimations()
      }

      this.initialized = true
      console.log('RPM Animation System initialized successfully')

    } catch (error) {
      console.error('Failed to initialize RPM Animation System:', error)
      throw error
    }
  }

  /**
   * Preload animations for specified categories
   */
  private async preloadAnimations(): Promise<void> {
    console.log('Preloading RPM animations for categories:', this.config.preloadCategories)

    for (const category of this.config.preloadCategories) {
      try {
        await this.assetManager.downloadByCategory(
          category,
          this.config.avatarGender,
          (progress) => {
            console.log(`Preloading ${category}:`, progress.name, `${progress.progress}%`)
          }
        )
      } catch (error) {
        console.warn(`Failed to preload category ${category}:`, error)
      }
    }
  }

  /**
   * Set avatar gender and update system accordingly
   */
  public async setAvatarGender(gender: AnimationGender): Promise<void> {
    this.config.avatarGender = gender
    this.mixer.setGender(gender)

    // Preload animations for new gender if auto-download is enabled
    if (this.config.autoDownload && this.config.preloadCategories.length > 0) {
      await this.preloadAnimations()
    }

    console.log(`RPM Animation System updated for ${gender} gender`)
  }

  /**
   * Set mixer profile (Professional Male, Casual Female, etc.)
   */
  public setMixerProfile(profileName: string): boolean {
    const success = this.mixer.setMixerConfig(profileName)
    if (success) {
      this.config.mixerProfile = profileName
    }
    return success
  }

  /**
   * Set animation library mode
   */
  public setLibraryMode(mode: 'local' | 'rpm' | 'mixed'): void {
    this.config.libraryMode = mode
    this.mixer.setLibraryMode(mode)
    console.log(`Animation library mode set to: ${mode}`)
  }

  /**
   * Play an RPM animation by ID
   */
  public async playRPMAnimation(
    rpmId: string, 
    options: Partial<AnimationPerformanceData> = {}
  ): Promise<boolean> {
    if (!this.config.enableRPMAnimations) {
      console.warn('RPM animations are disabled')
      return false
    }

    // Check if animation is available
    const animationPath = this.assetManager.getAnimationPath(rpmId, this.config.avatarGender)
    if (!animationPath) {
      console.warn(`RPM animation not found: ${rpmId}`)
      return false
    }

    // If animation is not cached and auto-download is disabled, fail
    if (!this.assetManager.isAnimationCached(rpmId, this.config.avatarGender) && !this.config.autoDownload) {
      console.warn(`RPM animation not cached and auto-download disabled: ${rpmId}`)
      return false
    }

    // Download if needed
    if (!this.assetManager.isAnimationCached(rpmId, this.config.avatarGender)) {
      console.log(`Downloading RPM animation: ${rpmId}`)
      await this.assetManager.queueForDownload(rpmId, this.config.avatarGender)
    }

    // Queue animation in mixer
    return this.mixer.queueRPMAnimation(rpmId, options)
  }

  /**
   * Get a random animation from the current library
   */
  public getRandomAnimation(category?: string): any {
    return this.mixer.getRandomAnimation(category, true)
  }

  /**
   * Get animations by category
   */
  public getAnimationsByCategory(category: string): any[] {
    return this.mixer.getAnimationsByCategory(category, true)
  }

  /**
   * Download animations for a category
   */
  public async downloadCategory(
    category: string,
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    return this.assetManager.downloadByCategory(
      category,
      this.config.avatarGender,
      onProgress
    )
  }

  /**
   * Download all animations for current gender
   */
  public async downloadAllForCurrentGender(
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    return this.assetManager.downloadAllForGender(this.config.avatarGender, onProgress)
  }

  /**
   * Get system status and statistics
   */
  public getSystemStatus(): RPMSystemStatus {
    const mixerStats = this.mixer.getStatistics()
    const cacheInfo = this.assetManager.getCacheInfo()

    return {
      initialized: this.initialized,
      animationCount: mixerStats.totalAnimations,
      cachedCount: cacheInfo.cached,
      failedCount: cacheInfo.failed,
      downloadingCount: cacheInfo.pending,
      currentGender: this.config.avatarGender,
      mixerProfile: this.config.mixerProfile,
      libraryMode: this.config.libraryMode
    }
  }

  /**
   * Get detailed statistics
   */
  public getDetailedStatistics() {
    return {
      mixer: this.mixer.getStatistics(),
      assetCache: this.assetManager.getCacheInfo(),
      config: this.config,
      status: this.getSystemStatus()
    }
  }

  /**
   * Get available mixer profiles
   */
  public getAvailableMixerProfiles(): string[] {
    return this.mixer.getAvailableMixers().map(mixer => mixer.name)
  }

  /**
   * Validate animation availability
   */
  public validateAnimations() {
    return this.mixer.validateAnimationAvailability()
  }

  /**
   * Get all animations with their status
   */
  public getAllAnimationsWithStatus() {
    return this.assetManager.getAllAnimationsWithStatus()
  }

  /**
   * Retry failed downloads
   */
  public async retryFailedDownloads(
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    return this.assetManager.retryFailedDownloads(onProgress)
  }

  /**
   * Clear download queue
   */
  public clearDownloadQueue(): void {
    this.assetManager.clearDownloadQueue()
  }

  /**
   * Enable/disable RPM animations
   */
  public setRPMAnimationsEnabled(enabled: boolean): void {
    this.config.enableRPMAnimations = enabled
    console.log(`RPM animations ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Enable/disable auto-download
   */
  public setAutoDownload(enabled: boolean): void {
    this.config.autoDownload = enabled
    console.log(`Auto-download ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Update preload categories
   */
  public async updatePreloadCategories(categories: string[]): Promise<void> {
    this.config.preloadCategories = categories
    
    if (this.config.autoDownload && categories.length > 0) {
      await this.preloadAnimations()
    }
  }

  /**
   * Export system configuration
   */
  public exportConfiguration() {
    return {
      rpmSystemConfig: this.config,
      mixerConfig: this.mixer.exportConfig(),
      assetManagerConfig: this.assetManager.exportCacheConfig()
    }
  }

  /**
   * Import system configuration
   */
  public async importConfiguration(config: any): Promise<boolean> {
    try {
      if (config.rpmSystemConfig) {
        this.config = { ...this.config, ...config.rpmSystemConfig }
      }

      if (config.mixerConfig) {
        this.mixer.importConfig(config.mixerConfig)
      }

      if (config.assetManagerConfig) {
        this.assetManager.importCacheConfig(config.assetManagerConfig)
      }

      // Re-initialize with new config
      await this.initialize()
      
      console.log('RPM Animation System configuration imported successfully')
      return true
    } catch (error) {
      console.error('Failed to import RPM Animation System configuration:', error)
      return false
    }
  }

  /**
   * Integration with existing animation service
   */
  public integrateWithAnimationService(animationState: AnimationState): void {
    // This method would integrate the RPM system with the existing animation service
    // by updating the animation state with RPM animations and configurations
    
    const mixerState = this.mixer.getState()
    
    // Update the animation state with RPM-filtered animations
    animationState.cachedClips = mixerState.cachedClips
    animationState.cyclingState.currentPersonality = this.config.mixerProfile || 'professional'
    
    // Update cycle interval if mixer config is available
    if (mixerState.rpmMixerConfig) {
      animationState.cycleInterval = mixerState.rpmMixerConfig.cycleInterval
    }

    console.log('RPM Animation System integrated with animation service', {
      availableAnimations: animationState.cachedClips.length,
      personality: animationState.cyclingState.currentPersonality
    })
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.clearDownloadQueue()
    console.log('RPM Animation System cleaned up')
  }
}

/**
 * Global RPM Animation System instance
 */
export const globalRPMAnimationSystem = new RPMAnimationSystem()

/**
 * Hook-like function to get the global system instance
 */
export function useRPMAnimationSystem(): RPMAnimationSystem {
  return globalRPMAnimationSystem
}

/**
 * Utility function to initialize RPM system with specific config
 */
export async function initializeRPMSystem(config: Partial<RPMAnimationSystemConfig>): Promise<RPMAnimationSystem> {
  const system = new RPMAnimationSystem(config)
  
  // Wait for initialization to complete
  let attempts = 0
  const maxAttempts = 50
  
  while (!system.getSystemStatus().initialized && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  
  if (!system.getSystemStatus().initialized) {
    throw new Error('RPM Animation System failed to initialize within timeout')
  }
  
  return system
}

/**
 * Quick setup function for common configurations
 */
export const RPMAnimationPresets = {
  /**
   * Professional setup with minimal animations
   */
  professional: (gender: AnimationGender): Partial<RPMAnimationSystemConfig> => ({
    avatarGender: gender,
    mixerProfile: gender === 'masculine' ? 'Professional Male' : 'Professional Female',
    libraryMode: 'mixed',
    enableRPMAnimations: true,
    autoDownload: false,
    preloadCategories: ['idle', 'gesture', 'communication'],
    blendWithExisting: true
  }),

  /**
   * Full setup with all animations
   */
  complete: (gender: AnimationGender): Partial<RPMAnimationSystemConfig> => ({
    avatarGender: gender,
    mixerProfile: gender === 'masculine' ? 'Casual Male' : 'Casual Female',
    libraryMode: 'mixed',
    enableRPMAnimations: true,
    autoDownload: true,
    preloadCategories: ['idle', 'gesture', 'movement', 'expression', 'action', 'communication'],
    maxConcurrentDownloads: 5,
    blendWithExisting: true
  }),

  /**
   * Local-only setup (no RPM downloads)
   */
  localOnly: (): Partial<RPMAnimationSystemConfig> => ({
    libraryMode: 'local',
    enableRPMAnimations: false,
    autoDownload: false,
    preloadCategories: [],
    blendWithExisting: false
  }),

  /**
   * RPM-only setup
   */
  rpmOnly: (gender: AnimationGender): Partial<RPMAnimationSystemConfig> => ({
    avatarGender: gender,
    mixerProfile: gender === 'masculine' ? 'Professional Male' : 'Professional Female',
    libraryMode: 'rpm',
    enableRPMAnimations: true,
    autoDownload: true,
    preloadCategories: ['idle', 'gesture', 'communication', 'expression'],
    blendWithExisting: false
  })
}