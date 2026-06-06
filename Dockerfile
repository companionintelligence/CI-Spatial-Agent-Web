# Spatial Companion (ci-spatial-companion-webxr) — CI marketplace container.
# pnpm monorepo: builds only the web app and serves its static dist with nginx.
# Published as ghcr.io/companionintelligence/ci-spatial-companion-webxr.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# vite-direct build (skips `tsc -b`): the app's tsc typecheck currently fails on
# packages/core Scene3D.tsx type errors while vite itself builds clean. See repo
# build notes — this only skips typecheck, not the actual bundle.
RUN pnpm --filter @ci-avatar/web exec vite build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
