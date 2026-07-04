import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LLMSettingsState, loadRuntimeConfig, resolveLLMConfig } from '@ci-avatar/core'

import '@fontsource/montserrat/200.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@ci-avatar/core/styles/tokens.css'
import './styles/index.css'
import './styles/scrollbar.css'

import { App } from './App'

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
      <App />
    </StrictMode>
  )
}

void bootstrap()
