import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LLMSettingsState, ThemeProvider, loadRuntimeConfig, resolveLLMConfig } from '@ci-avatar/core'

// Self-hosted Montserrat (offline/CSP-safe for the appliance container).
import '@fontsource/montserrat/200.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
// Canonical CI design tokens first, then app-specific overrides.
import '@ci-avatar/core/styles/globals.css'
import './styles/index.css'
import './styles/scrollbar.css'

import { App } from './App'
import { initTelemetry } from './lib/telemetry'

// No-op unless VITE_SENTRY_DSN was baked in at build time AND the BFF confirms
// reporting is permitted. Deliberately not awaited: reporting must never delay
// first render — and with no DSN this call, and the whole Sentry SDK, are gone
// from the bundle at build time.
void initTelemetry()

/**
 * Resolve runtime config (from a container-generated /config.json) before the
 * first render so the agent sees the correct LLM URL/model immediately. The
 * loader never rejects, so a missing config.json just falls back to defaults.
 */
async function bootstrap() {
  const runtime = await loadRuntimeConfig()
  LLMSettingsState.set(resolveLLMConfig(runtime))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </StrictMode>
  )
}

void bootstrap()
