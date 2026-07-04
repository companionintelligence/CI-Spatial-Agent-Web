import type { LLMConfig } from '../services/llm/config/llmConfig'

/**
 * Runtime configuration delivered to a *built* container without a rebuild.
 *
 * In production an nginx entrypoint writes `/config.json` from container env
 * (APP_OLLAMA_URL, APP_LLM_MODEL, APP_PROXY_URL, ...). The SPA fetches it once at
 * boot. A synchronous `window.__APP_CONFIG__` is also honored for embedding/tests.
 */
export interface RuntimeAppConfig {
  llm?: Partial<LLMConfig>
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeAppConfig
  }
}

let cached: RuntimeAppConfig | null = null

/**
 * Load runtime config. Never rejects: a missing/invalid/HTML response (e.g. the
 * dev server's index.html 404) resolves to `{}` so the app falls back to
 * build-time defaults. Guards on content-type so HTML is not parsed as JSON.
 */
export async function loadRuntimeConfig(url = '/config.json'): Promise<RuntimeAppConfig> {
  if (cached) return cached

  if (typeof window !== 'undefined' && window.__APP_CONFIG__) {
    cached = window.__APP_CONFIG__
    return cached
  }

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const contentType = res.headers.get('content-type') ?? ''
    cached = res.ok && contentType.includes('json') ? ((await res.json()) as RuntimeAppConfig) : {}
  } catch {
    cached = {}
  }
  return cached
}

/** Test hook — clears the module cache so a fresh load can be exercised. */
export function __resetRuntimeConfigCache(): void {
  cached = null
}
