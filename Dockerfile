# Spatial Companion (ci-spatial-companion-webxr) — CI marketplace container.
# pnpm monorepo: builds only the web app and serves its static dist with nginx.
# Published as ghcr.io/companionintelligence/ci-spatial-companion-webxr.
#
# The build stage runs under Deno (`deno run`/`deno task`, via its npm/Node
# compat mode — see deno.json and apps/web/deno.json) as part of an org-wide
# Node→Deno migration. The runtime stage is unchanged: this ships a static
# SPA with no server/runtime component to migrate, so it stays nginx.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
# Official "bin" image variant, meant to be copied from — see
# https://github.com/denoland/deno_docker. Pinned to the same Deno version
# this migration was developed and tested against.
COPY --from=denoland/deno:bin-2.9.5 /deno /usr/local/bin/deno
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# Vite envs are baked in at build time. Pass these as --build-arg to point the
# image at an LLM/TTS backend; the defaults keep the offline scripted-responses
# mode that the published image ships with.
ARG VITE_LLM_PROVIDER
ARG VITE_LLM_OLLAMA_API_URL
ARG VITE_LLM_OLLAMA_MODEL
ARG VITE_TTS_MODE
ARG VITE_POCKET_TTS_URL
# Error reporting (Sentry) — opt-out. Pass VITE_SENTRY_DSN and reporting is on
# unless the user turns it off; leave it unset and the SDK is tree-shaken out of
# the bundle entirely. There is no runtime equivalent of the DSN, because Vite
# bakes it in. The off switch does work at runtime though: even with a DSN baked
# in, the browser asks the proxy sidecar (GET /api/config/telemetry) for consent
# first and fails closed, so CI_TELEMETRY=off on the containers turns reporting
# off without a rebuild. See docs/operations/error-reporting.md.
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ARG VITE_SENTRY_RELEASE
ENV VITE_LLM_PROVIDER=${VITE_LLM_PROVIDER} \
    VITE_LLM_OLLAMA_API_URL=${VITE_LLM_OLLAMA_API_URL} \
    VITE_LLM_OLLAMA_MODEL=${VITE_LLM_OLLAMA_MODEL} \
    VITE_TTS_MODE=${VITE_TTS_MODE} \
    VITE_POCKET_TTS_URL=${VITE_POCKET_TTS_URL} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT} \
    VITE_SENTRY_RELEASE=${VITE_SENTRY_RELEASE}
# Full build: `tsc -b && vite build` (see apps/web/deno.json), against the
# node_modules pnpm just installed above. Both the lockfile drift and the
# packages/core Scene3D.tsx type errors that previously forced workarounds
# here are fixed, so the typecheck gate is back in the container build.
RUN deno task --cwd apps/web build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Runtime /config.json generation from env: the stock nginx entrypoint runs
# /docker-entrypoint.d/*.sh before starting, so the prebuilt image can be pointed
# at any Ollama/proxy upstream at install time without a rebuild.
COPY nginx/40-render-config.sh /docker-entrypoint.d/40-render-config.sh
RUN chmod +x /docker-entrypoint.d/40-render-config.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
