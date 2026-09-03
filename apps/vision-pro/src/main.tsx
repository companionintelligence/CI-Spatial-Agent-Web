import React from 'react'
import ReactDOM from 'react-dom/client'

import {
  LLMSettingsState,
  STTSettingsState,
  TTSSettingsState,
  ThemeProvider,
  detectSurfaceSync,
  loadRuntimeConfig,
  resolveLLMConfig,
  resolveSTTConfig,
  resolveTTSConfig
} from '@ci-avatar/core'

// Canonical CI design tokens first, then app-specific Tailwind layer.
import '@ci-avatar/core/styles/globals.css'
import './index.css'
import { App } from './App'

// WebSpatial scene bootstrap — only on the actual Vision Pro / WebSpatial container
// (UA carries `visionOS|WebSpatial`). Dynamic-imported + guarded so the plain-browser
// preview build never loads or runs the spatial-OS init, which would throw off-device.
/**
 * WebSpatial scene bootstrap.
 *
 * This was `initScene()` with no arguments. The SDK signature is
 * `initScene(name, callback, options?)`, so the call was wrong and the scene was
 * never configured — the app opened at whatever default size visionOS chose, with
 * no depth budget, which is part of why it read as a flat web page in a window.
 * TypeScript did flag it (TS2554), but `vite build` does not run tsc for this
 * package, so nothing failed and it shipped.
 *
 * `depth` is what earns the volume: without it visionOS gives the scene a plane,
 * and a 3D avatar in a plane is a video. `worldAlignment: 'adaptive'` lets the
 * window follow the user's gaze rather than staying pinned where it opened.
 *
 * Dynamic-imported and guarded so the plain-browser preview build never loads the
 * spatial-OS init, which throws off-device.
 */
if (detectSurfaceSync() === 'vision-pro') {
  import('@webspatial/react-sdk')
    .then((sdk) =>
      sdk.initScene?.('main', (pre) => ({
        ...pre,
        defaultSize: { width: 1280, height: 860, depth: 480 },
        resizability: { minWidth: 720, minHeight: 540 },
        worldAlignment: 'adaptive'
      }))
    )
    .catch((err) => console.warn('[webspatial] initScene skipped:', err))
}

/**
 * Resolve runtime config before first render.
 *
 * This app previously read a module-level literal of build-time defaults, so the
 * Vision Pro build could not be pointed at an Ollama or a HeadTTS sidecar without
 * rebuilding and re-signing the whole visionOS bundle — by far the most expensive
 * rebuild of any surface we ship. `apps/web` has read `/config.json` since the
 * runtime-config work; this brings the same contract here, which matters more on
 * this surface than on any other.
 *
 * The loader never rejects: a missing config.json falls back to build-time
 * defaults, which is the normal case for the App Store build.
 */
async function bootstrap() {
  const runtime = await loadRuntimeConfig()
  LLMSettingsState.set(resolveLLMConfig(runtime))
  TTSSettingsState.set(resolveTTSConfig(runtime))
  STTSettingsState.set(resolveSTTConfig(runtime))

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </React.StrictMode>
  )
}

void bootstrap()
