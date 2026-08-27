import { defaultLLMConfig, type LLMConfig } from '../services/llm/config/llmConfig'
import type { RuntimeAppConfig } from './runtimeConfig'
import { defaultTTSConfig, type TTSConfig } from '../services/tts/ttsConfig'

/**
 * Resolves the effective LLM config by layering three sources, highest wins:
 *
 *   localStorage user overrides  >  runtime /config.json  >  build-time defaults
 *
 * Empty/undefined values are stripped from the runtime and override layers so a
 * blank field can never clobber a good default.
 */

export const LLM_OVERRIDES_KEY = 'ci_avatar_llm_overrides'

function stripEmpty<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

export function readLocalOverrides(): Partial<LLMConfig> {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(LLM_OVERRIDES_KEY) ?? '{}') as Partial<LLMConfig>
  } catch {
    return {}
  }
}

export function writeLocalOverrides(patch: Partial<LLMConfig>): Partial<LLMConfig> {
  const next = { ...readLocalOverrides(), ...stripEmpty(patch) }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LLM_OVERRIDES_KEY, JSON.stringify(next))
  }
  return next
}

export function clearLocalOverrides(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LLM_OVERRIDES_KEY)
  }
}

/**
 * Voice config, resolved with the same precedence as the LLM config:
 * build-time defaults < container runtime config < local user overrides.
 */
export function resolveTTSConfig(
  runtime: RuntimeAppConfig = {},
  overrides: Partial<TTSConfig> = {}
): TTSConfig {
  return {
    ...defaultTTSConfig,
    ...stripEmpty(runtime.tts ?? {}),
    ...stripEmpty(overrides)
  }
}

export function resolveLLMConfig(
  runtime: RuntimeAppConfig = {},
  overrides: Partial<LLMConfig> = readLocalOverrides()
): LLMConfig {
  return {
    ...defaultLLMConfig,
    ...stripEmpty(runtime.llm ?? {}),
    ...stripEmpty(overrides)
  }
}
