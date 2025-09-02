import { useCallback, useMemo } from 'react'
import type { AnimationPerformanceData } from '../animation/animationTypes'
import type { PerformanceData } from '../emote/emoteTypes'
import { useAnimationService } from '../animation/useAnimationService'
import { useEmoteService } from '../emote/useEmoteService'
import { KeywordAnimationService } from './keywordAnimationService'
import type { KeywordAnimationConfig, KeywordMatchResult } from './keywordAnimationTypes'

export interface UseKeywordAnimationOptions {
  config?: KeywordAnimationConfig
  enableAnimations?: boolean
  enableEmotes?: boolean
}

export interface UseKeywordAnimationResult {
  // Core functionality
  processKeywords: (input: string) => KeywordMatchResult[]
  triggerFromKeywords: (input: string) => boolean
  
  // Service access
  service: KeywordAnimationService
  
  // Configuration
  updateConfig: (config: KeywordAnimationConfig) => void
}

export function useKeywordAnimation(options: UseKeywordAnimationOptions = {}): UseKeywordAnimationResult {
  const {
    config,
    enableAnimations = true,
    enableEmotes = true
  } = options
  
  const animationService = useAnimationService()
  const emoteService = useEmoteService()
  
  // Create the keyword animation service
  const service = useMemo(() => {
    return new KeywordAnimationService(config)
  }, [config])
  
  // Update configuration
  const updateConfig = useCallback((newConfig: KeywordAnimationConfig) => {
    service.updateConfig(newConfig)
  }, [service])
  
  // Process keywords and return all matches
  const processKeywords = useCallback((input: string): KeywordMatchResult[] => {
    return service.findAllMatches(input)
  }, [service])
  
  // Process keywords and trigger the best matching animation/emote
  const triggerFromKeywords = useCallback((input: string): boolean => {
    const match = service.findBestMatch(input)
    
    if (!match) {
      return false
    }
    
    let triggered = false
    
    // Trigger animation if specified and enabled
    if (enableAnimations && match.mapping.animation && animationService) {
      const animationData: AnimationPerformanceData = {
        name: match.mapping.animation.name,
        category: match.mapping.animation.category,
        immediate: match.mapping.animation.immediate ?? true,
        loopCount: match.mapping.animation.loopCount,
        blendTime: match.mapping.animation.blendTime,
        speed: match.mapping.animation.speed
      }
      
      try {
        animationService.startPerformance(animationData, performance.now())
        triggered = true
        console.log('Triggered animation:', animationData.name, 'from keywords:', match.matchedKeywords)
      } catch (error) {
        console.warn('Failed to trigger animation:', error)
      }
    }
    
    // Trigger emote if specified and enabled
    if (enableEmotes && match.mapping.emote && emoteService) {
      const emoteData: PerformanceData = {
        emotion: match.mapping.emote.emotion,
        relaxTime: match.mapping.emote.duration
      }
      
      try {
        emoteService.startPerformance(emoteData, 0)
        triggered = true
        console.log('Triggered emote:', emoteData.emotion, 'from keywords:', match.matchedKeywords)
      } catch (error) {
        console.warn('Failed to trigger emote:', error)
      }
    }
    
    if (triggered) {
      console.log('Keyword animation triggered:', {
        input,
        match: match.mapping.description,
        matchedKeywords: match.matchedKeywords,
        confidence: match.confidence
      })
    }
    
    return triggered
  }, [service, animationService, emoteService, enableAnimations, enableEmotes])
  
  return {
    processKeywords,
    triggerFromKeywords,
    service,
    updateConfig
  }
}