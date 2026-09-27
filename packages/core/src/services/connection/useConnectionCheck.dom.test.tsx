import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { useConnectionCheck } from './useConnectionCheck'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useConnectionCheck', () => {
  it('short-circuits the script (demo) provider without hitting fetch', async () => {
    const fetchMock = vi.fn()
    const onActivationStateChange = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConnectionCheck('script', onActivationStateChange))

    expect(result.current.healthState).toBe('idle')

    await act(async () => {
      await result.current.checkConnection()
    })

    expect(result.current.healthState).toBe('demo')
    expect(onActivationStateChange).toHaveBeenCalledWith('demo-only')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves a reachable non-memory provider to healthy / chat-only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          reachable: true,
          memory: { configured: false, reachable: false },
          tts: { reachable: true }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const onActivationStateChange = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConnectionCheck('proxy', onActivationStateChange))

    await act(async () => {
      await result.current.checkConnection()
    })

    await waitFor(() => expect(result.current.healthState).toBe('healthy'))
    expect(onActivationStateChange).toHaveBeenCalledWith('chat-only')
    expect(result.current.health?.reachable).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ cache: 'no-store', headers: { accept: 'application/json' } })
    )
  })

  it('resolves an unreachable tts to degraded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'degraded',
          reachable: true,
          memory: { configured: false, reachable: false },
          tts: { reachable: false }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const onActivationStateChange = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConnectionCheck('proxy', onActivationStateChange))

    await act(async () => {
      await result.current.checkConnection()
    })

    await waitFor(() => expect(result.current.healthState).toBe('degraded'))
    expect(onActivationStateChange).toHaveBeenCalledWith('chat-only')
  })

  it('resolves a fetch rejection to error, with healthError set and activation unverified', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    const onActivationStateChange = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConnectionCheck('proxy', onActivationStateChange))

    await act(async () => {
      await result.current.checkConnection()
    })

    await waitFor(() => expect(result.current.healthState).toBe('error'))
    expect(result.current.healthError).toBe('network down')
    expect(result.current.health).toBeNull()
    expect(onActivationStateChange).toHaveBeenCalledWith('unverified')
  })
})
