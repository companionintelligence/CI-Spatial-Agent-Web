import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ToggleButton } from './ToggleButton'

const meta = {
  title: 'Common/ToggleButton',
  component: ToggleButton,
  args: {
    onToggle: fn(),
    label: 'Controls'
  },
  argTypes: {
    position: { control: 'inline-radio', options: ['left', 'right', 'bottom-left'] }
  }
} satisfies Meta<typeof ToggleButton>

export default meta
type Story = StoryObj<typeof meta>

export const CollapsedLeft: Story = {
  args: { isVisible: false, position: 'left' }
}

export const ExpandedRight: Story = {
  args: { isVisible: true, position: 'right' }
}

export const BottomLeft: Story = {
  args: { isVisible: false, position: 'bottom-left' }
}

export const TogglesOnClick: Story = {
  args: { isVisible: false, position: 'left' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    await expect(args.onToggle).toHaveBeenCalled()
  }
}
