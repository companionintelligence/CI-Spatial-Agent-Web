#!/usr/bin/env node
/**
 * pages-config.mjs — write `dist/config.json` for a STATIC deploy (Cloudflare Pages).
 *
 * The SPA already reads `/config.json` at boot (packages/core/src/config/runtimeConfig.ts)
 * and layers it over the build-time defaults, with localStorage overrides on top. In the
 * container that file is generated at *container start* by the nginx entrypoint
 * (nginx/40-render-config.sh) from `APP_*` env.
 *
 * A Cloudflare Pages deploy has no entrypoint — nothing runs at request time — so the
 * file has to be produced at *build* time instead. This script does that, reading the
 * same `APP_*` variable names as the nginx entrypoint so one set of env vars describes a
 * deployment however it is served.
 *
 * Why it matters for avatar.ci.computer: the Pages origin serves only static files, so
 * there is no `/api/chat` there. The backend is self-hosted and exposed over a Cloudflare
 * tunnel, which means `proxy_url` must be an ABSOLUTE URL to that tunnel — and the only
 * way to set it without editing source is this file.
 *
 * It is a NO-OP unless at least one `APP_*` variable is set, so local, Docker and CI
 * builds are byte-for-byte unchanged and the nginx path keeps generating its own copy.
 *
 * Secrets are deliberately not supported: `config.json` is served to every visitor, so
 * only non-secret fields (provider, URLs, model names, voice) are emitted. API keys
 * belong on the proxy, which is the reason the proxy exists.
 *
 * Usage (as part of apps/web postbuild):
 *   node ../../scripts/pages-config.mjs dist
 */
import { writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// The same names nginx/40-render-config.sh reads. Keep the two in step.
const KEYS = [
  'APP_LLM_PROVIDER',
  'APP_PROXY_URL',
  'APP_LLM_MODEL',
  'APP_OLLAMA_URL',
  'APP_TTS_MODE',
  'APP_TTS_VOICE',
  'APP_STT_REMOTE'
]

/** Treat only the usual affirmative spellings as true; anything else is false. */
function asBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

/** Drop keys whose value is undefined or empty, so a blank env var cannot clobber a good default. */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''))
}

export function buildConfig(env) {
  const llm = compact({
    llm_provider: env.APP_LLM_PROVIDER,
    proxy_url: env.APP_PROXY_URL,
    proxy_model: env.APP_LLM_MODEL,
    ollama_url: env.APP_OLLAMA_URL,
    ollama_model: env.APP_LLM_MODEL
  })
  const tts = compact({ mode: env.APP_TTS_MODE, voice: env.APP_TTS_VOICE })
  // `remote` is a real boolean in the config type, and absent means "leave the default".
  const stt = env.APP_STT_REMOTE === undefined ? {} : { remote: asBoolean(env.APP_STT_REMOTE) }

  return compact({
    llm: Object.keys(llm).length ? llm : undefined,
    tts: Object.keys(tts).length ? tts : undefined,
    stt: Object.keys(stt).length ? stt : undefined
  })
}

// Exported for tests; only the CLI path below touches the filesystem.
export function main(argv = process.argv, env = process.env) {
  if (!KEYS.some((k) => env[k] !== undefined && env[k] !== '')) {
    // No deployment env — leave the build alone. Docker generates its own config.json
    // at container start, and a bare build correctly has none (the loader tolerates 404).
    return { written: false, reason: 'no APP_* variables set' }
  }

  const dir = resolve(argv[2] || 'dist')
  if (!existsSync(dir)) {
    console.warn(`[pages-config] ${dir} does not exist; skipping.`)
    return { written: false, reason: 'missing output dir' }
  }

  const config = buildConfig(env)
  const target = join(dir, 'config.json')
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`)

  console.log(
    `[pages-config] wrote ${target} (provider=${config.llm?.llm_provider ?? 'default'} ` +
      `proxy_url=${config.llm?.proxy_url ?? 'default'} tts=${config.tts?.mode ?? 'default'})`
  )
  return { written: true, config, target }
}

// Run only when invoked directly, so the helpers above stay unit-testable.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
