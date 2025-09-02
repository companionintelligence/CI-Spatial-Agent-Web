/**
 * RPM Animation Asset Manager
 * 
 * This service handles downloading, caching, and managing Ready Player Me animation assets.
 * It provides functionality to:
 * - Download animations from the RPM GitHub repository
 * - Cache animations locally for better performance
 * - Manage asset availability and fallbacks
 * - Convert remote URLs to local paths when cached
 */

import type { RPMAnimationClip, AnimationGender } from './config/rpmAnimationLibrary'
import { RPM_ANIMATION_LIBRARY } from './config/rpmAnimationLibrary'
import { EXTENDED_RPM_ANIMATIONS } from './config/extendedRPMAnimations'

export interface AssetDownloadProgress {
  animationId: string
  name: string
  progress: number // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  error?: string
  localPath?: string
}

export interface AssetManagerConfig {
  cacheDirectory: string // Local directory to cache animations
  maxConcurrentDownloads: number
  retryAttempts: number
  preferLocal: boolean // Prefer local files over remote when available
  autoDownload: boolean // Auto-download animations when requested
}

export interface AssetCacheInfo {
  total: number
  cached: number
  pending: number
  failed: number
  byGender: {
    masculine: { total: number, cached: number }
    feminine: { total: number, cached: number }
  }
  byCategory: Record<string, { total: number, cached: number }>
}

export class RPMAnimationAssetManager {
  private config: AssetManagerConfig
  private downloadQueue: Map<string, AssetDownloadProgress> = new Map()
  private cachedAssets: Set<string> = new Set()
  private failedAssets: Set<string> = new Set()
  private allRPMAnimations: RPMAnimationClip[]

  constructor(config: Partial<AssetManagerConfig> = {}) {
    this.config = {
      cacheDirectory: '/assets/animations/rpm',
      maxConcurrentDownloads: 3,
      retryAttempts: 2,
      preferLocal: true,
      autoDownload: false,
      ...config
    }

    this.allRPMAnimations = [...RPM_ANIMATION_LIBRARY, ...EXTENDED_RPM_ANIMATIONS]
    this.initializeCache()
  }

  private async initializeCache(): Promise<void> {
    // In a real implementation, this would:
    // 1. Check what assets are already cached locally
    // 2. Update the cachedAssets Set accordingly
    // 3. Update localPath properties on RPM animations
    
    console.log('RPM Animation Asset Manager initialized', {
      totalAnimations: this.allRPMAnimations.length,
      cacheDirectory: this.config.cacheDirectory,
      config: this.config
    })
  }

  /**
   * Get the effective path for an animation (local if cached, remote otherwise)
   */
  public getAnimationPath(rpmId: string, gender: AnimationGender): string | null {
    const animation = this.allRPMAnimations.find(a => 
      a.rpmId === rpmId && a.gender === gender
    )

    if (!animation) {
      return null
    }

    // If we have a local cached version and prefer local
    if (this.config.preferLocal && animation.localPath && this.isAnimationCached(rpmId, gender)) {
      return animation.localPath
    }

    // Fall back to remote path
    return animation.remotePath
  }

  /**
   * Check if an animation is cached locally
   */
  public isAnimationCached(rpmId: string, gender: AnimationGender): boolean {
    const key = `${rpmId}_${gender}`
    return this.cachedAssets.has(key)
  }

  /**
   * Check if an animation download failed
   */
  public isAnimationFailed(rpmId: string, gender: AnimationGender): boolean {
    const key = `${rpmId}_${gender}`
    return this.failedAssets.has(key)
  }

  /**
   * Get download progress for an animation
   */
  public getDownloadProgress(rpmId: string, gender: AnimationGender): AssetDownloadProgress | null {
    const key = `${rpmId}_${gender}`
    return this.downloadQueue.get(key) || null
  }

  /**
   * Queue an animation for download
   */
  public async queueForDownload(rpmId: string, gender: AnimationGender): Promise<boolean> {
    const key = `${rpmId}_${gender}`
    
    // Check if already cached
    if (this.isAnimationCached(rpmId, gender)) {
      return true
    }

    // Check if already in queue
    if (this.downloadQueue.has(key)) {
      return true
    }

    const animation = this.allRPMAnimations.find(a => 
      a.rpmId === rpmId && a.gender === gender
    )

    if (!animation) {
      console.warn(`Animation not found: ${rpmId} (${gender})`)
      return false
    }

    // Add to download queue
    const downloadProgress: AssetDownloadProgress = {
      animationId: key,
      name: animation.name,
      progress: 0,
      status: 'pending'
    }

    this.downloadQueue.set(key, downloadProgress)

    // Start download if auto-download is enabled
    if (this.config.autoDownload) {
      this.processDownloadQueue()
    }

    return true
  }

  /**
   * Download a batch of animations
   */
  public async downloadAnimations(
    animations: { rpmId: string, gender: AnimationGender }[],
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    const results: AssetDownloadProgress[] = []

    // Queue all animations
    for (const anim of animations) {
      await this.queueForDownload(anim.rpmId, anim.gender)
    }

    // Process the queue
    await this.processDownloadQueue(onProgress)

    // Return results
    for (const anim of animations) {
      const key = `${anim.rpmId}_${anim.gender}`
      const progress = this.downloadQueue.get(key)
      if (progress) {
        results.push(progress)
      }
    }

    return results
  }

  /**
   * Download all animations for a specific gender
   */
  public async downloadAllForGender(
    gender: AnimationGender,
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    const genderAnimations = this.allRPMAnimations
      .filter(a => a.gender === gender)
      .map(a => ({ rpmId: a.rpmId, gender: a.gender }))

    return this.downloadAnimations(genderAnimations, onProgress)
  }

  /**
   * Download animations by category
   */
  public async downloadByCategory(
    category: string,
    gender?: AnimationGender,
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    let categoryAnimations = this.allRPMAnimations.filter(a => a.category === category)
    
    if (gender) {
      categoryAnimations = categoryAnimations.filter(a => a.gender === gender)
    }

    const animationsToDownload = categoryAnimations.map(a => ({ 
      rpmId: a.rpmId, 
      gender: a.gender 
    }))

    return this.downloadAnimations(animationsToDownload, onProgress)
  }

  /**
   * Process the download queue
   */
  private async processDownloadQueue(
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<void> {
    const pending = Array.from(this.downloadQueue.values()).filter(p => p.status === 'pending')
    const concurrent = Math.min(pending.length, this.config.maxConcurrentDownloads)
    
    const downloadPromises: Promise<void>[] = []

    for (let i = 0; i < concurrent; i++) {
      if (pending[i]) {
        downloadPromises.push(this.downloadSingleAnimation(pending[i], onProgress))
      }
    }

    await Promise.all(downloadPromises)
  }

  /**
   * Download a single animation
   */
  private async downloadSingleAnimation(
    progress: AssetDownloadProgress,
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<void> {
    progress.status = 'downloading'
    progress.progress = 0

    try {
      // In a real implementation, this would:
      // 1. Fetch the animation file from the remote URL
      // 2. Save it to the local cache directory
      // 3. Update the animation's localPath
      // 4. Add to cachedAssets set

      // Simulate download progress
      await this.simulateDownload(progress, onProgress)

      // Mark as completed
      progress.status = 'completed'
      progress.progress = 100
      progress.localPath = this.generateLocalPath(progress.animationId)

      // Update cached assets
      this.cachedAssets.add(progress.animationId)
      
      // Update the animation object
      this.updateAnimationLocalPath(progress.animationId, progress.localPath)

      console.log(`Downloaded animation: ${progress.name}`)

    } catch (error) {
      progress.status = 'failed'
      progress.error = error instanceof Error ? error.message : 'Unknown error'
      this.failedAssets.add(progress.animationId)
      
      console.error(`Failed to download animation: ${progress.name}`, error)
    }

    if (onProgress) {
      onProgress(progress)
    }
  }

  /**
   * Simulate download progress (replace with actual download logic)
   */
  private async simulateDownload(
    progress: AssetDownloadProgress,
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<void> {
    const steps = 10
    const delay = 100 // ms per step
    
    for (let i = 0; i <= steps; i++) {
      progress.progress = Math.round((i / steps) * 100)
      
      if (onProgress) {
        onProgress(progress)
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  /**
   * Generate local path for an animation
   */
  private generateLocalPath(animationId: string): string {
    return `${this.config.cacheDirectory}/${animationId}.glb`
  }

  /**
   * Update the localPath property of an animation
   */
  private updateAnimationLocalPath(animationId: string, localPath: string): void {
    const animation = this.allRPMAnimations.find(a => 
      `${a.rpmId}_${a.gender}` === animationId
    )

    if (animation) {
      animation.localPath = localPath
    }
  }

  /**
   * Get cache information and statistics
   */
  public getCacheInfo(): AssetCacheInfo {
    const total = this.allRPMAnimations.length
    const cached = this.cachedAssets.size
    const pending = Array.from(this.downloadQueue.values()).filter(p => p.status === 'pending').length
    const failed = this.failedAssets.size

    // By gender
    const masculineTotal = this.allRPMAnimations.filter(a => a.gender === 'masculine').length
    const feminineTotal = this.allRPMAnimations.filter(a => a.gender === 'feminine').length
    const masculineCached = Array.from(this.cachedAssets).filter(key => key.endsWith('_masculine')).length
    const feminineCached = Array.from(this.cachedAssets).filter(key => key.endsWith('_feminine')).length

    // By category
    const categories = [...new Set(this.allRPMAnimations.map(a => a.category))]
    const byCategory: Record<string, { total: number, cached: number }> = {}
    
    categories.forEach(category => {
      const categoryAnims = this.allRPMAnimations.filter(a => a.category === category)
      const categoryCached = categoryAnims.filter(a => 
        this.cachedAssets.has(`${a.rpmId}_${a.gender}`)
      ).length

      byCategory[category] = {
        total: categoryAnims.length,
        cached: categoryCached
      }
    })

    return {
      total,
      cached,
      pending,
      failed,
      byGender: {
        masculine: { total: masculineTotal, cached: masculineCached },
        feminine: { total: feminineTotal, cached: feminineCached }
      },
      byCategory
    }
  }

  /**
   * Clear download queue
   */
  public clearDownloadQueue(): void {
    this.downloadQueue.clear()
  }

  /**
   * Retry failed downloads
   */
  public async retryFailedDownloads(
    onProgress?: (progress: AssetDownloadProgress) => void
  ): Promise<AssetDownloadProgress[]> {
    const failedKeys = Array.from(this.failedAssets)
    const retryAnimations: { rpmId: string, gender: AnimationGender }[] = []

    for (const key of failedKeys) {
      const [rpmId, gender] = key.split('_')
      if (rpmId && gender) {
        retryAnimations.push({ rpmId, gender: gender as AnimationGender })
        
        // Remove from failed set to allow retry
        this.failedAssets.delete(key)
        
        // Remove from download queue if exists
        this.downloadQueue.delete(key)
      }
    }

    return this.downloadAnimations(retryAnimations, onProgress)
  }

  /**
   * Get all available animations with their availability status
   */
  public getAllAnimationsWithStatus(): Array<RPMAnimationClip & { 
    cached: boolean, 
    failed: boolean, 
    downloading: boolean,
    effectivePath: string
  }> {
    return this.allRPMAnimations.map(animation => {
      const key = `${animation.rpmId}_${animation.gender}`
      const cached = this.cachedAssets.has(key)
      const failed = this.failedAssets.has(key)
      const downloadProgress = this.downloadQueue.get(key)
      const downloading = downloadProgress?.status === 'downloading' || downloadProgress?.status === 'pending'
      const effectivePath = this.getAnimationPath(animation.rpmId, animation.gender) || animation.remotePath

      return {
        ...animation,
        cached,
        failed,
        downloading,
        effectivePath
      }
    })
  }

  /**
   * Export cache configuration
   */
  public exportCacheConfig() {
    return {
      config: this.config,
      cachedAssets: Array.from(this.cachedAssets),
      failedAssets: Array.from(this.failedAssets)
    }
  }

  /**
   * Import cache configuration
   */
  public importCacheConfig(cacheConfig: any): boolean {
    try {
      if (cacheConfig.config) {
        this.config = { ...this.config, ...cacheConfig.config }
      }
      
      if (Array.isArray(cacheConfig.cachedAssets)) {
        this.cachedAssets = new Set(cacheConfig.cachedAssets)
      }
      
      if (Array.isArray(cacheConfig.failedAssets)) {
        this.failedAssets = new Set(cacheConfig.failedAssets)
      }
      
      console.log('RPM Animation Asset Manager configuration imported successfully')
      return true
    } catch (error) {
      console.error('Failed to import RPM Animation Asset Manager configuration:', error)
      return false
    }
  }
}

/**
 * Global asset manager instance
 */
export const globalRPMAssetManager = new RPMAnimationAssetManager()

/**
 * Utility function to get the global asset manager
 */
export function useRPMAssetManager(): RPMAnimationAssetManager {
  return globalRPMAssetManager
}