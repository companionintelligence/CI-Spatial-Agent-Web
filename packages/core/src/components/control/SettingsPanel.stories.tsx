import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { SettingsPanel } from './SettingsPanel'

const meta = {
  title: 'Control/SettingsPanel',
  component: SettingsPanel,
  parameters: { layout: 'fullscreen' },
  args: { isOpen: true, onClose: fn() }
} satisfies Meta<typeof SettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {}
