import { Hono } from 'hono'

import { isLocalOnly, isTelemetryOptedOut, type TelemetryDisabledReason } from '../telemetry/index.js'

export const configRoutes = new Hono()

/**
 * GET /api/config/telemetry — runtime error-reporting consent for the browser.
 *
 * A DSN baked into a bundle at build time cannot be revoked afterwards, so the
 * `CI_TELEMETRY` / `CI_LOCAL_ONLY` kill switches — including the marketplace
 * "Share crash reports" toggle, which sets `CI_TELEMETRY` on both containers —
 * would silently not apply to the SPA. The browser asks this endpoint before
 * calling `Sentry.init` and fails closed if it cannot get an answer.
 *
 * In production nginx proxies `/api/` here from the same origin as the bundle
 * (see `nginx/default.conf`); in dev the Vite server proxies it to `:8787`.
 *
 * Deliberately unauthenticated — there is no auth on this proxy at all, and it
 * exposes no secret: never the DSN, only whether reporting is permitted.
 *
 * **Deviation from CI-Server's TelemetryConfigController, on purpose.** There
 * the API and the bundle ship in one container, so the endpoint can resolve the
 * full gate including `SENTRY_DSN`. Here the SPA and this proxy are two separate
 * images: the browser's DSN is baked into `ci-spatial-companion-webxr` at build
 * time and this container may legitimately have no `SENTRY_DSN` of its own.
 * Resolving the DSN half here would mean a web image built *with* a DSN never
 * reports unless the operator also set an unrelated DSN on the sidecar — a
 * silent, undiagnosable failure. So this endpoint answers only the question it
 * can actually answer for the browser: *is reporting permitted right now?* The
 * DSN half of the gate stays where it belongs, at the browser's build time.
 */
configRoutes.get('/config/telemetry', (c) => {
  const reason: TelemetryDisabledReason | null = isLocalOnly(process.env)
    ? 'local-only'
    : isTelemetryOptedOut(process.env)
      ? 'opt-out'
      : null

  if (reason) {
    return c.json({ enabled: false as const, reason })
  }

  return c.json({ enabled: true as const })
})
