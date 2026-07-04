import type { Meta, StoryObj } from '@storybook/react-vite'

import { VisemeMeter } from './VisemeMeter'

const meta = {
  title: 'Debug/VisemeMeter',
  component: VisemeMeter,
  parameters: { layout: 'centered' }
} satisfies Meta<typeof VisemeMeter>

export default meta
type Story = StoryObj<typeof meta>

/** All 14 GLB `viseme_*` targets, mid-utterance on an open "aa" vowel. */
export const GlbVisemes: Story = {
  args: {
    title: 'GLB visemes',
    values: {
      viseme_PP: 0.05,
      viseme_FF: 0.0,
      viseme_TH: 0.1,
      viseme_DD: 0.15,
      viseme_kk: 0.0,
      viseme_CH: 0.2,
      viseme_SS: 0.35,
      viseme_nn: 0.1,
      viseme_RR: 0.05,
      viseme_aa: 0.85,
      viseme_E: 0.4,
      viseme_I: 0.2,
      viseme_O: 0.1,
      viseme_U: 0.0
    }
  }
}

/** The coarse 5-value VRM mouth set. */
export const VrmVisemes: Story = {
  args: {
    title: 'VRM visemes',
    stripPrefix: '',
    values: { aa: 0.7, ee: 0.25, ih: 0.1, oh: 0.4, ou: 0.05 }
  }
}

/** Resting face — every viseme at zero. */
export const Silent: Story = {
  args: {
    title: 'VRM visemes',
    stripPrefix: '',
    values: { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 }
  }
}
