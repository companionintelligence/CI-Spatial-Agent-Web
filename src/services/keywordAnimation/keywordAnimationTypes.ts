import type { AnimationCategory } from '../animation/animationTypes'
import type { EmotionType } from '../emote/emoteTypes'

export interface KeywordAnimationMapping {
  // Keywords that trigger this animation/emote
  keywords: string[]
  
  // Animation to trigger (optional - for body animations)
  animation?: {
    name: string
    category?: AnimationCategory
    immediate?: boolean
    loopCount?: number
    blendTime?: number
    speed?: number
  }
  
  // Emote to trigger (optional - for facial expressions)  
  emote?: {
    emotion: EmotionType
    duration?: number
    intensity?: number
  }
  
  // Priority for keyword matching (higher = more specific)
  priority: number
  
  // Description for testing/debugging
  description: string
}

export interface KeywordMatchResult {
  mapping: KeywordAnimationMapping
  matchedKeywords: string[]
  confidence: number
}

export interface KeywordAnimationConfig {
  mappings: KeywordAnimationMapping[]
  // Minimum confidence threshold for triggering animations
  minConfidence: number
  // Whether to allow partial keyword matches
  allowPartialMatches: boolean
}