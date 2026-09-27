import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * `nginx/40-render-config.sh` is the container entrypoint that turns APP_* env
 * into the `/config.json` the SPA fetches at boot. It is the only place where
 * operator-supplied strings become JSON, and the loader
 * (packages/core/src/config/runtimeConfig.ts) swallows a parse error and falls
 * back to `{}` — so an unparseable document does not surface as an error, it
 * silently discards the *entire* runtime config. That failure mode ("my
 * container ignores the env vars I set", nothing in the logs) is what these
 * cases exist to prevent, so every one of them asserts the output parses.
 *
 * The script is run with `sh` for real rather than reimplemented here; the
 * container runs it under busybox ash and CI under dash, so it sticks to POSIX.
 */
const SCRIPT = join(import.meta.dirname, '40-render-config.sh')
const workdir = mkdtempSync(join(tmpdir(), 'render-config-'))

afterAll(() => rmSync(workdir, { recursive: true, force: true }))

interface RenderedConfig {
  llm: { llm_provider: string; proxy_url: string; proxy_model: string; ollama_url: string; ollama_model: string }
  tts: { mode: string; voice: string }
  stt: { remote: boolean }
}

let run = 0

/** Run the generator with `env` and return the parsed config (throws if invalid JSON). */
function render(env: Record<string, string> = {}): RenderedConfig {
  const out = join(workdir, `config.${run++}.json`)

  execFileSync('sh', [SCRIPT], {
    env: { PATH: process.env.PATH ?? '', RENDER_CONFIG_OUT: out, ...env },
    stdio: 'pipe'
  })

  return JSON.parse(readFileSync(out, 'utf8')) as RenderedConfig
}

describe('40-render-config.sh', () => {
  it('emits the documented defaults when nothing is set', () => {
    expect(render()).toEqual({
      llm: {
        llm_provider: 'proxy',
        proxy_url: '/api/chat',
        proxy_model: '',
        ollama_url: '',
        ollama_model: 'gemma3:1b'
      },
      tts: { mode: 'browser', voice: '' },
      stt: { remote: false }
    })
  })

  it('passes through the values an appliance install sets', () => {
    const config = render({
      APP_LLM_PROVIDER: 'ollama',
      APP_PROXY_URL: 'https://hub.local/api/chat',
      APP_LLM_MODEL: 'gemma3:4b',
      APP_OLLAMA_URL: 'http://host.docker.internal:11434',
      APP_TTS_MODE: 'headtts',
      APP_TTS_VOICE: 'af_heart',
      APP_STT_REMOTE: 'true'
    })

    expect(config).toEqual({
      llm: {
        llm_provider: 'ollama',
        proxy_url: 'https://hub.local/api/chat',
        proxy_model: 'gemma3:4b',
        ollama_url: 'http://host.docker.internal:11434',
        ollama_model: 'gemma3:4b'
      },
      tts: { mode: 'headtts', voice: 'af_heart' },
      stt: { remote: true }
    })
  })

  // APP_STT_REMOTE is the one field interpolated bare, so it is the one that can
  // take the whole document down. Operators write truthy values every which way.
  it.each(['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'On'])('reads %j as remote: true', (value) => {
    expect(render({ APP_STT_REMOTE: value }).stt.remote).toBe(true)
  })

  it.each(['false', 'FALSE', '0', 'no', 'off', '', ' ', 'junk', 'null', '{}', 'true false'])(
    'reads %j as remote: false',
    (value) => {
      expect(render({ APP_STT_REMOTE: value }).stt.remote).toBe(false)
    }
  )

  it('stays valid JSON when APP_STT_REMOTE carries JSON punctuation', () => {
    // Bare interpolation would have closed the object and appended keys.
    expect(render({ APP_STT_REMOTE: 'true, "injected": 1, "x": "' }).stt.remote).toBe(false)
  })

  it('escapes double quotes and backslashes in string fields', () => {
    const config = render({
      APP_TTS_VOICE: 'say "hi"',
      APP_OLLAMA_URL: 'C:\\ollama\\bin',
      APP_PROXY_URL: '/api/chat", "injected": true, "x": "'
    })

    expect(config.tts.voice).toBe('say "hi"')
    expect(config.llm.ollama_url).toBe('C:\\ollama\\bin')
    expect(config.llm.proxy_url).toBe('/api/chat", "injected": true, "x": "')
    expect(config).not.toHaveProperty('injected')
  })

  it('drops control characters rather than emitting them raw', () => {
    // A newline or tab inside a JSON string is a parse error; none of these
    // fields (URLs, model ids, voice names) can legitimately contain one.
    const config = render({ APP_LLM_PROVIDER: 'pro\txy\nbad', APP_TTS_VOICE: 'af\r_heart' })

    expect(config.llm.llm_provider).toBe('proxybad')
    expect(config.tts.voice).toBe('af_heart')
  })
})
