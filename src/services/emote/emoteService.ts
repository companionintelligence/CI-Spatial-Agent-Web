import type { VRM } from '@pixiv/three-vrm'
import type { EmoteState, EmotionType, FacialTarget, GazeOptions, PerformanceData, PlayerVisionType } from './emoteTypes'
import { moodConfigurations } from './moodConfigurations'
import { Euler, Quaternion, Vector3 } from 'three'
import type { Camera } from '@react-three/fiber'
import { DEG2RAD } from 'three/src/math/MathUtils.js'

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
    neckDefaultQuaternion: null,
    neckCurrentQuaternion: null,
    isPlayerVisible: false,
    eyeOptions: {
      interpolatedTarget : new Vector3(),
      interpolationFactor : 4,
      maxDistance: 2  ,
      focusedHorizontalAngle : 30, 
      focusedVerticalAngle  : 25,  
      peripheralHorizontalAngle  : 100, 
      peripheralVerticalAngle  : 60, 
    },
    neckOptions:{
      maxPitch : 60,
      maxYaw : 60,
    }
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
export const updateBlinking = (state: EmoteState, _delta: number): void => {
  if (!state.targets) return
  const currentTime = performance.now()
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
export const updateFacialTicks = (state: EmoteState, _delta: number): void => {
  if (!state.targets) return
  const currentTime = performance.now()
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

function smoothVector(
  current: Vector3,
  target: Vector3,
  delta: number,
  factor: number
): Vector3 {
  return current.lerp(target, 1 - Math.exp(-delta * factor));
}

// Apply eye-only gaze
function updateEyeGaze(state: EmoteState, target: Vector3) {
  if (!state.vrm?.lookAt) return;
  // Blend between forward and target for subtlety
  state.vrm.lookAt.lookAt(target);
}

// Apply neck rotation toward target (yaw and pitch: y and x axes; eyes follow)
function updateNeckGaze(state: EmoteState, target: Vector3, delta: number) {
  if (!state.bones?.neck) return;

  if (!state.gazeState.neckDefaultQuaternion) {
    state.gazeState.neckDefaultQuaternion =
      state.bones.neck.quaternion.toArray() as [number, number, number, number];
  }

  const baseBone = state.bones.spine2 || state.bones.spine || null;
  if (!baseBone) return;

  const neckWorld = state.bones.neck.getWorldPosition(new Vector3());

  // Compute direction to target in world space
  const toTarget = new Vector3().subVectors(target, neckWorld).normalize();

  // Get neck's forward direction in world space
  const neckForward = new Vector3(0, 0, -1).applyQuaternion(state.bones.neck.quaternion).normalize();

  // Calculate yaw (rotation around y axis)
  const toTargetXZ = new Vector3(toTarget.x, 0, toTarget.z).normalize();
  const neckForwardXZ = new Vector3(neckForward.x, 0, neckForward.z).normalize();
  let yawAngle = neckForwardXZ.angleTo(toTargetXZ);
  const crossYaw = new Vector3().crossVectors(neckForwardXZ, toTargetXZ);
  const signYaw = Math.sign(crossYaw.y); // y axis is up
  yawAngle *= signYaw;

  // Clamp yaw angle (±60°)
  const maxYaw = 60 * DEG2RAD;
  yawAngle = Math.max(-maxYaw, Math.min(maxYaw, yawAngle));

  // Calculate pitch (rotation around x axis)
  // Project toTarget and neckForward onto YZ plane (ignore X for pitch)
  const toTargetYZ = new Vector3(0, toTarget.y, toTarget.z).normalize();
  const neckForwardYZ = new Vector3(0, neckForward.y, neckForward.z).normalize();
  let pitchAngle = neckForwardYZ.angleTo(toTargetYZ);
  const crossPitch = new Vector3().crossVectors(neckForwardYZ, toTargetYZ);
  const signPitch = Math.sign(crossPitch.x); // x axis is right
  pitchAngle *= signPitch;

  // Clamp pitch angle (±60°)
  const maxPitch = 60 * DEG2RAD;

  // Decay pitch for higher yaw: when looking to the side, reduce pitch range
  // Decay factor: 1 at yaw=0, 0 at |yaw|=maxYaw
  const yawAbs = Math.abs(yawAngle);
  // Make decay sharper: use a higher exponent (e.g. 2.5)
  const pitchDecay = Math.pow(1 - (yawAbs / maxYaw), 2.5); // Sharper dropoff from center to side
  const decayedMaxPitch = maxPitch * Math.max(0, pitchDecay);

  // Clamp pitch to decayed range
  pitchAngle = Math.max(-decayedMaxPitch, Math.min(decayedMaxPitch, pitchAngle));

  // Build target quaternion: yaw (y) and pitch (x)
  const defaultQuat = new Quaternion().fromArray(state.gazeState.neckDefaultQuaternion!);
  const euler = new Euler(pitchAngle, yawAngle, 0, "YXZ");
  const constrainedQuat = defaultQuat.clone().multiply(new Quaternion().setFromEuler(euler));

  // Smoothly interpolate neck toward constrained orientation
  state.bones.neck.quaternion.slerp(
    constrainedQuat,
    1 - Math.exp(-delta * state.gazeState.eyeOptions.interpolationFactor)
  );

  // Eyes follow neck movement with slight delay for natural look
  updateEyeGaze(state, target);
}
/**
 * Initiate gaze behavior
 */

export const initiateGaze = (state: EmoteState, options: GazeOptions = {}): void => {
  if (!state.bones?.neck) return

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
    const neckBone = state.vrm.humanoid?.getNormalizedBoneNode('neck')
    if (neckBone) {
      state.gazeState.neckDefaultQuaternion = [
        neckBone.quaternion.x,
        neckBone.quaternion.y, 
        neckBone.quaternion.z,
        neckBone.quaternion.w
      ]
    }
}}

/**
 * Returns the player's visibility state relative to the avatar's eyes.
 * - "focused": player is in central vision (foveal)
 * - "peripheral": player is in peripheral vision
 * - null: not visible
 */

function getPlayerVisionState(
  state: EmoteState,
  camera: Camera,
): PlayerVisionType {
  if (!state.node || !camera || !state.bones?.leftEye || !state.bones?.rightEye) return null;

  // Parameter defaults
  const {
    maxDistance ,
    focusedHorizontalAngle ,
    focusedVerticalAngle,
    peripheralHorizontalAngle ,
    peripheralVerticalAngle,
  } = state.gazeState.eyeOptions;

  // Get world positions
  const leftEyeWorldPos = state.bones.leftEye.getWorldPosition(new Vector3());
  const rightEyeWorldPos = state.bones.rightEye.getWorldPosition(new Vector3());
  const hipsWorldPos = state.bones.hips.getWorldPosition(new Vector3());
  const cameraPos = camera.position;


  // Calculate the midpoint between the eyes (approximate head center)
  const eyeMidpoint = new Vector3()
    .addVectors(leftEyeWorldPos, rightEyeWorldPos)
    .multiplyScalar(0.5);
  // Vector from eye midpoint to camera
  const toCameraVec = new Vector3().subVectors(cameraPos, eyeMidpoint);
  const cameraDistance = toCameraVec.length();

  // Always visible if camera is above the avatar (y axis)
  // Invisible if camera is below the avatar (y axis)
  if (cameraPos.y < hipsWorldPos.y) {
    return null;
  }

  // Invisible if outside of specified range
  if (cameraDistance > maxDistance) {
    return null;
  }
  
  // Helper to check if a single eye can see the target within given angles
  function eyeCanSee(eye: any, hAngle: number, vAngle: number): boolean {
    const eyePos = eye.getWorldPosition(new Vector3());
    const eyeForward = new Vector3(0, 0, -1).applyQuaternion(eye.quaternion).normalize();
    const eyeUp = new Vector3(0, 1, 0).applyQuaternion(eye.quaternion).normalize();
    const toTarget = cameraPos.clone().sub(eyePos).normalize();
    const eyeRight = new Vector3().crossVectors(eyeForward, eyeUp).normalize();
    const horizontalAngle = Math.atan2(
      toTarget.dot(eyeRight),
      toTarget.dot(eyeForward)
    );
    const verticalAngle = Math.atan2(
      toTarget.dot(eyeUp),
      toTarget.dot(eyeForward)
    );
    // Convert degree angles to radians for comparison
    const hAngleRad = hAngle * DEG2RAD;
    const vAngleRad = vAngle * DEG2RAD;
    // Uncomment for debugging:
    // console.log("DEBUG vertical", (verticalAngle * 180 / Math.PI), vAngle);
    // console.log("DEBUG horizontal", (horizontalAngle * 180 / Math.PI), hAngle);
    return (
      Math.abs(horizontalAngle) < hAngleRad &&
      Math.abs(verticalAngle) < vAngleRad
    );
  }

  // Focused (central vision)
  if (
    eyeCanSee(state.bones.leftEye, focusedHorizontalAngle, focusedVerticalAngle) ||
    eyeCanSee(state.bones.rightEye, focusedHorizontalAngle, focusedVerticalAngle)
  ) {
    return "focused";
  }

  // Peripheral vision
  if (
    eyeCanSee(state.bones.leftEye, peripheralHorizontalAngle, peripheralVerticalAngle) ||
    eyeCanSee(state.bones.rightEye, peripheralHorizontalAngle, peripheralVerticalAngle)
  ) {
    return "peripheral";
  }

  // Not visible
  return null;
}
/**
 * Update gaze behavior
 */
export const updateGaze = (state: EmoteState, delta: number): void => {
  const currentTime = performance.now();
  const camera: Camera | undefined = state?.camera;
  if (!camera || !state.vrm?.lookAt) return;

  const { gazeState } = state;

  // 1. Check visibility
  const visibilityState = getPlayerVisionState(state, camera);
  const isVisible =  visibilityState !== null;
  if (isVisible && !gazeState.isPlayerVisible) initiateGaze(state, {duration : Infinity});
  gazeState.isPlayerVisible = isVisible;

  // 2. Determine focus state
  const isActiveFocus =
    gazeState.gazeStartTime < currentTime &&
    gazeState.gazeEndTime > currentTime;

  // 3. Pick gaze target
  let target: Vector3;
  if (isVisible) {
    if (isActiveFocus) {
      target = camera.position.clone();
    } else if (state.relaxationTime > currentTime) {
      target = camera.position.clone().multiplyScalar(0.5);
    } else {
      target = new Vector3(0, 1.5, -1);
    }
  } else {
    target = new Vector3(0, 1.5, -1);
  }

  // 4. Smooth target
  gazeState.eyeOptions.interpolatedTarget = smoothVector(
    gazeState.eyeOptions.interpolatedTarget as Vector3,
    target,
    delta,
    gazeState.eyeOptions.interpolationFactor
  );


  if (isVisible) {
    switch (visibilityState) {
      case 'focused':
        // In central/paracentral vision: Eyes follow directly, neck stays neutral
        updateEyeGaze(state, gazeState.eyeOptions.interpolatedTarget as Vector3);
        // Return neck to neutral position
        if (state.gazeState.neckDefaultQuaternion && state.bones?.neck) {
          const defaultQuat = new Quaternion().fromArray(state.gazeState.neckDefaultQuaternion);
          state.bones.neck.quaternion.slerp(
            defaultQuat,
            1 - Math.exp(-delta * state.gazeState.eyeOptions.interpolationFactor)
          );
        }
        break;
      case 'peripheral':
        // In peripheral vision: Lead with neck, then eyes follow
      default:
        // Beyond peripheral vision: Lead with neck, eyes follow
        updateNeckGaze(state, gazeState.eyeOptions.interpolatedTarget as Vector3, delta);
        break;
    }
  } else {
    // Not visible: Return neck and eyes to neutral position
    if (state.gazeState.neckDefaultQuaternion && state.bones?.neck) {
      const defaultQuat = new Quaternion().fromArray(state.gazeState.neckDefaultQuaternion);
      state.bones.neck.quaternion.slerp(
        defaultQuat,
        1 - Math.exp(-delta * state.gazeState.eyeOptions.interpolationFactor)
      );
    }
    updateEyeGaze(state, new Vector3(0, 1.5, -1));
  }
};
/**
 * Start a performance based on performance data
 */
export const startPerformance = (state: EmoteState, performanceData: PerformanceData, _delta: number): void => {
  if (!performanceData) return
  const startTime = performance.now()
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
export const updateEmoteState = (state: EmoteState, _delta: number): void => {
  const currentTime = performance.now()
  // Update VRM systems first
  if (state.vrm) {
    // Update VRM LookAt system
    if (state.vrm.lookAt) {
      state.vrm.lookAt.update(_delta) // VRM expects time in seconds
    }
    
    // Update VRM expression manager
    if (state.vrm.expressionManager) {
      state.vrm.expressionManager.update()
    }
  }

  // Update blinking (with VRM integration)
  updateBlinking(state, _delta)

  // Update gaze (with VRM integration)
  updateGaze(state, _delta)

  // If actively performing, don't apply ticks
  if (state.isPerforming && state.relaxationTime > currentTime) {
    // During performance, maintain current expressions
    return
  } else {
    // Apply subtle facial ticks during idle (with VRM integration)
    updateFacialTicks(state, _delta)
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
    vrm.lookAt.target?.position.copy(new Vector3(0, 0, 1)) // Look forward by default
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
