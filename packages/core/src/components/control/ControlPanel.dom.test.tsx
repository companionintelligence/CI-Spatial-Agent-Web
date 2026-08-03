import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ControlPanel } from './ControlPanel'
import { initialAppConfig } from '../../app/appConfig'

const baseProps = {
  config: initialAppConfig,
  isRecording: false,
  handleAppStateChange: () => {},
  isVisible: true
}

describe('ControlPanel', () => {
  it('renders lucide icons (SVGs), never emoji, for its actions', () => {
    const { container } = render(
      <ControlPanel
        {...baseProps}
        onEnterVRMode={() => {}}
        onEnterARMode={() => {}}
        onOpenSettings={() => {}}
        xrCanEnterVR
        xrCanEnterAR
      />
    )
    // Mic + Enter VR + Enter AR + Settings → at least 4 lucide glyphs.
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(4)
    // No emoji leaked into the DOM text.
    // Alternation, not a character class: ⏹️ and ⚙️ are base char + U+FE0F variation
    // selector, and a character class would match those code points individually
    // (and so match a bare U+FE0F anywhere) rather than the emoji sequence.
    expect(container.textContent ?? '').not.toMatch(/🎤|🔴|🟢|🥽|📱|⏹️|🎯|➖|➕|⚙️/u)
  })

  it('gives every icon button an accessible name', () => {
    render(<ControlPanel {...baseProps} onEnterVRMode={() => {}} onOpenSettings={() => {}} xrCanEnterVR />)
    expect(screen.getByRole('button', { name: 'Mic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter VR' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('toggles the microphone when the mic button is clicked', async () => {
    const handleAppStateChange = vi.fn()
    render(<ControlPanel {...baseProps} handleAppStateChange={handleAppStateChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mic' }))
    expect(handleAppStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ microphone: !initialAppConfig.microphone })
    )
  })

  it('reflects the active listening state with a "Listening" label when VAD is detecting', () => {
    render(<ControlPanel {...baseProps} isRecording vadDetecting />)
    // The mic button's accessible name and its under-icon label both flip.
    expect(screen.getByRole('button', { name: 'Listening' })).toBeInTheDocument()
  })
})
