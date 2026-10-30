import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LLMSettingsState,
  STTSettingsState,
  TTSSettingsState,
  ThemeProvider,
  loadRuntimeConfig,
  resolveLLMConfig,
  resolveSTTConfig,
  resolveTTSConfig
} from '@ci-avatar/core'

// Self-hosted Manrope (offline/CSP-safe for the appliance container). Montserrat
// was the pre-v0.3.0 canon font; Manrope's canon weights are 400/500/600/700 (no 200).
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
// Canonical CI design tokens first, then app-specific overrides.
import '@ci-avatar/core/styles/globals.css'
import './styles/index.css'
import './styles/scrollbar.css'

import { App } from './App'
import { registerServiceWorker } from './lib/registerServiceWorker'
import { initTelemetry } from './lib/telemetry'

// No-op unless VITE_SENTRY_DSN was baked in at build time AND the BFF confirms
// reporting is permitted. Deliberately not awaited: reporting must never delay
// first render — and with no DSN this call, and the whole Sentry SDK, are gone
// from the bundle at build time.
void initTelemetry()

// Installable as an app, with an offline page. Production builds only; see
// src/lib/registerServiceWorker.ts and public/sw.js. It catches its own errors, so the
// registration can no longer be what stops the app from starting.
registerServiceWorker()

/**
 * Resolve runtime config (from a container-generated /config.json) before the
 * first render so the agent sees the correct LLM URL/model immediately. The
 * loader never rejects, so a missing config.json just falls back to defaults.
 */
async function bootstrap() {
  const runtime = await loadRuntimeConfig()
  LLMSettingsState.set(resolveLLMConfig(runtime))
  TTSSettingsState.set(resolveTTSConfig(runtime))
  STTSettingsState.set(resolveSTTConfig(runtime))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </StrictMode>
  )
}

void bootstrap()
