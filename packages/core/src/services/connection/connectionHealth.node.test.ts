import { describe, expect, it } from 'vitest'

import { deriveActivationState, activationStateLabel, type ConnectionHealth } from './connectionHealth'

const healthyChat: ConnectionHealth = {
  reachable: true,
  memory: { configured: false, reachable: false },
  tts: { reachable: true }
}

describe('activation state', () => {
  it('keeps scripted responses explicitly demo-only', () => {
    expect(deriveActivationState(healthyChat, 'script')).toBe('demo-only')
  })

  it('does not call an unreachable chat provider connected', () => {
    expect(deriveActivationState({ reachable: false }, 'proxy')).toBe('unverified')
  })

  it('distinguishes chat-only from memory-ready sessions', () => {
    expect(deriveActivationState(healthyChat, 'proxy')).toBe('chat-only')
    expect(
      deriveActivationState(
        {
          ...healthyChat,
          memory: { configured: true, reachable: true }
        },
        'proxy'
      )
    ).toBe('memory-ready')
  })

  it('provides stable labels for the user-facing state', () => {
    expect(activationStateLabel('unverified')).toBe('Unverified')
    expect(activationStateLabel('demo-only')).toBe('Demo-only')
    expect(activationStateLabel('chat-only')).toBe('Chat-only')
    expect(activationStateLabel('memory-ready')).toBe('Memory-ready')
  })
})
