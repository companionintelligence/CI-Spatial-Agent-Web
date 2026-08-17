import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useLLMService } from './llmService'

const request = {
  text: 'hello companion',
  human: true,
  final: true,
  bargein: false,
  interrupt: 1
}

describe('useLLMService activation gate', () => {
  it('does not produce a fallback answer before connection is verified', async () => {
    const onStatus = vi.fn()
    const onResponse = vi.fn()
    const { result } = renderHook(() =>
      useLLMService({
        config: { llm_provider: 'proxy', activation_state: 'unverified' },
        onStatus,
        onResponse
      })
    )

    await act(async () => {
      await result.current.actions.processUserInput(request)
    })

    expect(onStatus).toHaveBeenCalledWith({ color: 'error', text: 'Connection not verified' })
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        activationState: 'unverified',
        breath: expect.stringContaining('not connected')
      })
    )
  })

  it('does not turn a verified but starting model into a scripted answer', async () => {
    const onStatus = vi.fn()
    const onResponse = vi.fn()
    const { result } = renderHook(() =>
      useLLMService({
        config: { llm_provider: 'proxy', activation_state: 'chat-only' },
        onStatus,
        onResponse
      })
    )

    await act(async () => {
      await result.current.actions.processUserInput(request)
    })

    expect(onStatus).toHaveBeenCalledWith({ color: 'error', text: 'Verified connection is not ready' })
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        activationState: 'chat-only',
        breath: expect.stringContaining('will not use a scripted answer')
      })
    )
  })
})
