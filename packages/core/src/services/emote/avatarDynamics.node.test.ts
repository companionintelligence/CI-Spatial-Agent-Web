import { describe, expect, it } from 'vitest'
import { AvatarDynamicsEngine } from './avatarDynamics'

describe('AvatarDynamicsEngine', () => {
  it('generates dynamics output including blink and head rotations', () => {
    const engine = new AvatarDynamicsEngine()
    const out = engine.update({
      elapsedTime: 1.0,
      delta: 0.016,
      pointerX: 0.5,
      pointerY: -0.2
    })

    expect(out.blendshapes).toBeDefined()
    expect(out.blendshapes.eyeBlinkLeft).toBeGreaterThanOrEqual(0)
    expect(out.blendshapes.eyeBlinkLeft).toBeLessThanOrEqual(1)
    expect(out.boneRotations?.Head).toBeDefined()
    expect(out.sceneOffset).toBeDefined()
  })

  it('triggers blinking over time', () => {
    const engine = new AvatarDynamicsEngine()
    let sawBlink = false

    // Simulate 8 seconds of frames
    for (let t = 0; t < 8.0; t += 0.05) {
      const out = engine.update({
        elapsedTime: t,
        delta: 0.05
      })
      if (out.blendshapes.eyeBlinkLeft > 0.1) {
        sawBlink = true
        break
      }
    }

    expect(sawBlink).toBe(true)
  })
})
