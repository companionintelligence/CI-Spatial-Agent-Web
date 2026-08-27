import { createSimpleStore } from '@hexafield/simple-store'

import { defaultLLMConfig, type LLMConfig } from '../services/llm/config/llmConfig'
import { defaultTTSConfig, type TTSConfig } from '../services/tts/ttsConfig'

/**
 * The live, resolved LLM config. Seeded at boot from runtime config + overrides
 * (see main.tsx) and updated by the in-app Settings panel. Both the panel and the
 * agent read from this single store.
 */
export const LLMSettingsState = createSimpleStore<LLMConfig>(defaultLLMConfig)

/**
 * The live, resolved voice config. Seeded at boot the same way as the LLM config,
 * so an appliance can be switched onto its local neural-voice sidecar — and thus
 * from inferred to phoneme-accurate lip-sync — without rebuilding the image.
 */
export const TTSSettingsState = createSimpleStore<TTSConfig>(defaultTTSConfig)
