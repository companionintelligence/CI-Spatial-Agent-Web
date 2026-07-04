import type { Meta, StoryObj } from '@storybook/react-vite'

import { Tooltip } from './Tooltip'

const meta = {
  title: 'Common/Tooltip',
  component: Tooltip,
  args: {
    content: 'Connection settings',
    delay: 0,
    children: <button style={{ padding: '0.5rem 1rem' }}>Hover me</button>
  }
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Top: Story = { args: { position: 'top' } }
export const Right: Story = { args: { position: 'right' } }
