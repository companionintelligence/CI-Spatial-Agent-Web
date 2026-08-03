import { pathToFileURL } from 'node:url'

import { Hono } from 'hono'

import { resolveConfig } from './config.js'
import { chatRoutes } from './routes/chat.js'
import { healthRoutes } from './routes/health.js'
import { ttsRoutes } from './routes/tts.js'

/**
 * Build the BFF app. Exported so tests can drive the whole pipeline in-process
 * via `app.request(...)` without binding a socket.
 */
export function createApp(): Hono {
  const app = new Hono()
  app.route('/api', healthRoutes)
  app.route('/api', chatRoutes)
  app.route('/api', ttsRoutes)
  return app
}

// Start a listener only when executed directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const cfg = resolveConfig()
  const app = createApp()
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port: cfg.port })
  console.log(`[proxy] listening on :${cfg.port} → upstream=${cfg.upstream}`)
}
