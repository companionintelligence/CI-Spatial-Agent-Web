/**
 * Runtime configuration for the BFF, read from process.env on each resolve so a
 * marketplace container can be pointed at any upstream without a rebuild.
 */
export type UpstreamKind = 'ollama' | 'openai' | 'ci-server'

/**
 * TTS upstream kind. `cosyvoice` speaks to a CosyVoice2 OpenAI-compatible server
 * (see `upstreams/cosyvoice.ts`). Kept as its own enum so the chat and TTS
 * upstreams evolve independently.
 */
export type TtsUpstreamKind = 'cosyvoice' | 'headtts'

export interface ResolvedConfig {
  upstream: UpstreamKind
  ollamaUrl: string
  ollamaModel: string
  openaiUrl: string
  openaiApiKey: string
  openaiModel: string
  ciServerUrl: string
  /** Selected TTS upstream (env APP_TTS_UPSTREAM). */
  ttsUpstream: TtsUpstreamKind
  /**
   * Base URL of the TTS server. Should point at a CosyVoice2 OpenAI-compatible
   * server exposing `POST /v1/audio/speech` — e.g. gpustack/vox-box or
   * neosun100/cosyvoice-docker. There is no such server in CI/tests, which is
   * why the TTS tests mock `fetch`.
   */
  ttsUrl: string
  ttsModel: string
  ttsVoice: string
  port: number
  requestTimeoutMs: number
}

const VALID_UPSTREAMS: UpstreamKind[] = ['ollama', 'openai', 'ci-server']
const VALID_TTS_UPSTREAMS: TtsUpstreamKind[] = ['cosyvoice', 'headtts']

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  const upstream = (env.APP_UPSTREAM ?? 'ollama') as UpstreamKind
  if (!VALID_UPSTREAMS.includes(upstream)) {
    throw new Error(`Invalid APP_UPSTREAM "${upstream}" (expected one of: ${VALID_UPSTREAMS.join(', ')})`)
  }

  const openaiApiKey = env.APP_OPENAI_API_KEY ?? ''
  if (upstream === 'openai' && !openaiApiKey) {
    throw new Error('APP_OPENAI_API_KEY is required when APP_UPSTREAM=openai')
  }

  const ttsUpstream = (env.APP_TTS_UPSTREAM ?? 'cosyvoice') as TtsUpstreamKind
  if (!VALID_TTS_UPSTREAMS.includes(ttsUpstream)) {
    throw new Error(
      `Invalid APP_TTS_UPSTREAM "${ttsUpstream}" (expected one of: ${VALID_TTS_UPSTREAMS.join(', ')})`
    )
  }

  return {
    upstream,
    ollamaUrl: stripTrailingSlash(env.APP_OLLAMA_URL ?? 'http://host.docker.internal:11434'),
    ollamaModel: env.APP_OLLAMA_MODEL ?? 'gemma3:1b',
    openaiUrl: stripTrailingSlash(env.APP_OPENAI_URL ?? 'https://api.openai.com/v1'),
    openaiApiKey,
    openaiModel: env.APP_OPENAI_MODEL ?? 'gpt-4o-mini',
    ciServerUrl: stripTrailingSlash(env.APP_CISERVER_URL ?? ''),
    ttsUpstream,
    // Default targets a CosyVoice2 OpenAI-compatible server on the host. 8880 is
    // the port used by common CosyVoice2 Docker images (e.g. vox-box); override
    // with APP_TTS_URL for a different host/port.
    ttsUrl: stripTrailingSlash(env.APP_TTS_URL ?? 'http://host.docker.internal:8880'),
    ttsModel: env.APP_TTS_MODEL ?? 'cosyvoice2-0.5b',
    ttsVoice: env.APP_TTS_VOICE ?? 'default',
    port: Number(env.PORT ?? 8787),
    requestTimeoutMs: Number(env.APP_REQUEST_TIMEOUT_MS ?? 60000)
  }
}
