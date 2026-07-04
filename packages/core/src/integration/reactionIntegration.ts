import type { AnimationCategory, AnimationPerformanceData } from '../services/animation/animationTypes'
import type { ConversationMessage } from '../services/conversation/conversationType'
import type { EmotionType, PerformanceData } from '../services/emote/emoteTypes'
import { detectEmotionFromText, getEmotionIntensity } from './emotionIntegration'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// Emotion → animation category. Resolved against whatever clips the active avatar loaded
// (GLB or VRMA), so this works for every avatar. Neutral → no gesture (stay idle).
const EMOTION_TO_CATEGORY: Partial<Record<EmotionType, AnimationCategory>> = {
  happy: 'gesture',
  love: 'gesture',
  angry: 'expression',
  fear: 'expression',
  sad: 'expression',
  disgust: 'expression'
}

/**
 * Build PerformanceData (facial/emote) and an AnimationPerformanceData (body animation)
 * from a conversation message. Uses emotionIntegration as the base and adds animation mapping.
 */
export const createReactionFromMessage = (
  message: ConversationMessage,
  messageIndex: number = 0
): { performance: PerformanceData; animation: AnimationPerformanceData | undefined } => {
  const emotion = detectEmotionFromText(message.text)
  //const action = analyzeMessageForActions(message)
  const intensity = getEmotionIntensity(message.text)
  
  const performance: PerformanceData = {
    emotion,

    bcounter: messageIndex,
    whisper: message.visemeData as { words?: string[]; wtimes?: number[]; wdurations?: number[] } | undefined
  }

  const animation = selectAnimationForPerformance(performance, intensity)
  return { performance, animation }
}



/**
 * Map emotion/action → animation clip. Intensity modulates speed/blend.
 */
export const selectAnimationForPerformance = (
  p: PerformanceData,
  intensity: number = 0.6
): AnimationPerformanceData | undefined => {
  const category = p.emotion ? EMOTION_TO_CATEGORY[p.emotion] : undefined
  if (!category) return undefined // neutral / unmapped → stay in idle

  // Intensity modulates playback speed + blend; the animation service resolves a loaded
  // clip of `category` for the active avatar (skeleton-agnostic).
  const speedScale = clamp(0.85 + intensity * 0.3, 0.85, 1.15)
  return {
    category,
    loopCount: 1,
    immediate: true,
    speed: clamp(speedScale, 0.7, 1.4),
    blendTime: Math.round(clamp(500 - intensity * 150, 350, 500))
  }
}

export const reactionIntegrationService = {
  createReactionFromMessage,
  selectAnimationForPerformance
}
