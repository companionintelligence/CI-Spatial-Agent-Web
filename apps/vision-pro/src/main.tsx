import React from 'react'
import ReactDOM from 'react-dom/client'

import { ThemeProvider } from '@ci-avatar/core'

// Canonical CI design tokens first, then app-specific Tailwind layer.
import '@ci-avatar/core/styles/globals.css'
import './index.css'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
