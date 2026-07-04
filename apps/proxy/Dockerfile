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
# Only two light, pure-JS prod deps (hono + @hono/node-server); install them fresh to
# avoid copying the pnpm workspace symlink farm.
COPY apps/proxy/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/apps/proxy/dist ./dist
EXPOSE 8787
CMD ["node", "dist/server.js"]
