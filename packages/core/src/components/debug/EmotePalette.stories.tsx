import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { EmotePalette } from './EmotePalette'

const meta = {
  title: 'Debug/EmotePalette',
  component: EmotePalette,
  parameters: { layout: 'centered' },
  args: { onSelect: fn() }
} satisfies Meta<typeof EmotePalette>

export default meta
type Story = StoryObj<typeof meta>

/** The full nine-emotion palette with nothing selected. */
export const Default: Story = {}

/** "happy" highlighted as the active mood. */
export const HappySelected: Story = {
  args: { selected: 'happy' }
}

/** Read-only review mode — no picker, swatches disabled. */
export const ReadOnly: Story = {
  args: { onSelect: undefined, selected: 'love' }
}

/** Clicking a swatch reports the picked emotion. */
export const SelectsOnClick: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'angry' }))
    await expect(args.onSelect).toHaveBeenCalledWith('angry')
  }
}
