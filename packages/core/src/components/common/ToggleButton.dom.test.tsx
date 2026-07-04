import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ToggleButton } from './ToggleButton'

describe('ToggleButton', () => {
  it('shows the label with a collapsed-state chevron when not visible', () => {
    render(<ToggleButton isVisible={false} onToggle={() => {}} label="Controls" position="left" />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Controls')
    expect(btn).toHaveTextContent('▶') // left + hidden → points inward
  })

  it('hides the label and flips the chevron when visible', () => {
    render(<ToggleButton isVisible onToggle={() => {}} label="Controls" position="left" />)
    const btn = screen.getByRole('button')
    expect(btn).not.toHaveTextContent('Controls')
    expect(btn).toHaveTextContent('◀')
  })

  it('invokes onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<ToggleButton isVisible={false} onToggle={onToggle} label="Chat" position="right" />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
