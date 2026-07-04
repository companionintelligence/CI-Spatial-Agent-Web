import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('defaults to the ollama upstream on host.docker.internal', () => {
    const cfg = resolveConfig({})
    expect(cfg.upstream).toBe('ollama')
    expect(cfg.ollamaUrl).toBe('http://host.docker.internal:11434')
    expect(cfg.ollamaModel).toBe('gemma3:1b')
    expect(cfg.port).toBe(8787)
  })

  it('strips trailing slashes from upstream URLs', () => {
    const cfg = resolveConfig({ APP_OLLAMA_URL: 'http://host:11434/' })
    expect(cfg.ollamaUrl).toBe('http://host:11434')
  })

  it('selects the openai upstream and requires an API key', () => {
    expect(() => resolveConfig({ APP_UPSTREAM: 'openai' })).toThrow(/APP_OPENAI_API_KEY/)
    const cfg = resolveConfig({ APP_UPSTREAM: 'openai', APP_OPENAI_API_KEY: 'sk-test' })
    expect(cfg.upstream).toBe('openai')
    expect(cfg.openaiApiKey).toBe('sk-test')
  })

  it('rejects an unknown upstream', () => {
    expect(() => resolveConfig({ APP_UPSTREAM: 'bogus' })).toThrow(/Invalid APP_UPSTREAM/)
  })
})
