/**
 * avatarDynamics.ts
 *
 * Procedural avatar dynamics and micro-expressions engine.
 *
 * Drives autonomous vitality:
 *   - Procedural natural blinking (random 2.5–6s intervals, smooth ~150ms closure curve)
 *   - Saccades & micro-gaze darting
 *   - Acoustic eyebrow raising during vocal bursts
 *   - Subtle breathing and posture oscillation
 */

import type { AudioLipSyncState } from '../visemes/audioLipSync'

export interface DynamicsUpdateParams {
  elapsedTime: number
  delta: number
  pointerX?: number
  pointerY?: number
  audioState?: AudioLipSyncState | null
  conversationState?: 'loading' | 'idle' | 'listening' | 'thinking' | 'speaking'
}

export interface DynamicsOutput {
  blendshapes: {
    eyeBlinkLeft: number
    eyeBlinkRight: number
    eyeLookDownLeft?: number
    eyeLookDownRight?: number
    eyeLookInLeft?: number
    eyeLookInRight?: number
    eyeLookOutLeft?: number
    eyeLookOutRight?: number
    eyeLookUpLeft?: number
    eyeLookUpRight?: number
    browInnerUp: number
    browOuterUpLeft: number
    browOuterUpRight: number
  }
  boneRotations?: {
    Head?: { x: number; y: number; z: number }
    Neck?: { x: number; y: number; z: number }
    Spine2?: { x: number; y: number; z: number }
  }
  sceneOffset: {
    positionY: number
    rotationY: number
    rotationZ: number
    rotationX: number
  }
}

export class AvatarDynamicsEngine {
  // Blinking state
  private nextBlinkTime: number = 2.5
  private isBlinking: boolean = false
  private blinkStartTime: number = 0
  private blinkDuration: number = 0.16

  // Eyebrow acoustic smoothing
  private browLift: number = 0

  // Gaze saccade state
  private nextSaccadeTime: number = 1.0
  private saccadeOffsetX: number = 0
  private saccadeOffsetY: number = 0
  private currentSaccadeX: number = 0
  private currentSaccadeY: number = 0

  // Head posture smoothing
  private headTargetX: number = 0
  private headTargetY: number = 0
  private headCurrentX: number = 0
  private headCurrentY: number = 0

  update(params: DynamicsUpdateParams): DynamicsOutput {
    const { elapsedTime, delta, pointerX = 0, pointerY = 0, audioState, conversationState = 'idle' } = params

    // 1. Procedural Blinking
    let blinkWeight = 0
    if (elapsedTime >= this.nextBlinkTime && !this.isBlinking) {
      this.isBlinking = true
      this.blinkStartTime = elapsedTime
      this.blinkDuration = 0.14 + Math.random() * 0.05
    }

    if (this.isBlinking) {
      const progress = (elapsedTime - this.blinkStartTime) / this.blinkDuration
      if (progress >= 1.0) {
        this.isBlinking = false
        // Schedule next blink in 2.5 – 6.0 seconds
        this.nextBlinkTime = elapsedTime + 2.5 + Math.random() * 3.5
        blinkWeight = 0
      } else {
        // Smooth sine bell curve for natural lid motion (fast close, slightly slower open)
        blinkWeight = Math.sin(progress * Math.PI)
        if (progress > 0.5) {
          blinkWeight = Math.pow(blinkWeight, 0.85) // lingering ease out
        }
      }
    }

    // 2. Micro-Saccades (subtle eye darting)
    if (elapsedTime >= this.nextSaccadeTime) {
      this.nextSaccadeTime = elapsedTime + 0.8 + Math.random() * 2.2
      // Small randomized angular offsets
      this.saccadeOffsetX = (Math.random() - 0.5) * 0.08
      this.saccadeOffsetY = (Math.random() - 0.5) * 0.05
    }

    const saccadeLerp = Math.min(1.0, delta * 12.0)
    this.currentSaccadeX += (this.saccadeOffsetX - this.currentSaccadeX) * saccadeLerp
    this.currentSaccadeY += (this.saccadeOffsetY - this.currentSaccadeY) * saccadeLerp

    // 3. Acoustic Eyebrow Elevation
    const vocalEnergy = audioState?.energy ?? 0
    const highFreqEnergy = audioState?.highBand ?? 0
    const targetBrowLift = vocalEnergy > 0.3 ? Math.min(0.4, (vocalEnergy - 0.3) * 0.8 + highFreqEnergy * 0.2) : 0
    this.browLift += (targetBrowLift - this.browLift) * Math.min(1.0, delta * 8.0)

    // 4. Head Posture & Breathing
    const breathingCycle = Math.sin(elapsedTime * 1.5) * 0.003
    const swayCycle = Math.sin(elapsedTime * 0.75) * 0.015

    // Pointer look-at influences
    this.headTargetX = -pointerY * 0.12 + (conversationState === 'thinking' ? 0.05 : 0)
    this.headTargetY = pointerX * 0.18 + this.currentSaccadeX + swayCycle

    const headLerp = Math.min(1.0, delta * 4.5)
    this.headCurrentX += (this.headTargetX - this.headCurrentX) * headLerp
    this.headCurrentY += (this.headTargetY - this.headCurrentY) * headLerp

    return {
      blendshapes: {
        eyeBlinkLeft: blinkWeight,
        eyeBlinkRight: blinkWeight,
        browInnerUp: this.browLift * 0.8,
        browOuterUpLeft: this.browLift * 0.5,
        browOuterUpRight: this.browLift * 0.5
      },
      boneRotations: {
        Head: {
          x: this.headCurrentX * 0.65,
          y: this.headCurrentY * 0.65,
          z: -this.headCurrentY * 0.1
        },
        Neck: {
          x: this.headCurrentX * 0.35,
          y: this.headCurrentY * 0.35,
          z: 0
        },
        Spine2: {
          x: breathingCycle * 1.5,
          y: 0,
          z: 0
        }
      },
      sceneOffset: {
        positionY: breathingCycle,
        rotationY: this.headCurrentY * 0.1,
        rotationZ: 0,
        rotationX: this.headCurrentX * 0.1
      }
    }
  }
}
