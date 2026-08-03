# Spatial Companion BFF (ci-spatial-companion-proxy) — CI marketplace sidecar.
# Streams chat from a runtime-configured upstream (Ollama / OpenAI-compatible / CI-Server).
# Published as ghcr.io/companionintelligence/ci-spatial-companion-proxy.
#
# Build context is the repo root (pnpm workspace).

# ---- build stage ----
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ci-avatar/proxy build

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Pure-JS prod deps (hono, @hono/node-server, @sentry/node); install them fresh to
# avoid copying the pnpm workspace symlink farm.
COPY apps/proxy/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/apps/proxy/dist ./dist
# Error reporting (Sentry) is opt-in and read at RUNTIME — with SENTRY_DSN unset
# nothing initialises and the process makes no outbound call. All optional:
#   SENTRY_DSN=https://<key>@o<org>.ingest.us.sentry.io/<id>
#   SENTRY_ENV / APP_ENVIRONMENT / SENTRY_RELEASE / APP_VERSION
#   CI_TELEMETRY=off      — kill switch; also gates the browser via /api/config/telemetry
#   CI_LOCAL_ONLY=true    — local-only mode: zero phone-home, beats everything
# See docs/operations/error-reporting.md.
EXPOSE 8787
CMD ["node", "dist/server.js"]
