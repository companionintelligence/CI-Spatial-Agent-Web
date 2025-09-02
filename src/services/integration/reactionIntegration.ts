import type { AnimationPerformanceData } from '../animation/animationTypes'
import type { ConversationMessage } from '../conversation/conversationType'
import type { PerformanceData } from '../emote/emoteTypes'
import { analyzeMessageForActions, detectEmotionFromText, getEmotionIntensity } from './emotionIntegration'

/**
 * Calculate appropriate emotion duration based on text length, emotion type, and intensity
 */
const calculateEmotionDuration = (text: string, emotion: string, intensity: number): number => {
  // Base duration calculation from text length (assume ~150-200 wpm reading speed)
  const wordCount = text.trim().split(/\s+/).length
  const baseSpeechDuration = (wordCount / 3.0) * 1000 // ~180 wpm, convert to ms
  
  // Emotion-specific duration multipliers
  const emotionMultipliers = {
    'happy': 1.2,    // Happy expressions should linger
    'love': 1.3,     // Love expressions should be sustained
    'angry': 1.1,    // Angry expressions are intense but shorter
    'sad': 1.4,      // Sad expressions should persist longer
    'fear': 0.9,     // Fear expressions are more fleeting
    'disgust': 0.8,  // Disgust expressions are brief
    'neutral': 0.7   // Neutral shouldn't overstay
  }
  
  const emotionMultiplier = emotionMultipliers[emotion as keyof typeof emotionMultipliers] || 1.0
  
  // Intensity affects duration (higher intensity = longer duration)
  const intensityMultiplier = 0.8 + (intensity * 0.6) // Range: 0.8 to 1.4
  
  // Calculate final duration with minimum and maximum bounds
  const calculatedDuration = baseSpeechDuration * emotionMultiplier * intensityMultiplier
  
  // Apply reasonable bounds: minimum 2 seconds, maximum 15 seconds
  return Math.max(2000, Math.min(15000, calculatedDuration))
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
  const action = analyzeMessageForActions(message)
  const intensity = getEmotionIntensity(message.text)
  
  // Calculate appropriate emotion duration based on content
  const relaxTime = calculateEmotionDuration(message.text, emotion, intensity)
  
  const performance: PerformanceData = {
    emotion,
    action,
    bcounter: messageIndex,
    relaxTime, // Add calculated relaxation time
    whisper: message.visemeData as { words?: string[]; wtimes?: number[]; wdurations?: number[] } | undefined
  }

  const animation = selectAnimationForPerformance(performance, intensity)
  return { performance, animation }
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/**
 * Map emotion/action → animation clip. Intensity modulates speed/blend.
 */
export const selectAnimationForPerformance = (
  p: PerformanceData,
  intensity: number = 0.6
): AnimationPerformanceData | undefined => {
  // Base mapping to existing ANIMATION_CLIPS names
  let base: AnimationPerformanceData | undefined = undefined

  if (p.action === 'greeting') base = { name: 'Waving', loopCount: 1, blendTime: 500, speed: 0.9 }
  else if (p.action === 'farewell') base = { name: 'Bow', loopCount: 1, blendTime: 600, speed: 1.0 }
  else if (p.action === 'agreement') base = { name: 'Agreeing', loopCount: 1, blendTime: 500, speed: 0.85 }
  else if (p.action === 'disagreement') base = { name: 'Cocky Head Turn', loopCount: 1, blendTime: 500, speed: 0.9 }
  else {
    switch (p.emotion) {
      case 'happy':
        base = { name: 'Happy Hand Gesture', loopCount: 1, blendTime: 500, speed: 1.0 }
        break
      case 'sad':
        base = { name: 'Looking', loopCount: 1, blendTime: 600, speed: 0.8 }
        break
      case 'angry':
        base = { name: 'Reacting', loopCount: 1, blendTime: 500, speed: 1.0 }
        break
      case 'fear':
        base = { name: 'Surprised', loopCount: 1, blendTime: 400, speed: 1.0 }
        break
      case 'disgust':
        base = { name: 'Shaking It Off', loopCount: 1, blendTime: 450, speed: 0.95 }
        break
      case 'love':
        base = { name: 'Hands Forward Gesture', loopCount: 1, blendTime: 500, speed: 0.9 }
        break
      default:
        break
    }
  }

  if (base === undefined) return
  // Intensity-based modulation
  const speedScale = clamp(0.75 + intensity * 0.5, 0.75, 1.25) // 0.75..1.25
  const blendScale = clamp(1.0 - intensity * 0.3, 0.7, 1.0) // higher intensity → faster blend

  return {
    name: base.name,
    loopCount: base.loopCount,
    speed: clamp((base.speed ?? 1.0) * speedScale, 0.5, 1.6),
    blendTime: Math.round((base.blendTime ?? 400) * blendScale),
    immediate: true
  }
}

export const reactionIntegrationService = {
  createReactionFromMessage,
  selectAnimationForPerformance
}
