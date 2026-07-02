import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from '@ci-avatar/core'

import { App } from './App'

// Canonical CI design tokens first, then app-specific overrides.
import '@ci-avatar/core/styles/globals.css'
import './styles/index.css'
import './styles/scrollbar.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>
)
