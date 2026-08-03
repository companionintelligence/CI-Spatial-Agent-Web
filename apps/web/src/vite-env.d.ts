/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for the browser bundle. **Build time only** — Vite bakes it in,
   * so it must be present when `pnpm --filter @ci-avatar/web build` runs, and
   * with it unset the whole SDK is tree-shaken out. See
   * docs/operations/error-reporting.md.
   */
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
}
