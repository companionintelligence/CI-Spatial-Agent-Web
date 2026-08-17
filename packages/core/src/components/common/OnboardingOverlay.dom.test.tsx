import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OnboardingOverlay } from './OnboardingOverlay'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OnboardingOverlay connection truth', () => {
  it('moves a reachable non-memory provider into chat-only activation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        reachable: true,
        memory: { configured: false, reachable: false },
        tts: { reachable: true }
      })
    })
    const onActivationStateChange = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <OnboardingOverlay
        isOpen
        onEnableMic={vi.fn()}
        onSkip={vi.fn()}
        activationState="unverified"
        llmProvider="proxy"
        onActivationStateChange={onActivationStateChange}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Session: Unverified')
    await userEvent.click(screen.getByRole('button', { name: 'Check connection' }))

    await waitFor(() => expect(onActivationStateChange).toHaveBeenCalledWith('chat-only'))
    expect(screen.getByRole('status')).toHaveTextContent('Chat: reachable')
    expect(screen.getByRole('status')).toHaveTextContent('Memory: not configured')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ cache: 'no-store', headers: { accept: 'application/json' } })
    )
  })
})
