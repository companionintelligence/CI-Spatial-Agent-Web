import type { Meta, StoryObj } from '@storybook/react-vite'

import { BlendTimeline } from './BlendTimeline'

const meta = {
  title: 'Debug/BlendTimeline',
  component: BlendTimeline,
  parameters: { layout: 'centered' },
  argTypes: {
    blendTime: { control: { type: 'range', min: 0.05, max: 1, step: 0.05 } },
    gestureDuration: { control: { type: 'range', min: 0.4, max: 3, step: 0.1 } }
  }
} satisfies Meta<typeof BlendTimeline>

export default meta
type Story = StoryObj<typeof meta>

/** The default 0.35s crossfade. */
export const Default: Story = {}

/** A snappy near-instant handoff. */
export const FastBlend: Story = {
  args: { blendTime: 0.1 }
}

/** A long, heavily overlapping crossfade. */
export const SlowBlend: Story = {
  args: { blendTime: 0.8, gestureDuration: 1.6 }
}
