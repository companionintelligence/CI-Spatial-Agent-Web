import React from 'react'
import ReactDOM from 'react-dom/client'

import { ThemeProvider, detectSurfaceSync } from '@ci-avatar/core'

// Canonical CI design tokens first, then app-specific Tailwind layer.
import '@ci-avatar/core/styles/globals.css'
import './index.css'
import { App } from './App'

// WebSpatial scene bootstrap — only on the actual Vision Pro / WebSpatial container
// (UA carries `visionOS|WebSpatial`). Dynamic-imported + guarded so the plain-browser
// preview build never loads or runs the spatial-OS init, which would throw off-device.
if (detectSurfaceSync() === 'vision-pro') {
  import('@webspatial/react-sdk')
    .then((sdk) => sdk.initScene?.())
    .catch((err) => console.warn('[webspatial] initScene skipped:', err))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
