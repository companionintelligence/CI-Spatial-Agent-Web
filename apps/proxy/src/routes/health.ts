import { Hono } from 'hono'

import { resolveConfig } from '../config.js'
import { selectUpstream } from '../upstreams/index.js'

export const healthRoutes = new Hono()

/**
 * GET /api/health — reports the resolved upstream, default model, and a
 * reachability probe (surfaces host.docker.internal DNS/connectivity problems).
 */
healthRoutes.get('/health', async (c) => {
  const cfg = resolveConfig()
  const adapter = selectUpstream(cfg)
  const probe = await adapter.health()
  const model = cfg.upstream === 'openai' ? cfg.openaiModel : cfg.ollamaModel

  return c.json({
    status: 'ok',
    upstream: adapter.name,
    model,
    reachable: probe.ok,
    detail: probe.detail
  })
})
