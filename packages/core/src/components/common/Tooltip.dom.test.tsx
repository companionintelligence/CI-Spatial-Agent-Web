import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('renders its trigger children', () => {
    render(
      <Tooltip content="Hello" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    )
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument()
  })

  it('reveals the tooltip content on hover', async () => {
    render(
      <Tooltip content="Connection settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    )
    // Content is always in the DOM but transitions opacity; hovering makes it visible.
    const content = screen.getByText('Connection settings')
    expect(content).toHaveStyle({ opacity: '0' })
    await userEvent.hover(screen.getByRole('button', { name: 'Trigger' }))
    await waitFor(() => expect(content).toHaveStyle({ opacity: '1' }))
  })
})
