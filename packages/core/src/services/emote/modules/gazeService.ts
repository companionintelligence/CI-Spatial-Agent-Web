import type { Camera } from '@react-three/fiber'
import { Euler, Quaternion, Vector3, MathUtils } from 'three'

import type { EmoteState, PlayerVisionType } from '../emoteTypes'
import { safeExecute } from '../utils/errorHandling'
import type { EmoteConfig } from '../configs/emoteConfig'
import { applyEmotion, startPerformance } from '../emoteService'

export const updateGaze = (state: EmoteState, delta: number , config : EmoteConfig): void => {
  const result = safeExecute(() => updateGazeInternal(state, delta , config), 'Gaze update failed')

  if (!result.success) {
    // Fallback to neutral gaze
    resetGazeToNeutral(state)
  }
}

const updateGazeInternal = (state: EmoteState, delta: number , config : EmoteConfig): void => {
  const currentTime = performance.now()
  const camera = state.camera

  if (!camera || (state.vrm && !state.vrm.lookAt)) return

  const { gazeState } = state

  // 1. Check visibility
  const visibilityState = getPlayerVisionState(state, camera , config)
  const isVisible = visibilityState !== null

  if (isVisible && !gazeState.isPlayerVisible) {
    initiateGaze(state, { duration: Infinity })
  }
  gazeState.isPlayerVisible = isVisible

  // 2. Determine focus state
  const isActiveFocus = gazeState.gazeTime.start < currentTime && gazeState.gazeTime.end > currentTime

  // 3. Pick gaze target
  const target = calculateGazeTarget(state, camera, visibilityState, currentTime, isActiveFocus)

  // 4. Smooth target
  gazeState.target = target
  gazeState.target = smoothVector(gazeState.target as Vector3, target, delta, config.gaze.interpolationFactor)

  // 5. Apply gaze based on visibility state
  applyGazeBehavior(state, visibilityState, delta , config)
}

const calculateGazeTarget = (
  state: EmoteState,
  camera: Camera,
  visibilityState: PlayerVisionType,
  currentTime: number,
  isActiveFocus: boolean
): Vector3 => {
  if (!visibilityState) {
    return new Vector3(0, 1.5, -1) // Default forward look
  }

  if (isActiveFocus) {
    return camera.position.clone()
  } else if (state.relaxationTime > currentTime) {
    return camera.position.clone().multiplyScalar(0.5)
  } else {
    return new Vector3(0, 1.5, -1)
  }
}

const applyGazeBehavior = (state: EmoteState, visibilityState: PlayerVisionType, delta: number , config: EmoteConfig): void => {
  const target = state.gazeState.target as Vector3
  if (visibilityState) {
    switch (visibilityState) {
      case 'focused':
        // In central/paracentral vision: Eyes follow directly, neck stays neutral
        updateEyeGaze(state, target)
        returnNeckToNeutral(state, delta , config)
        break
      case 'peripheral':
      default:
        // In peripheral vision: Lead with neck, then eyes follow
        updateNeckGaze(state, target, delta , config)
        break
    }
  } else {
    // Not visible: Return neck and eyes to neutral position
    returnNeckToNeutral(state, delta, config)
    updateEyeGaze(state, new Vector3(0, 1.5, -1))
  }
}

const resetGazeToNeutral = (state: EmoteState): void => {
  // Fallback neutral gaze
  if (state.vrm?.lookAt) {
    state.vrm.lookAt.lookAt(new Vector3(0, 1.5, -1))
  }
}

export const initiateGaze = (state: EmoteState , options: { delay?: number, duration?: number, randomness?: number }): void => {
  if (!state.bones?.neck) return

  const { delay = -1, duration = -1, randomness = 0 } = options
  // Don't always gaze
  if (randomness > 0 && Math.random() > randomness) return

  const currentTime = performance.now()
  const actualDelay = delay < 0 ? Math.random() * 1000 : delay
  const actualDuration = duration < 0 ? Math.random() * 1000 + 4000 : duration

  state.gazeState.gazeTime.start = currentTime + actualDelay
  state.gazeState.gazeTime.end = currentTime + actualDelay + actualDuration
  state.gazeState.isGazing = true

  // Store current head quaternion (simplified for now)
  if (state.vrm && state.vrm.scene) {
    const neckBone = state.vrm.humanoid?.getNormalizedBoneNode('neck')
    if (neckBone) {
      state.gazeState.neckOptions.quaternions.default = [
        neckBone.quaternion.x,
        neckBone.quaternion.y,
        neckBone.quaternion.z,
        neckBone.quaternion.w
      ]
    }
  }
}

function smoothVector(current: Vector3, target: Vector3, delta: number, factor: number): Vector3 {
  return current.lerp(target, 1 - Math.exp(-delta * factor))
}

// Apply eye-only gaze
function updateEyeGaze(state: EmoteState, target: Vector3) {
  if (!state.vrm?.lookAt) return
  // Blend between forward and target for subtlety
  state.vrm.lookAt.lookAt(target)
}

// Apply neck rotation toward target (yaw and pitch: y and x axes; eyes follow)
function updateNeckGaze(state: EmoteState, target: Vector3, delta: number , config: EmoteConfig) {
  const { gazeState } = state
  if (!state.bones?.neck) return

  if (!state.gazeState.neckOptions.quaternions.default) {
    state.gazeState.neckOptions.quaternions.default = state.bones.neck.quaternion.toArray() as [
      number,
      number,
      number,
      number
    ]
  }

  const baseBone = state.bones.spine2 || state.bones.spine || null
  if (!baseBone) return

  const neckWorld = state.bones.neck.getWorldPosition(new Vector3())

  // Compute direction to target in world space
  const toTarget = new Vector3().subVectors(target, neckWorld).normalize()
  const neckWorldQuat = state.bones.neck.getWorldQuaternion(new Quaternion())
  // Get neck's forward direction in world space
  const neckForward = new Vector3(0, 0, -1).applyQuaternion(neckWorldQuat).normalize()

  // Calculate yaw (rotation around y axis)
  const toTargetXZ = new Vector3(toTarget.x, 0, toTarget.z).normalize()
  const neckForwardXZ = new Vector3(neckForward.x, 0, neckForward.z).normalize()
  let yawAngle = neckForwardXZ.angleTo(toTargetXZ)
  const crossYaw = new Vector3().crossVectors(neckForwardXZ, toTargetXZ)
  const signYaw = Math.sign(crossYaw.y) // y axis is up
  yawAngle *= signYaw

  const maxYaw = config.gaze.neck.yaw * MathUtils.DEG2RAD
  yawAngle = Math.max(-maxYaw, Math.min(maxYaw, yawAngle))

  // Calculate pitch (rotation around x axis)
  // Project toTarget and neckForward onto YZ plane (ignore X for pitch)
  const toTargetYZ = new Vector3(0, toTarget.y, toTarget.z).normalize()
  const neckForwardYZ = new Vector3(0, neckForward.y, neckForward.z).normalize()
  let pitchAngle = neckForwardYZ.angleTo(toTargetYZ)
  const crossPitch = new Vector3().crossVectors(toTargetYZ ,neckForwardYZ)
  const signPitch = Math.sign(crossPitch.x) // x axis is right
  pitchAngle *= signPitch

  // Clamp pitch angle (±60°)
  const maxPitch = config.gaze.neck.pitch * MathUtils.DEG2RAD

  // Decay pitch for higher yaw: when looking to the side, reduce pitch range
  const yawAbs = Math.abs(yawAngle)
  const pitchDecay = Math.pow(1 - yawAbs / maxYaw, 2.5) // Sharper dropoff from center to side
  const decayedMaxPitch = maxPitch * Math.max(0, pitchDecay)

  // Clamp pitch to decayed range
  pitchAngle = Math.max(-decayedMaxPitch, Math.min(decayedMaxPitch, pitchAngle))

  // Build target quaternion: yaw (y) and pitch (x)
  const defaultQuat = new Quaternion().fromArray(gazeState.neckOptions.quaternions.default!)
  const euler = new Euler(pitchAngle, yawAngle, 0, 'YXZ')
  const constrainedQuat = defaultQuat.clone().multiply(new Quaternion().setFromEuler(euler))

  // Smoothly interpolate neck toward constrained orientation
  state.bones.neck.quaternion.slerp(constrainedQuat, 1 - Math.exp(-delta * config.gaze.interpolationFactor))

  // Eyes follow neck movement with slight delay for natural look
  updateEyeGaze(state, target)
}

function returnNeckToNeutral(state: EmoteState, delta: number , config: EmoteConfig) {
  if (state.gazeState.neckOptions.quaternions.default && state.bones?.neck) {
    const defaultQuat = new Quaternion().fromArray(state.gazeState.neckOptions.quaternions.default)
    state.bones.neck.quaternion.slerp(defaultQuat, 1 - Math.exp(-delta * config.gaze.interpolationFactor))
  }
}

function getPlayerVisionState(state: EmoteState, camera: Camera , config: EmoteConfig): PlayerVisionType {
  if (!state.node || !camera) return null

  // Parameter defaults
  const {
    maxDistance,
    eye: {
      focused: { horizontal: focusedHorizontalAngle, vertical: focusedVerticalAngle },
      peripheral: { horizontal: peripheralHorizontalAngle, vertical: peripheralVerticalAngle }
    }
  } = config.gaze

  let leftEyeObj: any = null
  let rightEyeObj: any = null

  if (state.vrm && state.bones?.leftEye && state.bones?.rightEye) {
    // VRM: use bones
    leftEyeObj = state.bones.leftEye
    rightEyeObj = state.bones.rightEye
  } else if (state.bones?.Head) {
    // Not VRM: use head bone if available
    leftEyeObj = state.bones.Head
    rightEyeObj = state.bones.Head
  } else {
    // Not VRM: try to find skinned mesh eyes and hips
    // Traverse the node's children to find meshes with "eye" in the name
    state.node.traverse((child: any) => {
      const name = child.name?.toLowerCase?.() ?? ''
      if (!leftEyeObj && child.isMesh && name.includes('left') && name.includes('eye')) {
        leftEyeObj = child
      }
      if (!rightEyeObj && child.isMesh && name.includes('right') && name.includes('eye')) {
        rightEyeObj = child
      }
    })
  }

  if (!leftEyeObj || !rightEyeObj) return null

  // Get world positions
  const leftEyeWorldPos = leftEyeObj.getWorldPosition(new Vector3())
  const rightEyeWorldPos = rightEyeObj.getWorldPosition(new Vector3())
  const hipsWorldPos = state.node.position
  const cameraPos = camera.position

  // Calculate the midpoint between the eyes (approximate head center)
  const eyeMidpoint = new Vector3().addVectors(leftEyeWorldPos, rightEyeWorldPos).multiplyScalar(0.5)
  // Vector from eye midpoint to camera
  const toCameraVec = new Vector3().subVectors(cameraPos, eyeMidpoint)
  const cameraDistance = toCameraVec.length()

  // Always visible if camera is above the avatar (y axis)
  // Invisible if camera is below the avatar (y axis)
  if (cameraPos.y < hipsWorldPos.y) {
    return null
  }

  // Invisible if outside of specified range
  if (cameraDistance > maxDistance) {
    return null
  }

  // Helper to check if a single eye can see the target within given angles
  function eyeCanSee(eye: any, hAngle: number, vAngle: number): boolean {
    // Account for the overall orientation of the avatar (root node)
    const eyePos = eye.getWorldPosition(new Vector3())

    // Get the avatar's world orientation (quaternion)
    let avatarQuat = new Quaternion()
    if (state.node && state.node.getWorldQuaternion) {
      state.node.getWorldQuaternion(avatarQuat)
    }

    // Eye forward in local space, then apply both eye and avatar orientation
    const eyeLocalForward = new Vector3(0, 0, -1)
    const eyeLocalUp = new Vector3(0, 1, 0)

    // Compose the eye's world orientation by combining avatar and eye quaternions
    let eyeWorldQuat = eye.quaternion.clone()
    if (avatarQuat) {
      eyeWorldQuat.premultiply(avatarQuat)
    }

    const eyeForward = eyeLocalForward.clone().applyQuaternion(eyeWorldQuat).normalize()
    const eyeUp = eyeLocalUp.clone().applyQuaternion(eyeWorldQuat).normalize()

    const toTarget = cameraPos.clone().sub(eyePos).normalize()
    const eyeRight = new Vector3().crossVectors(eyeForward, eyeUp).normalize()

    const horizontalAngle = Math.atan2(toTarget.dot(eyeRight), toTarget.dot(eyeForward))
    const verticalAngle = Math.atan2(toTarget.dot(eyeUp), toTarget.dot(eyeForward))
    // Convert degree angles to radians for comparison
    const hAngleRad = hAngle * MathUtils.DEG2RAD
    const vAngleRad = vAngle * MathUtils.DEG2RAD

    return Math.abs(horizontalAngle) < hAngleRad && Math.abs(verticalAngle) < vAngleRad
  }

  // Focused (central vision)
  if (
    eyeCanSee(leftEyeObj, focusedHorizontalAngle, focusedVerticalAngle) ||
    eyeCanSee(rightEyeObj, focusedHorizontalAngle, focusedVerticalAngle)
  ) {
    return 'focused'
  }

  // Peripheral vision
  if (
    eyeCanSee(leftEyeObj, peripheralHorizontalAngle, peripheralVerticalAngle) ||
    eyeCanSee(rightEyeObj, peripheralHorizontalAngle, peripheralVerticalAngle)
  ) {
    return 'peripheral'
  }

  // Not visible
  return null
}
