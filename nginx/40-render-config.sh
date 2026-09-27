#!/bin/sh
# Runtime config generation for the Spatial Companion SPA.
#
# The stock nginx image runs every /docker-entrypoint.d/*.sh before starting, so
# this writes /config.json from container env at boot. The prebuilt image can then
# be pointed at any Ollama/proxy/upstream via install-time env — no rebuild.
#
# A heredoc is used (not envsubst) so an unset variable becomes "" rather than a
# literal ${VAR}.
#
# Env values are never interpolated raw: booleans are coerced and strings are
# escaped first, so no value an operator can set produces a document the SPA
# cannot parse. That matters more than it looks — the loader
# (packages/core/src/config/runtimeConfig.ts) swallows a parse failure and
# resolves to `{}`, so a single bad byte here silently drops the *whole* runtime
# config (proxy URL, model, TTS mode) back to build-time defaults, with nothing
# in the logs. `APP_STT_REMOTE=yes` used to be enough to do it.
#
# scripts/pages-config.mjs is the static (Cloudflare Pages) counterpart of this
# file: same APP_* variables, same shape. Keep the two in step.
#
# POSIX sh only (busybox ash in nginx:alpine) — no bashisms.
set -eu

# Output path. Overridable so the generator can be exercised without writing
# into a live docroot; every container leaves it at the default.
RENDER_CONFIG_OUT="${RENDER_CONFIG_OUT:-/usr/share/nginx/html/config.json}"

# Coerce an env string to a real JSON boolean. Operators write 1/yes/on about as
# often as `true`, and anything else — junk, empty-but-set, unset — is `false`
# rather than invalid JSON.
#
# Deliberately identical to asBoolean() in scripts/pages-config.mjs, the static
# (Cloudflare Pages) generator: the two read the same APP_* variables and must
# agree on what they mean, so the same env describes a deployment however it is
# served. Trim first, then lowercase, then match the same four spellings.
json_bool() {
  case "$(printf '%s' "${1:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr 'A-Z' 'a-z')" in
    1 | true | yes | on) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

# Escape a value for use inside a double-quoted JSON string: backslash and
# double quote are escaped, control characters are dropped (no field here — URL,
# model id, voice name, provider — can legitimately carry one, and JSON forbids
# them unescaped).
json_string() {
  printf '%s' "${1:-}" | tr -d '[:cntrl:]' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

llm_provider="$(json_string "${APP_LLM_PROVIDER:-proxy}")"
proxy_url="$(json_string "${APP_PROXY_URL:-/api/chat}")"
proxy_model="$(json_string "${APP_LLM_MODEL:-}")"
ollama_url="$(json_string "${APP_OLLAMA_URL:-}")"
ollama_model="$(json_string "${APP_LLM_MODEL:-gemma3:1b}")"
tts_mode="$(json_string "${APP_TTS_MODE:-browser}")"
tts_voice="$(json_string "${APP_TTS_VOICE:-}")"
stt_remote="$(json_bool "${APP_STT_REMOTE:-false}")"

cat > "$RENDER_CONFIG_OUT" <<EOF
{
  "llm": {
    "llm_provider": "${llm_provider}",
    "proxy_url": "${proxy_url}",
    "proxy_model": "${proxy_model}",
    "ollama_url": "${ollama_url}",
    "ollama_model": "${ollama_model}"
  },
  "tts": {
    "mode": "${tts_mode}",
    "voice": "${tts_voice}"
  },
  "stt": {
    "remote": ${stt_remote}
  }
}
EOF

echo "[40-render-config] wrote ${RENDER_CONFIG_OUT} (provider=${llm_provider} tts=${tts_mode} stt_remote=${stt_remote})"
