import type { VRM } from '@pixiv/three-vrm'
import type { EmoteState, EmotionType, FacialTarget, GazeOptions, PerformanceData } from './emoteTypes'
import { moodConfigurations } from './moodConfigurations'
import { Object3D, Vector3, type PerspectiveCamera } from 'three'
import type { Camera } from '@react-three/fiber'

const clamp = (num: number, min: number, max: number): number =>
  Math.max(Math.min(num, Math.max(min, max)), Math.min(min, max))


const VRM_EXPRESSIONS = {
  // Basic emotions
  happy: 'happy',
  angry: 'angry', 
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',
  
  // Eye expressions
  blink: 'blink',
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
  lookUp: 'lookUp',
  lookDown: 'lookDown',
  lookLeft: 'lookLeft',
  lookRight: 'lookRight',
  
  // Additional expressions
  neutral: 'neutral'
} as const

const applyExpression = (state: EmoteState, expressionName: string, value: number): void => {
  const clampedValue = clamp(value, 0, 1)
  
  // Apply to VRM if available
  if (state.vrm?.expressionManager) {
    try {
      state.vrm.expressionManager.setValue(expressionName, clampedValue)
    } catch (error) {
      // Silently handle unsupported expressions
    }
  }
  
  // Apply to morph targets if available
  if (state.morphs && state.dictionary && state.dictionary[expressionName]) {
    state.dictionary[expressionName].forEach((index) => {
      state.morphs!.forEach((morph) => {
        if (morph.morphTargetInfluences && morph.morphTargetInfluences[index] !== undefined) {
          morph.morphTargetInfluences[index] = clampedValue
        }
      })
    })
  }
  
  // Store in state targets for consistency
  state.targets[expressionName as keyof FacialTarget] = clampedValue
}

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
  
  // Reset all expressions to neutral (both VRM and morph targets)
  Object.values(VRM_EXPRESSIONS).forEach(expression => {
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
export const applyEmotion = (state: EmoteState, emotion: EmotionType): void => {
  if (!emotion || emotion.length === 0) return

  const moodConfig = moodConfigurations[emotion.toLowerCase()]
  if (!moodConfig?.baseline) return

  // Apply baseline expression values to targets (for morph target compatibility)
  Object.entries(moodConfig.baseline).forEach(([key, value]) => {
    if (typeof value === 'number') {
      state.targets[key as keyof FacialTarget] = value
    }
  });

  // Apply VRM emotion expressions to both VRM and morph targets
  // Clear previous emotions
  ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'neutral'].forEach(expression => {
    applyExpression(state, expression, 0)
  })
  
  // Map emotion to VRM expression
  const vrmEmotion = emotion === 'fear' ? 'surprised' : 
                    emotion === 'love' ? 'happy' :
                    emotion === 'disgust' ? 'angry' :
                    emotion === 'sleep' ? 'relaxed' :
                    emotion in VRM_EXPRESSIONS ? emotion as keyof typeof VRM_EXPRESSIONS : 'neutral'
  
  if (vrmEmotion in VRM_EXPRESSIONS) {
    applyExpression(state, VRM_EXPRESSIONS[vrmEmotion], 0.8)
  }

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
      
      // Apply to both VRM and morph targets
      applyExpression(state, VRM_EXPRESSIONS.blink, blinkValue)
    } else {
      // End blink
      blinkState.isBlinking = false
      
      // Reset blink for both systems
      applyExpression(state, VRM_EXPRESSIONS.blink, 0)
    }
  }
}

/**
 * Handle subtle facial ticks for natural animation
 */
export const updateFacialTicks = (state: EmoteState, currentTime: number): void => {
  if (!state.targets) return

  const { tickState } = state

  // Non-mouth tick expressions for subtle movement
  const vrmTickExpressions = [
    VRM_EXPRESSIONS.lookLeft,   // Subtle eye movement
    VRM_EXPRESSIONS.lookRight,  // Subtle eye movement
  ]

  const tickTargets: (keyof FacialTarget)[] = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft', 
    'browOuterUpRight',
    'cheekSquintLeft',
    'cheekSquintRight'
  ]

  // Generate tick value based on time (more subtle for natural look)
  const tickIntensity = 0.08 // Reduced intensity for subtlety
  const tickValue = clamp(Math.sin(currentTime / 1200) * tickIntensity, 0, tickIntensity)

  if (tickValue <= 0.01) {
    tickState.currentTick = null
    return
  }

  // Pick a new tick target if needed
  if (!tickState.currentTick || Math.random() < 0.3) {
    tickState.currentTick = tickTargets[Math.floor(Math.random() * tickTargets.length)]
  }

  // Apply tick animation to state targets (for morph target compatibility)
  if (tickState.currentTick && state.targets[tickState.currentTick] !== undefined) {
    state.targets[tickState.currentTick] = tickValue
  }

  // Apply subtle VRM tick expressions (eye movements only)
  if (Math.random() < 0.05) { // Even less frequent for subtlety
    const randomVrmTick = vrmTickExpressions[Math.floor(Math.random() * vrmTickExpressions.length)]
    applyExpression(state, randomVrmTick, tickValue * 0.2) // Very subtle for VRM
    
    // Clear the expression shortly after
    setTimeout(() => {
      applyExpression(state, randomVrmTick, 0)
    }, 200)
  }
}
/**
 * Initiate gaze behavior
 */
export const initiateGaze = (state: EmoteState, options: GazeOptions = {}): void => {
  if (!state.bones?.Head) return
  console.log("DEBUG initiate gaze", state.camera)

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
  if (state.vrm && state.vrm.scene) {
    const headBone = state.vrm.humanoid?.getNormalizedBoneNode('head')
    if (headBone) {
      state.gazeState.headDefaultQuaternion = [
        headBone.quaternion.x,
        headBone.quaternion.y, 
        headBone.quaternion.z,
        headBone.quaternion.w
      ]
    }
  }}


/**
 * Update gaze behavior
 */
export const updateGaze = (state: EmoteState, currentTime: number): void => {
  // Get camera from scene or node hierarchy
  let camera : Camera | undefined = undefined
 
  camera = state?.camera

  console.log("DEBUG update gaze", camera)
  if (!camera) return

  const { gazeState } = state

  // Check if player is visible (simplified version)
  const isVisible = true // In real implementation, you'd calculate actual visibility

  // State transition to becoming visible
  if (isVisible && !gazeState.isPlayerVisible) {
    initiateGaze(state)
  }
  gazeState.isPlayerVisible = isVisible

  // Check if we're in active focus period
  const isActiveFocus = gazeState.gazeStartTime < currentTime && gazeState.gazeEndTime > currentTime

  if (isVisible && isActiveFocus && camera && 'position' in camera) {
    const cameraPosition = camera.position as Vector3
    
    // Apply VRM LookAt system if available
    if (state.vrm?.lookAt) {
      state.vrm.lookAt.lookAt(cameraPosition)
    }
    
    // Apply gaze expressions to both VRM and morph targets
    const gazeIntensity = 0.3
    if (Math.abs(cameraPosition.x) > Math.abs(cameraPosition.y)) {
      // Horizontal gaze
      if (cameraPosition.x > 0) {
        applyExpression(state, VRM_EXPRESSIONS.lookRight, gazeIntensity)
        applyExpression(state, VRM_EXPRESSIONS.lookLeft, 0)
      } else {
        applyExpression(state, VRM_EXPRESSIONS.lookLeft, gazeIntensity)
        applyExpression(state, VRM_EXPRESSIONS.lookRight, 0)
      }
    } else {
      // Vertical gaze
      if (cameraPosition.y > 0) {
        applyExpression(state, VRM_EXPRESSIONS.lookUp, gazeIntensity)
        applyExpression(state, VRM_EXPRESSIONS.lookDown, 0)
      } else {
        applyExpression(state, VRM_EXPRESSIONS.lookDown, gazeIntensity)
        applyExpression(state, VRM_EXPRESSIONS.lookUp, 0)
      }
    }
  } else if (isVisible && state.relaxationTime > currentTime) {
    // Maintain some focus while performing
    if (state.vrm?.lookAt && camera && 'position' in camera) {
      const cameraPosition = camera.position as Vector3
      state.vrm.lookAt.lookAt(cameraPosition.clone().multiplyScalar(0.5)) // Partial focus
    }
  } else {
    // Relax gaze to neutral
    if (state.vrm?.lookAt) {
      state.vrm.lookAt.target?.lookAt(new Vector3(0, 0, 1)) // Look forward
    }
    
    // Reset look expressions for both systems
    applyExpression(state, VRM_EXPRESSIONS.lookUp, 0)
    applyExpression(state, VRM_EXPRESSIONS.lookDown, 0)
    applyExpression(state, VRM_EXPRESSIONS.lookLeft, 0)
    applyExpression(state, VRM_EXPRESSIONS.lookRight, 0)
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

  // Note: Mouth/viseme handling is done by separate viseme service
  // We don't handle whisper data here

  // Set up gaze behavior based on utterance counter
  const segment = performanceData.bcounter ?? 0
  const gazeRandomness = segment < 2 ? 0 : 0.5
  initiateGaze(state, { randomness: gazeRandomness })

  state.isPerforming = true
  state.performanceStartTime = startTime

  // Set relaxation time (when performance should end)
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
  // Update VRM systems first
  if (state.vrm) {
    // Update VRM LookAt system
    if (state.vrm.lookAt) {
      state.vrm.lookAt.update(currentTime / 1000) // VRM expects time in seconds
    }
    
    // Update VRM expression manager
    if (state.vrm.expressionManager) {
      state.vrm.expressionManager.update()
    }
  }

  // Update blinking (with VRM integration)
  updateBlinking(state, currentTime)

  // Update gaze (with VRM integration)
  updateGaze(state, currentTime)

  // If actively performing, don't apply ticks
  if (state.isPerforming && state.relaxationTime > currentTime) {
    // During performance, maintain current expressions
    return
  } else {
    // Apply subtle facial ticks during idle (with VRM integration)
    updateFacialTicks(state, currentTime)
    state.isPerforming = false
  }
}

/**
 * Apply emote state to VRM avatar
 */
export const applyEmoteStateToVRM = (
  state: EmoteState,
  vrm: VRM
): void => {
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
  vrm: VRM
): void => {
  state.vrm = vrm
  
  // Initialize VRM systems
  if (vrm.lookAt) {
    vrm.lookAt.lookAt(new Vector3(0, 0, 1)) // Look forward by default
  }
  
  console.log('VRM integration setup complete')
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
