import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Mic } from 'lucide-react'

import { ControlButton } from './ControlButton'

const meta = {
  title: 'Common/ControlButton',
  component: ControlButton,
  args: { onClick: fn(), children: <Mic size={20} aria-hidden />, size: 48 }
} satisfies Meta<typeof ControlButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { tooltipContent: 'Enable voice' } }
export const Active: Story = { args: { isActive: true, tooltipContent: 'Listening' } }
export const Disabled: Story = { args: { disabled: true, tooltipContent: 'Unavailable' } }
