#!/bin/sh
# Runtime config generation for the Spatial Companion SPA.
#
# The stock nginx image runs every /docker-entrypoint.d/*.sh before starting, so
# this writes /config.json from container env at boot. The prebuilt image can then
# be pointed at any Ollama/proxy/upstream via install-time env — no rebuild.
#
# A heredoc is used (not envsubst) so an unset variable becomes "" rather than a
# literal ${VAR}.
set -eu

cat > /usr/share/nginx/html/config.json <<EOF
{
  "llm": {
    "llm_provider": "${APP_LLM_PROVIDER:-proxy}",
    "proxy_url": "${APP_PROXY_URL:-/api/chat}",
    "proxy_model": "${APP_LLM_MODEL:-}",
    "ollama_url": "${APP_OLLAMA_URL:-}",
    "ollama_model": "${APP_LLM_MODEL:-gemma3:1b}"
  },
  "tts": {
    "mode": "${APP_TTS_MODE:-browser}",
    "voice": "${APP_TTS_VOICE:-}"
  }
}
EOF

echo "[40-render-config] wrote /config.json (provider=${APP_LLM_PROVIDER:-proxy} tts=${APP_TTS_MODE:-browser})"
