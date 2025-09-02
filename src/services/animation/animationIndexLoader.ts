/**
 * Animation Index Loader
 * 
 * Provides a typed way to access the master Animations.json file
 */

// Import the JSON file as a static asset
import animationsJsonUrl from '@/assets/animations/Animations.json?url'

export interface AnimationEntry {
  id: string
  name: string
  displayName: string
  category: string
  gender: 'masculine' | 'feminine'
  localPath: string
  remotePath: string
  duration: number
  loop: boolean
  weight: number
  blendTime: number
  priority: number
  tags: string[]
}

export interface AnimationIndex {
  version: string
  description: string
  totalAnimations: number
  categories: string[]
  genders: string[]
  animations: {
    [gender: string]: {
      [category: string]: {
        [animationName: string]: AnimationEntry
      }
    }
  }
}

// Cache for the loaded animation data
let cachedAnimationIndex: AnimationIndex | null = null

/**
 * Load the animation index from the JSON file
 */
export async function loadAnimationIndex(): Promise<AnimationIndex> {
  if (cachedAnimationIndex) {
    return cachedAnimationIndex
  }

  try {
    const response = await fetch(animationsJsonUrl)
    if (!response.ok) {
      throw new Error(`Failed to load animations index: ${response.status}`)
    }
    
    cachedAnimationIndex = await response.json()
    return cachedAnimationIndex!
  } catch (error) {
    console.error('Failed to load animation index:', error)
    
    // Fallback: return empty index structure
    return {
      version: '1.0.0',
      description: 'Animation Library (fallback)',
      totalAnimations: 0,
      categories: ['idle', 'gesture', 'movement', 'expression', 'action', 'communication'],
      genders: ['masculine', 'feminine'],
      animations: {}
    }
  }
}

/**
 * Get cached animation index (synchronous access)
 * Returns null if not loaded yet
 */
export function getCachedAnimationIndex(): AnimationIndex | null {
  return cachedAnimationIndex
}

export default loadAnimationIndex