import { describe, expect, it, vi } from 'vitest'

import { AvatarDynamicsEngine } from './avatarDynamics'

describe('AvatarDynamicsEngine render-layer behavior', () => {
  it('maps pointer tracking into gaze blendshapes and bounded neck motion', () => {
    const engine = new AvatarDynamicsEngine()
    const output = engine.update({
      elapsedTime: 0,
      delta: 1 / 60,
      pointerX: 1,
      pointerY: 1
    })

    expect(output.blendshapes.eyeLookInRight).toBeGreaterThan(0)
    expect(output.blendshapes.eyeLookOutLeft).toBeGreaterThan(0)
    expect(output.blendshapes.eyeLookUpLeft).toBeGreaterThan(0)
    expect(output.blendshapes.eyeLookUpRight).toBeGreaterThan(0)
    expect(Math.abs(output.boneRotations.Head.y)).toBeLessThanOrEqual(0.45)
    expect(Math.abs(output.boneRotations.Head.x)).toBeLessThanOrEqual(0.25)
  })

  it('couples vocal energy to brows, cheeks, and full-body rest posture', () => {
    const engine = new AvatarDynamicsEngine()
    const output = engine.update({
      elapsedTime: 1,
      delta: 1 / 60,
      audioState: {
        energy: 0.9,
        lowBand: 0.7,
        midBand: 0.8,
        highBand: 0.6,
        isSpeaking: true
      },
      conversationState: 'speaking'
    })

    expect(output.blendshapes.browInnerUp).toBeGreaterThan(0)
    expect(output.blendshapes.cheekSquintLeft).toBeGreaterThan(0)
    expect(output.boneRotations.LeftArm).toBeDefined()
    expect(output.boneRotations.LeftForeArm.x).toBeGreaterThan(0)
    expect(output.boneRotations.Spine2).toBeDefined()
  })

  it('adds attentive listening and thinking behavior without leaving stale face state', () => {
    const engine = new AvatarDynamicsEngine()
    const listening = engine.update({
      elapsedTime: 1,
      delta: 1 / 60,
      conversationState: 'listening'
    })
    const thinking = engine.update({
      elapsedTime: 1.1,
      delta: 1 / 60,
      conversationState: 'thinking'
    })

    expect(listening.blendshapes.browInnerUp).toBeGreaterThan(0)
    expect(thinking.blendshapes.eyeLookInRight).toBeGreaterThan(0)
    expect(thinking.boneRotations.Head.y).toBeGreaterThan(0)

    engine.reset()
    const idle = engine.update({ elapsedTime: 1.2, delta: 1 / 60 })
    expect(idle.blendshapes.browInnerUp).toBe(0)
    expect(idle.boneRotations.Head.y).toBeCloseTo(0, 4)
  })

  it('forces a semantic blink after speech ends', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const engine = new AvatarDynamicsEngine()
    engine.update({ elapsedTime: 1, delta: 1 / 60, conversationState: 'speaking' })
    engine.update({ elapsedTime: 2.08, delta: 1 / 60, conversationState: 'idle' })
    const afterSpeech = engine.update({ elapsedTime: 2.12, delta: 1 / 60, conversationState: 'idle' })

    expect(afterSpeech.blendshapes.eyeBlinkLeft).toBeGreaterThan(0)
    expect(afterSpeech.blendshapes.eyeBlinkRight).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })
})
