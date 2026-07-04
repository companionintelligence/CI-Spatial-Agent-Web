/**
 * Runtime configuration for the BFF, read from process.env on each resolve so a
 * marketplace container can be pointed at any upstream without a rebuild.
 */
export type UpstreamKind = 'ollama' | 'openai' | 'ci-server'

export interface ResolvedConfig {
  upstream: UpstreamKind
  ollamaUrl: string
  ollamaModel: string
  openaiUrl: string
  openaiApiKey: string
  openaiModel: string
  ciServerUrl: string
  port: number
  requestTimeoutMs: number
}

const VALID_UPSTREAMS: UpstreamKind[] = ['ollama', 'openai', 'ci-server']

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

  return {
    upstream,
    ollamaUrl: stripTrailingSlash(env.APP_OLLAMA_URL ?? 'http://host.docker.internal:11434'),
    ollamaModel: env.APP_OLLAMA_MODEL ?? 'gemma3:1b',
    openaiUrl: stripTrailingSlash(env.APP_OPENAI_URL ?? 'https://api.openai.com/v1'),
    openaiApiKey,
    openaiModel: env.APP_OPENAI_MODEL ?? 'gpt-4o-mini',
    ciServerUrl: stripTrailingSlash(env.APP_CISERVER_URL ?? ''),
    port: Number(env.PORT ?? 8787),
    requestTimeoutMs: Number(env.APP_REQUEST_TIMEOUT_MS ?? 60000)
  }
}
