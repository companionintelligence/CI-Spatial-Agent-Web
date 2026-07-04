import type { Preview } from '@storybook/react-vite'

import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@ci-avatar/core/styles/globals.css'

/**
 * The overlays are dark-glassmorphism and mostly `position: absolute`, so every
 * story renders inside a relative, dark (canonical `.dark` tokens), sized stage.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'todo'
    }
  },
  decorators: [
    (Story) => (
      <div
        className="dark"
        style={{
          position: 'relative',
          width: 440,
          minHeight: 280,
          padding: 24,
          borderRadius: 12,
          background: 'var(--background, #041620)',
          fontFamily: 'var(--font-sans, Montserrat, system-ui, sans-serif)',
          color: 'var(--foreground, #88a29e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Story />
      </div>
    )
  ]
}

export default preview
