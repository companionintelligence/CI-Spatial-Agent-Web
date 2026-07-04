# Spatial Companion (ci-spatial-companion-webxr) — CI marketplace container.
# pnpm monorepo: builds only the web app and serves its static dist with nginx.
# Published as ghcr.io/companionintelligence/ci-spatial-companion-webxr.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# Full build: `tsc -b && vite build`. Both the lockfile drift and the
# packages/core Scene3D.tsx type errors that previously forced workarounds
# here are fixed, so the typecheck gate is back in the container build.
RUN pnpm --filter @ci-avatar/web build

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
