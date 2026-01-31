import type { AnimationPerformanceData } from '../services/animation/animationTypes'
import type { ConversationMessage } from '../services/conversation/conversationType'
import type { PerformanceData } from '../services/emote/emoteTypes'
import { detectEmotionFromText, getEmotionIntensity } from './emotionIntegration'

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
  _p: PerformanceData,
  _intensity: number = 0.6
): AnimationPerformanceData | undefined => {
  // Base mapping to existing ANIMATION_CLIPS names
  let base: AnimationPerformanceData | undefined = undefined

  /*if (p.action === 'greeting') base = { clip: ANIMATION_CLIPS.wave, loopCount: 1, blendTime: 500, speed: 0.9 }
  else if (p.action === 'farewell') base = { clip: ANIMATION_CLIPS.bow, loopCount: 1, blendTime: 600, speed: 1.0 }
  else if (p.action === 'agreement') base = { clip: ANIMATION_CLIPS.agree, loopCount: 1, blendTime: 500, speed: 0.85 }
  else if (p.action === 'disagreement') base = { clip: ANIMATION_CLIPS.cocky_head_turn, loopCount: 1, blendTime: 500, speed: 0.9 }
  else {
    switch (p.emotion) {
      case 'happy':
        base = { clip: ANIMATION_CLIPS.happy_hand_gesture, loopCount: 1, blendTime: 500, speed: 1.0 }
        break
      case 'sad':
        base = { clip: ANIMATION_CLIPS.looking, loopCount: 1, blendTime: 600, speed: 0.8 }
        break
      case 'angry':
        base = { clip: ANIMATION_CLIPS.reacting, loopCount: 1, blendTime: 500, speed: 1.0 }
        break
      case 'fear':
        base = { clip: ANIMATION_CLIPS.surprised, loopCount: 1, blendTime: 400, speed: 1.0 }
        break
      case 'disgust':
        base = { clip: ANIMATION_CLIPS.shaking_it_off, loopCount: 1, blendTime: 450, speed: 0.95 }
        break
      case 'love':
        base = { clip: ANIMATION_CLIPS.hands_forward_gesture, loopCount: 1, blendTime: 500, speed: 0.9 }
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
  } */

  return base
}

export const reactionIntegrationService = {
  createReactionFromMessage,
  selectAnimationForPerformance
}
