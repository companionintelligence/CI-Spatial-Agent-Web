import type { Meta, StoryObj } from '@storybook/react-vite'

import { LogoOverlay } from './LogoOverlay'

const meta = {
  title: 'Common/LogoOverlay',
  component: LogoOverlay,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LogoOverlay>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The default overlay points at the bundled banner asset, which is served from
 * the app at runtime. In Storybook that path 404s, so the stories pass an inline
 * data-URI logo to exercise the glass frame without a broken image.
 */
const INLINE_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40" viewBox="0 0 180 40">
      <rect width="180" height="40" rx="6" fill="none"/>
      <text x="90" y="26" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="18" font-weight="700" fill="#abd4d8">Companion</text>
    </svg>`
  )

export const Default: Story = {
  args: { logoSrc: INLINE_LOGO }
}
