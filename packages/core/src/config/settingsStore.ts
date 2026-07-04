import { createSimpleStore } from '@hexafield/simple-store'

import { defaultLLMConfig, type LLMConfig } from '../services/llm/config/llmConfig'

/**
 * The live, resolved LLM config. Seeded at boot from runtime config + overrides
 * (see main.tsx) and updated by the in-app Settings panel. Both the panel and the
 * agent read from this single store.
 */
export const LLMSettingsState = createSimpleStore<LLMConfig>(defaultLLMConfig)
