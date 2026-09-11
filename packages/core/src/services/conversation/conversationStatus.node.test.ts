import { describe, expect, it } from 'vitest'

import { ConversationStatusState, setConversationStatus } from './conversationStatus'

describe('conversation status', () => {
  it('starts idle', () => {
    setConversationStatus('idle')
    expect(ConversationStatusState.get().status).toBe('idle')
  })

  it('carries the states the dynamics engine actually branches on', () => {
    // listening / thinking were unreachable before: the avatar was only ever told
    // 'speaking' or 'idle', so the lean, the attentive brows, the gaze aversion
    // and the elevated blink rate were all dead code.
    for (const status of ['listening', 'thinking', 'speaking', 'loading', 'idle'] as const) {
      setConversationStatus(status)
      expect(ConversationStatusState.get().status).toBe(status)
    }
  })

  it('does not churn the store when the status is unchanged', () => {
    setConversationStatus('idle')
    let notifications = 0
    const unsubscribe = ConversationStatusState.subscribe(() => notifications++)
    setConversationStatus('idle')
    setConversationStatus('idle')
    unsubscribe?.()
    expect(notifications).toBe(0)
  })
})
