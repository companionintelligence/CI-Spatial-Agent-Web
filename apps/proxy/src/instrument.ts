/**
 * Sentry bootstrap for the BFF. MUST be the first import in `server.ts` — the
 * SDK patches Node internals on init, and instrumentation applied after the
 * route modules are loaded misses anything they set up at import time.
 *
 * Reporting is opt-out: with a `SENTRY_DSN` configured it is on unless a kill
 * switch turns it off, and with no `SENTRY_DSN` this module initialises nothing
 * and the process makes no outbound connection. See `telemetry/settings.ts` for
 * the kill switches.
 */

import * as Sentry from '@sentry/node'

import { resolveTelemetrySettings, scrubEvent } from './telemetry/index.js'

/** Tag on every event from this container. Matches the published image name. */
export const COMPONENT = 'ci-spatial-companion-proxy'

const DROPPED_INTEGRATIONS = new Set([
  // We own the exit path (see `installCrashHandlers`): Sentry's own handlers
  // would double-report, and `OnUnhandledRejection` defaults to mode 'warn',
  // which would swallow a rejection Node 20 otherwise exits 1 on. Reporting is
  // not allowed to change the exit code.
  'OnUncaughtException',
  'OnUnhandledRejection',
  // Captured locals are the single worst leak in this process: the locals of the
  // `/api/chat` handler are `body` and `messages` — the user's entire prompt
  // history — and of `/api/tts`, the assistant's reply. No value-level regex can
  // recognise prose as private, so the frames must never carry it. This is the
  // Node equivalent of the fleet's `include_local_variables=False`.
  'LocalVariables'
])

export const telemetry = resolveTelemetrySettings(process.env, COMPONENT)

if (telemetry.enabled && telemetry.dsn) {
  Sentry.init({
    dsn: telemetry.dsn,
    environment: telemetry.environment,
    release: telemetry.release,
    enabled: true,
    // Error reporting only. Tracing would ship request shapes — and this
    // proxy's requests are conversations.
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    // Never attach IPs, cookies or request bodies.
    sendDefaultPii: false,
    // The machine hostname identifies the household as surely as a home path.
    includeServerName: false,
    integrations: (defaults) => defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
    beforeSend: scrubEvent
  })

  Sentry.setTag('component', COMPONENT)

  if (telemetry.deploymentVersion) {
    Sentry.setTag('deployment_version', telemetry.deploymentVersion)
  }
}

/** True when `Sentry.init` actually ran; capture calls are no-ops otherwise. */
export function isTelemetryEnabled(): boolean {
  return telemetry.enabled
}

/** Report an error, if and only if reporting is on. Never throws. */
export function captureException(error: unknown): void {
  if (!telemetry.enabled) {
    return
  }

  try {
    Sentry.captureException(error)
  } catch {
    // Reporting must never be able to break a request.
  }
}

/**
 * Flush buffered events, bounded so a wedged network can't hold shutdown open.
 * Resolves even when Sentry was never initialised.
 *
 * `Sentry.close(timeoutMs)` alone is NOT a real bound: its timeout only limits
 * how long the transport waits, and the promise still resolves on a later event
 * loop turn — so a crash handler behind heavy queued synchronous work could
 * overrun the nominal budget by an unbounded margin. Race it against a real
 * timer so the caller's exit path always runs on schedule. The timer is
 * unref'd: it must never be the thing keeping the process alive.
 */
export async function flushTelemetry(timeoutMs = 2000): Promise<void> {
  if (!telemetry.enabled) {
    return
  }

  await Promise.race([
    Sentry.close(timeoutMs).catch(() => undefined),
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      timer.unref?.()
    })
  ])
}

/**
 * Own the crash and shutdown paths so a fatal error is reported before the
 * process dies.
 *
 * Installed ONLY when reporting is enabled. The proxy ships with no process
 * handlers of its own, so with telemetry off (the default) Node's exact default
 * behaviour is preserved — no handler is registered at all. With it on:
 *
 *   - `uncaughtException` / `unhandledRejection` capture, flush (bounded), then
 *     `process.exit(1)` — the same exit code Node 20 produces unhandled.
 *   - `SIGTERM` / `SIGINT` flush once and then **re-raise the signal** with the
 *     handler removed, so the process dies of the signal exactly as it would
 *     have, exit status included.
 */
export function installCrashHandlers(): void {
  if (!telemetry.enabled) {
    return
  }

  const exitAfterReporting = () => {
    void flushTelemetry().finally(() => process.exit(1))
  }

  process.on('uncaughtException', (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('[proxy] uncaught exception', error)
    captureException(error)
    exitAfterReporting()
  })

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason ?? 'Unknown unhandled rejection'))

    // eslint-disable-next-line no-console
    console.error('[proxy] unhandled rejection', error)
    captureException(error)
    exitAfterReporting()
  })

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void flushTelemetry().finally(() => {
        // `once` has already removed this listener, so re-raising runs Node's
        // default disposition and the exit status is unchanged (128 + signum).
        process.kill(process.pid, signal)
      })
    })
  }
}
