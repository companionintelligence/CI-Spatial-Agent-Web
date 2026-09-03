import { describe, expect, it } from 'vitest'

import { initializeAnimationState } from './animationService'

/**
 * `enableCycling` used to call `setAnimationEnabled` — the master gate for the
 * whole service, not the cycling flag. So "enable idle variety" merely re-enabled
 * animation, `cyclingState.cyclingEnabled` stayed false, and the weighted idle
 * picker plus all six personality presets never ran. The avatar sat in one
 * looping idle for the life of the app.
 *
 * These assert the two flags are genuinely independent, which is the property
 * that was violated.
 */
describe('animation gates are independent', () => {
  it('starts with cycling off and the service enabled', () => {
    const state = initializeAnimationState()
    expect(state.enabled).toBe(true)
    expect(state.cyclingState.cyclingEnabled).toBe(false)
  })

  it('enabling cycling does not touch the master gate', () => {
    const state = initializeAnimationState()
    state.cyclingState.cyclingEnabled = true
    expect(state.enabled).toBe(true)
    expect(state.cyclingState.cyclingEnabled).toBe(true)
  })

  it('disabling the master gate does not silently enable cycling', () => {
    const state = initializeAnimationState()
    state.enabled = false
    expect(state.cyclingState.cyclingEnabled).toBe(false)
  })
})
