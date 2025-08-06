import type { EmoteState, EmotionType, FacialTarget, GazeOptions, PerformanceData } from './emoteTypes'
import { moodConfigurations } from './moodConfigurations'

const clamp = (num: number, min: number, max: number): number =>
  Math.max(Math.min(num, Math.max(min, max)), Math.min(min, max))

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
    nextBlinkTime: performance.now() + Math.random() * 3000 + 1000,
    isBlinking: false,
    blinkStartTime: 0
  },
  gazeState: {
    isGazing: false,
    gazeStartTime: 0,
    gazeEndTime: 0,
    headDefaultQuaternion: null,
    headCurrentQuaternion: null,
    headTargetQuaternion: null,
    isPlayerVisible: false
  },
  tickState: {
    currentTick: null,
    tickStartTime: 0
  }
})

/**
 * Reset the emote state to neutral
 */
export const resetEmoteState = (state: EmoteState): void => {
  state.targets = {}
  state.currentEmotion = 'neutral'
  state.isPerforming = false
  state.relaxationTime = 0
  applyEmotion(state, 'neutral')
}

/**
 * Apply an emotion to the avatar's facial expressions
 */
export const applyEmotion = (state: EmoteState, emotion: EmotionType): void => {
  if (!emotion || emotion.length === 0) return

  const moodConfig = moodConfigurations[emotion.toLowerCase()]
  if (!moodConfig?.baseline) return

  // Apply baseline expression values
  Object.entries(moodConfig.baseline).forEach(([key, value]) => {
    if (typeof value === 'number') {
      state.targets[key as keyof FacialTarget] = value
    }
  })

  state.currentEmotion = emotion
}

/**
 * Handle blinking behavior
 */
export const updateBlinking = (state: EmoteState, currentTime: number): void => {
  if (!state.targets) return

  const { blinkState } = state

  // Time to start a new blink
  if (currentTime >= blinkState.nextBlinkTime && !blinkState.isBlinking) {
    blinkState.isBlinking = true
    blinkState.blinkStartTime = currentTime
    blinkState.nextBlinkTime = currentTime + Math.random() * 4000 + 2000 // 2-6 seconds
  }

  // Handle active blink
  if (blinkState.isBlinking) {
    const blinkDuration = currentTime - blinkState.blinkStartTime
    const blinkCycleDuration = 300 // Total blink cycle time in ms

    if (blinkDuration < blinkCycleDuration) {
      // Blink animation using sine wave
      const blinkValue = clamp(Math.sin((blinkDuration / blinkCycleDuration) * Math.PI), 0, 1)
      state.targets.eyeBlinkLeft = blinkValue
      state.targets.eyeBlinkRight = blinkValue
    } else {
      // End blink
      blinkState.isBlinking = false
      state.targets.eyeBlinkLeft = 0
      state.targets.eyeBlinkRight = 0
    }
  }
}

/**
 * Handle subtle facial ticks for natural animation
 */
export const updateFacialTicks = (state: EmoteState, currentTime: number): void => {
  if (!state.targets) return

  const { tickState } = state

  const tickTargets: (keyof FacialTarget)[] = [
    'mouthDimpleLeft',
    'mouthDimpleRight',
    'mouthLeft',
    'mouthPress',
    'mouthStretchLeft',
    'mouthStretchRight',
    'browDownLeft',
    'browDownRight',
    'browOuterUpLeft',
    'browOuterUpRight',
    'browInnerUp',
    'cheekSquintLeft',
    'cheekSquintRight'
  ]

  // Generate tick value based on time
  const tickValue = clamp(Math.sin(currentTime / 700) * 10 - 10 + 1, 0, 1)

  if (!tickValue) {
    tickState.currentTick = null
    return
  }

  // Pick a new tick target if needed
  if (!tickState.currentTick) {
    tickState.currentTick = tickTargets[Math.floor(Math.random() * tickTargets.length)]
  }

  // Apply tick animation
  if (tickState.currentTick && state.targets[tickState.currentTick] !== undefined) {
    state.targets[tickState.currentTick] = tickValue / 2.0
  }
}

/**
 * Initiate gaze behavior
 */
export const initiateGaze = (state: EmoteState, options: GazeOptions = {}): void => {
  if (!state.bones?.Head) return

  const { delay = -1, duration = -1, randomness = 0 } = options

  // Don't always gaze
  if (randomness > 0 && Math.random() > randomness) return

  const currentTime = performance.now()
  const actualDelay = delay < 0 ? Math.random() * 1000 : delay
  const actualDuration = duration < 0 ? Math.random() * 1000 + 4000 : duration

  state.gazeState.gazeStartTime = currentTime + actualDelay
  state.gazeState.gazeEndTime = currentTime + actualDelay + actualDuration
  state.gazeState.isGazing = true

  // Store current head quaternion (simplified for now)
  state.gazeState.headCurrentQuaternion = [0, 0, 0, 1]
}

/**
 * Update gaze behavior
 */
export const updateGaze = (state: EmoteState, currentTime: number): void => {
  // Get camera from scene or node hierarchy
  let camera = null
  if (state.scene?.camera) {
    camera = state.scene.camera
  } else if (state.node?.parent?.children?.[0]) {
    camera = state.node.parent.children[0]
  }

  if (!camera || !state.node || !state.bones?.Head) return

  const { gazeState } = state

  // Check if player is visible (simplified version)
  // In a real implementation, you'd use proper Three.js vector operations
  const isVisible = true // Simplified - would calculate actual visibility

  // State transition to becoming visible
  if (isVisible && !gazeState.isPlayerVisible) {
    initiateGaze(state)
  }
  gazeState.isPlayerVisible = isVisible

  // Check if we're in active focus period
  const isActiveFocus = gazeState.gazeStartTime < currentTime && gazeState.gazeEndTime > currentTime

  if (isVisible && isActiveFocus) {
    // Focus on player quickly
    // In real implementation, would calculate proper lookAt matrix and quaternions
    // Apply gaze rotation to head bone
  } else if (isVisible && state.relaxationTime > currentTime) {
    // Maintain some focus while performing
    // Apply partial focus
  } else {
    // Relax to origin slowly
    // Reset head rotation gradually
  }
}

/**
 * Start a performance based on performance data
 */
export const startPerformance = (state: EmoteState, performanceData: PerformanceData, startTime: number): void => {
  if (!performanceData) return

  // Apply emotion if specified
  if (performanceData.emotion) {
    applyEmotion(state, performanceData.emotion)
  }

  // Handle body actions (placeholder for future implementation)
  if (performanceData.action) {
    // TODO: Implement body action animations
  }

  // Coordinate with viseme system if whisper data is provided
  if (performanceData.whisper) {
    // TODO: Coordinate with viseme service for lip sync
  }

  // Set up gaze behavior based on utterance counter
  const segment = performanceData.bcounter ?? 0
  const gazeRandomness = segment < 2 ? 0 : 0.5
  initiateGaze(state, { randomness: gazeRandomness })

  state.isPerforming = true
  state.performanceStartTime = startTime

  // Set relaxation time (when performance should end)
  // This would be coordinated with speech/viseme duration
  state.relaxationTime = startTime + 5000 // Default 5 seconds
}

/**
 * Handle barge-in interruption
 */
export const handleBargeIn = (state: EmoteState): void => {
  resetEmoteState(state)
  console.log('Emote system relaxing due to barge-in')
}

/**
 * Main update function called each frame
 */
export const updateEmoteState = (state: EmoteState, currentTime: number): void => {
  // Update blinking
  updateBlinking(state, currentTime)

  // Update gaze
  updateGaze(state, currentTime)

  // If actively performing, don't apply ticks
  if (state.isPerforming && state.relaxationTime > currentTime) {
    // During performance, maintain current expressions
    return
  } else {
    // Apply subtle facial ticks during idle
    updateFacialTicks(state, currentTime)
    state.isPerforming = false
  }
}

/**
 * Apply emote state to VRM avatar
 */
export const applyEmoteStateToVRM = (
  state: EmoteState,
  vrm: { expressionManager: { setValue: (key: string, value: number) => void } }
): void => {
  if (!vrm?.expressionManager || !state.targets) return

  Object.entries(state.targets).forEach(([key, value]) => {
    if (typeof value === 'number') {
      try {
        vrm.expressionManager.setValue(key, value)
      } catch {
        // Silently handle unsupported expression keys
      }
    }
  })
}

/**
 * Apply emote state to morph target avatars
 */
export const applyEmoteStateToMorphTargets = (
  state: EmoteState,
  morphs: { morphTargetInfluences: number[] }[],
  dictionary: Record<string, number[]>
): void => {
  if (!morphs || !dictionary || !state.targets) return

  Object.entries(state.targets).forEach(([key, value]) => {
    if (typeof value === 'number' && dictionary[key]) {
      dictionary[key].forEach((index) => {
        morphs.forEach((morph) => {
          if (morph.morphTargetInfluences && morph.morphTargetInfluences[index] !== undefined) {
            morph.morphTargetInfluences[index] = value
          }
        })
      })
    }
  })
}

/**
 * Setup emote state for VRM integration
 */
export const setupEmoteStateForVRM = (
  state: EmoteState,
  vrm: { expressionManager: { setValue: (key: string, value: number) => void } }
): void => {
  state.vrm = vrm
}

/**
 * Setup emote state for morph target integration
 */
export const setupEmoteStateForMorphTargets = (
  state: EmoteState,
  morphs: { morphTargetInfluences: number[] }[],
  dictionary: Record<string, number[]>
): void => {
  state.morphs = morphs
  state.dictionary = dictionary
}
