// Sentry bootstrap. Must stay the FIRST import: the SDK patches Node internals
// on init, and it initialises nothing at all unless a DSN is configured.
import { captureException, installCrashHandlers, isTelemetryEnabled, telemetry } from './instrument.js'

import { pathToFileURL } from 'node:url'

import { Hono } from 'hono'

import { resolveConfig } from './config.js'
import { chatRoutes } from './routes/chat.js'
import { configRoutes } from './routes/config.js'
import { healthRoutes } from './routes/health.js'
import { ttsRoutes } from './routes/tts.js'

/**
 * Build the BFF app. Exported so tests can drive the whole pipeline in-process
 * via `app.request(...)` without binding a socket.
 */
export function createApp(): Hono {
  const app = new Hono()
  app.route('/api', healthRoutes)
  app.route('/api', configRoutes)
  app.route('/api', chatRoutes)
  app.route('/api', ttsRoutes)

  // Report unexpected route failures. The two branches below are a line-for-line
  // copy of Hono's own default error handler (`hono/dist/hono-base.js`), down to
  // the duck-typed `'getResponse' in err` check, so installing this changes no
  // response, status or body. The only addition is the capture — a no-op when
  // reporting is off.
  app.onError((err, c) => {
    if ('getResponse' in err) {
      const res = (err as { getResponse: () => Response }).getResponse()
      return c.newResponse(res.body, res)
    }

    // eslint-disable-next-line no-console
    console.error(err)
    captureException(err)

    return c.text('Internal Server Error', 500)
  })

  return app
}

// Start a listener only when executed directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  // No-op unless a DSN is configured: with reporting off no process handler is
  // registered at all, so crash behaviour and exit codes are unchanged.
  installCrashHandlers()

  const cfg = resolveConfig()
  const app = createApp()
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port: cfg.port })
  // eslint-disable-next-line no-console
  console.log(`[proxy] listening on :${cfg.port} → upstream=${cfg.upstream}`)
  // eslint-disable-next-line no-console
  console.log(
    `[proxy] error reporting ${
      isTelemetryEnabled() ? `on (${telemetry.environment})` : `off (${telemetry.disabledReason})`
    }`
  )
}
