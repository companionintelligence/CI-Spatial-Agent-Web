import { describe, expect, it } from 'vitest'

import { buildConfig } from './pages-config.mjs'

/**
 * `dist/config.json` is the only thing that can point a static Cloudflare Pages
 * deploy at a tunnelled backend without a source change, and it is served to
 * every visitor. So the cases that matter are: an absolute proxy_url survives, a
 * blank env var never clobbers a good build-time default, and nothing
 * secret-shaped is ever emitted.
 */
describe('buildConfig', () => {
  it('is empty when nothing is configured', () => {
    expect(buildConfig({})).toEqual({})
  })

  it('carries an absolute tunnel proxy_url through unchanged', () => {
    const config = buildConfig({
      APP_LLM_PROVIDER: 'proxy',
      APP_PROXY_URL: 'https://avatar-api.ci.computer/api/chat'
    })

    expect(config.llm).toEqual({
      llm_provider: 'proxy',
      proxy_url: 'https://avatar-api.ci.computer/api/chat'
    })
  })

  it('drops blank values rather than emitting them', () => {
    // An unset Pages build variable arrives as "", and an emitted "" would beat
    // the build-time default in appConfigService's precedence chain.
    const config = buildConfig({ APP_LLM_PROVIDER: 'proxy', APP_PROXY_URL: '', APP_TTS_VOICE: '' })

    expect(config.llm).toEqual({ llm_provider: 'proxy' })
    expect(config.tts).toBeUndefined()
  })

  it('omits a section entirely when it has no configured fields', () => {
    const config = buildConfig({ APP_LLM_PROVIDER: 'proxy' })

    expect(config.tts).toBeUndefined()
    expect(config.stt).toBeUndefined()
  })

  it('feeds APP_LLM_MODEL to both the proxy and ollama model fields', () => {
    // Mirrors nginx/40-render-config.sh, so one variable describes "the model"
    // regardless of which provider the deploy ends up using.
    const config = buildConfig({ APP_LLM_MODEL: 'gemma3:1b' })

    expect(config.llm).toEqual({ proxy_model: 'gemma3:1b', ollama_model: 'gemma3:1b' })
  })

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['', false],
    ['nonsense', false]
  ])('coerces APP_STT_REMOTE=%s to %s', (raw, expected) => {
    // The nginx heredoc interpolates this value unquoted, so a non-boolean there
    // produces invalid JSON. Here it is always a real boolean.
    expect(buildConfig({ APP_STT_REMOTE: raw }).stt).toEqual({ remote: expected })
  })

  it('leaves stt absent when APP_STT_REMOTE is not set at all', () => {
    expect(buildConfig({ APP_LLM_PROVIDER: 'proxy' }).stt).toBeUndefined()
  })

  it('never emits an API key, however the env is spelled', () => {
    const config = buildConfig({
      APP_LLM_PROVIDER: 'proxy',
      APP_OPENAI_API_KEY: 'sk-should-never-ship',
      APP_TTS_API_KEY: 'tts-should-never-ship',
      APP_CI_SERVER_API_KEY: 'ci-should-never-ship'
    })

    expect(JSON.stringify(config)).not.toMatch(/should-never-ship/)
  })

  it('produces JSON the runtime loader can parse', () => {
    const config = buildConfig({
      APP_LLM_PROVIDER: 'proxy',
      APP_PROXY_URL: 'https://avatar-api.ci.computer/api/chat',
      APP_TTS_MODE: 'browser',
      APP_STT_REMOTE: 'false'
    })

    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})
