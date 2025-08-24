import type { VRM } from '@pixiv/three-vrm'
import { Vector3 } from 'three'

import {
  VRM_EXPRESSIONS,
  type EmoteResult,
  type EmoteState,
  type EmotionType,
  type FacialTarget,
  type PerformanceData
} from './emoteTypes'
import { updateBlinking } from './modules/blinkingService'
import { updateFacialTicks } from './modules/facialTicksService'
import { initiateGaze, updateGaze } from './modules/gazeService'
import { moodConfigurations } from './configs/moodConfigurations'
import { safeExecute } from './utils/errorHandling'
import { applyExpression, resetAllExpressions } from './utils/expressionUtils'
import type { EmoteConfig } from './configs/emoteConfig'

/**
 * Initialize a new emote state
 */
export const initializeEmoteState = (): EmoteState => ({
  targets: {},
  currentEmotion: 'neutral',
  isPerforming: false,
  performanceStartTime: 0,
  relaxationTime: 0,
  
  blinkState: {
    nextBlinkTime: performance.now() + Math.random() * 4000 + 1000,
    isBlinking: false,
    blinkStartTime: 0,
  },
  gazeState: {
    isGazing: false,
    gazeTime: {
      start: 0,
      end: 0
    },
    isPlayerVisible: false,
    target: new Vector3(0, 0, 1),
    neckOptions: {
      quaternions: {
        current: null,
        default: null
      }
    }
  },
  tickState: {
    currentTick: null,
    tickStartTime: 0,
  }
})

/**
 * Reset the emote state to neutral, restoring all sub-states to their initialized values.
 */
export const resetEmoteState = (state: EmoteState ): void => {
  // Reset targets and emotion
  state.targets = {}
  state.currentEmotion = 'neutral'
  state.isPerforming = false
  state.performanceStartTime = 0

  // Reset relaxation time
  state.relaxationTime = 0

  // Reset blink state

  state.blinkState.nextBlinkTime = performance.now() + Math.random() * 4000 + 1000
  state.blinkState.isBlinking = false
  state.blinkState.blinkStartTime = 0

  // Reset gaze state
  state.gazeState.isGazing = false
  state.gazeState.gazeTime.start = 0
  state.gazeState.gazeTime.end = 0
  state.gazeState.isPlayerVisible = false
  state.gazeState.target = new Vector3(0, 0, 1)
  if (state.gazeState.neckOptions) {
    state.gazeState.neckOptions.quaternions.current = null
    state.gazeState.neckOptions.quaternions.default = null
  }

  // Reset tick state
  state.tickState.currentTick = null
  state.tickState.tickStartTime = 0

  // Reset all expressions to neutral (both VRM and morph targets)
  Object.values(VRM_EXPRESSIONS).forEach((expression) => {
    applyExpression(state, expression, 0)
  })
  // Set neutral expression
  applyExpression(state, VRM_EXPRESSIONS.neutral, 1)

  applyEmotion(state, 'neutral')
  console.log('Emote state reset to neutral')
}

/**
 * Apply an emotion to the avatar's facial expressions
 */
export const applyEmotion = (state: EmoteState, emotion: EmotionType): EmoteResult => {
  return safeExecute(() => {
    applyEmotionInternal(state, emotion)
  }, `Failed to apply emotion: ${emotion}`)
}

const applyEmotionInternal = (state: EmoteState, emotion: EmotionType): void => {
  if (!emotion?.length) return

  const moodConfig = moodConfigurations[emotion.toLowerCase()]
  if (!moodConfig?.baseline) return

  // Apply baseline expression values
  Object.entries(moodConfig.baseline).forEach(([key, value]) => {
    if (typeof value === 'number') {
      state.targets[key as keyof FacialTarget] = value
    }
  })

  // Reset previous emotions
  const emotionExpressions = ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'neutral'] as const
  resetAllExpressions(state, emotionExpressions)

  // Map and apply VRM emotion
  const vrmEmotion = mapEmotionToVRM(emotion)
  if (vrmEmotion && vrmEmotion in VRM_EXPRESSIONS) {
    applyExpression(state, VRM_EXPRESSIONS[vrmEmotion], 0.8)
  }

  state.currentEmotion = emotion
}

const mapEmotionToVRM = (emotion: EmotionType): keyof typeof VRM_EXPRESSIONS | null => {
  const emotionMap: Record<EmotionType, keyof typeof VRM_EXPRESSIONS> = {
    fear: 'surprised',
    love: 'happy',
    disgust: 'angry',
    sleep: 'relaxed',
    happy: 'happy',
    angry: 'angry',
    sad: 'sad',
    neutral: 'neutral'
  }

  return emotionMap[emotion] || 'neutral'
}

// Blinking logic moved to modules/blinkingService.ts

// Facial ticks logic moved to modules/facialTicksService.ts

// Gaze logic moved to modules/gazeService.ts

// All gaze-related functions moved to modules/gazeService.ts
/**
 * Start a performance based on performance data
 */

/**
 * Main update function with modular approach
 */
export const emoteUpdate = (state: EmoteState, delta: number, config: EmoteConfig): void => {
  const currentTime = performance.now()

  // Update VRM systems first
  updateVRMSystems(state, delta)

  // Update core modules
  updateBlinking(state, delta , config)
  updateGaze(state, delta ,config)
  // Apply facial ticks only when not performing
  if (!state.isPerforming || state.relaxationTime <= currentTime) {
    updateFacialTicks(state, delta , config)
    state.isPerforming = false
  }
}

const updateVRMSystems = (state: EmoteState, delta: number): void => {
  if (!state.vrm) return

  safeExecute(() => {
    if (state.vrm!.lookAt) {
      state.vrm!.lookAt.update(delta)
    }

    if (state.vrm!.expressionManager) {
      state.vrm!.expressionManager.update()
    }
  }, 'VRM system update failed')
}

export const startPerformance = (state: EmoteState, performanceData: PerformanceData, _delta: number ): EmoteResult => {
  return safeExecute(() => {
    if (!performanceData) return

    const startTime = performance.now()

    // Apply emotion if specified
    if (performanceData.emotion) {
      const emotionResult = applyEmotion(state, performanceData.emotion)
      if (!emotionResult.success) {
        console.warn('Failed to apply emotion during performance:', emotionResult.error)
      }
    }

    // Handle body actions (placeholder for future implementation)
    if (performanceData.action) {
      // TODO: Implement body action animations
    }

    // Note: Mouth/viseme handling is done by separate viseme service
    // We don't handle whisper data here

    // Set up gaze behavior based on utterance counter
    const segment = performanceData.bcounter ?? 0
    const gazeRandomness = segment < 2 ? 0 : 0.5
    initiateGaze(state, { randomness: gazeRandomness })

    state.isPerforming = true
    state.performanceStartTime = startTime

    // Set relaxation time (when performance should end)
    state.relaxationTime = startTime + (performanceData.relaxTime ?? 500)
  }, 'Failed to start performance')
}

/**
 * Handle barge-in interruption
 */
export const handleBargeIn = (state: EmoteState): void => {
  resetEmoteState(state)
  console.log('Emote system relaxing due to barge-in')
}

/**
 * Apply emote state to VRM avatar
 */
export const applyEmoteStateToVRM = (state: EmoteState, vrm: VRM): EmoteResult => {
  return safeExecute(() => {
    if (!vrm?.expressionManager || !state.targets) return

    Object.entries(state.targets).forEach(([key, value]) => {
      if (typeof value === 'number') {
        try {
          vrm.expressionManager!.setValue(key, value)
        } catch {
          // Silently handle unsupported expression keys
        }
      }
    })
  }, 'Failed to apply emote state to VRM')
}

/**
 * Apply emote state to morph target avatars
 */
export const applyEmoteStateToMorphTargets = (
  state: EmoteState,
  morphs: { morphTargetInfluences: number[] }[],
  dictionary: Record<string, number[]>
): EmoteResult => {
  return safeExecute(() => {
    if (!morphs?.length || !dictionary || !state.targets) return

    Object.entries(state.targets).forEach(([key, value]) => {
      if (typeof value === 'number' && dictionary[key]) {
        dictionary[key].forEach((index) => {
          morphs.forEach((morph) => {
            if (morph.morphTargetInfluences?.[index] !== undefined) {
              morph.morphTargetInfluences[index] = value
            }
          })
        })
      }
    })
  }, 'Failed to apply emote state to morph targets')
}

/**
 * Setup emote state for VRM integration
 */
export const setupEmoteStateForVRM = (state: EmoteState, vrm: VRM): EmoteResult => {
  return safeExecute(() => {
    if (!vrm) throw new Error('VRM is required')

    state.vrm = vrm

    // Initialize VRM systems
    if (vrm.lookAt) {
      vrm.lookAt.target?.position.copy(new Vector3(0, 0, 1)) // Look forward by default
    }

    console.log('VRM integration setup complete')
  }, 'VRM setup failed')
}
/**
 * Setup emote state for morph target integration
 */
export const setupEmoteStateForMorphTargets = (
  state: EmoteState,
  morphs: { morphTargetInfluences: number[] }[],
  dictionary: Record<string, number[]>
): EmoteResult => {
  return safeExecute(() => {
    if (!morphs?.length) throw new Error('Morphs array is required')
    if (!dictionary || !Object.keys(dictionary).length) {
      throw new Error('Dictionary is required')
    }

    state.morphs = morphs
    state.dictionary = dictionary

    console.log('Morph targets integration setup complete')
  }, 'Morph targets setup failed')
}
