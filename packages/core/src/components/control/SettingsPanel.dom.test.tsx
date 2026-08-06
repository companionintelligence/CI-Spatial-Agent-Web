import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SettingsPanel } from './SettingsPanel'

/**
 * Regression cover for the settings dialog's scroll structure.
 *
 * The card used to scroll as one block: `maxHeight` + `overflowY: auto` on the
 * card itself. That kept Save *reachable* but not *visible* — on a 360x640
 * phone the card filled the screen, the fold landed mid-sentence in the
 * Graphics section, and the committed product screenshot showed a settings
 * dialog with no commit button in it at all. Header and footer are now pinned
 * and only the field list moves.
 */
describe('SettingsPanel layout', () => {
  it('pins the footer so Save and Cancel are never scrolled out of the card', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />)

    const save = screen.getByRole('button', { name: 'Save' })
    const footer = save.closest('div')?.parentElement as HTMLElement
    expect(footer).toBeTruthy()
    // A pinned footer must not be allowed to shrink, and must not live inside
    // the scroll box.
    expect(footer.style.flexShrink).toBe('0')

    const card = screen.getByRole('dialog').firstElementChild as HTMLElement
    expect(card.style.display).toBe('flex')
    expect(card.style.flexDirection).toBe('column')
    // The card clips; the body scrolls. If the card itself scrolled we would be
    // back to the original defect.
    expect(card.style.overflow).toBe('hidden')
    expect(card.style.overflowY).not.toBe('auto')
  })

  it('gives the field list its own scroll box that can shrink below its content', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />)
    const card = screen.getByRole('dialog').firstElementChild as HTMLElement
    // children: [header, scrolling body, footer]
    expect(card.children).toHaveLength(3)
    const body = card.children[1] as HTMLElement
    expect(body.style.overflowY).toBe('auto')
    // Without `min-height: 0` a flex child refuses to shrink under its content
    // and pushes the footer straight back off the card.
    expect(body.style.minHeight).toBe('0px')
  })

  it('renders nothing when closed', () => {
    render(<SettingsPanel isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
