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

  // Regression: the bar was positioned with `left: 50%` + `translateX(-50%)`.
  // That makes its shrink-to-fit width `containing block - 50%`, i.e. half the
  // screen — 180 px on a 360 px phone — so `flexWrap` folded eight 44 px
  // controls into a 2-across, 4-down tower that climbed over the chat input.
  it('spans the surface rather than starting at the halfway mark', () => {
    const { container } = render(<ControlPanel {...baseProps} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.left).toBe('0px')
    expect(root.style.right).toBe('0px')
    expect(root.style.transform).not.toContain('translateX')
  })

  it('hides the bar from the pointer while it is collapsed', () => {
    const { container } = render(<ControlPanel {...baseProps} isVisible={false} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
  })

  // "XR: unavailable" is permanently true in any desktop browser without a
  // headset, so it sat across the bottom of every captured frame saying nothing
  // actionable. Only an informative status earns the space.
  it('suppresses the XR status line when XR is simply unavailable', () => {
    const { container } = render(<ControlPanel {...baseProps} xrStatusText="XR: unavailable" />)
    expect(container.textContent ?? '').not.toContain('XR: unavailable')
  })

  it('shows the XR status line when a headset is ready', () => {
    render(<ControlPanel {...baseProps} xrStatusText="XR: ready" />)
    expect(screen.getByText('XR: ready')).toBeInTheDocument()
  })
})
