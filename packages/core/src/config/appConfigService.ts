import { defaultLLMConfig, type LLMConfig } from '../services/llm/config/llmConfig'
import type { RuntimeAppConfig } from './runtimeConfig'
import { defaultTTSConfig, type TTSConfig } from '../services/tts/ttsConfig'
import { defaultSTTConfig, type STTConfig } from '../services/stt/sttConfig'

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

/**
 * The browser's storage, or nothing when there is none or it cannot be reached: in a document
 * sandboxed without allow-same-origin, or with site data blocked, merely reading `localStorage`
 * throws a SecurityError, and `typeof localStorage` does not protect against that.
 */
function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function readLocalOverrides(): Partial<LLMConfig> {
  try {
    return JSON.parse(storage()?.getItem(LLM_OVERRIDES_KEY) ?? '{}') as Partial<LLMConfig>
  } catch {
    return {}
  }
}

export function writeLocalOverrides(patch: Partial<LLMConfig>): Partial<LLMConfig> {
  const next = { ...readLocalOverrides(), ...stripEmpty(patch) }
  try {
    storage()?.setItem(LLM_OVERRIDES_KEY, JSON.stringify(next))
  } catch {
    // Full quota or blocked storage: the settings still apply for this visit.
  }
  return next
}

export function clearLocalOverrides(): void {
  try {
    storage()?.removeItem(LLM_OVERRIDES_KEY)
  } catch {
    // Nothing could have been stored, so there is nothing to clear.
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

/** Speech-input config, resolved like the others. */
export function resolveSTTConfig(runtime: RuntimeAppConfig = {}): STTConfig {
  return { ...defaultSTTConfig, ...stripEmpty(runtime.stt ?? {}) }
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
