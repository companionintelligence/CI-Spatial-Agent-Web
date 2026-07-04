import { Hono } from 'hono'

import { resolveConfig } from '../config.js'
import { selectTtsUpstream } from '../upstreams/cosyvoice.js'
import { selectUpstream } from '../upstreams/index.js'

export const healthRoutes = new Hono()

/**
 * GET /api/health — reports the resolved chat upstream, default model, a
 * reachability probe (surfaces host.docker.internal DNS/connectivity problems),
 * and a nested `tts` block for the TTS upstream (voice model + reachability).
 */
healthRoutes.get('/health', async (c) => {
  const cfg = resolveConfig()
  const adapter = selectUpstream(cfg)
  const probe = await adapter.health()
  const model = cfg.upstream === 'openai' ? cfg.openaiModel : cfg.ollamaModel

  const ttsAdapter = selectTtsUpstream(cfg)
  const ttsProbe = await ttsAdapter.health()

  return c.json({
    status: 'ok',
    upstream: adapter.name,
    model,
    reachable: probe.ok,
    detail: probe.detail,
    tts: {
      upstream: ttsAdapter.name,
      model: cfg.ttsModel,
      voice: cfg.ttsVoice,
      reachable: ttsProbe.ok,
      detail: ttsProbe.detail
    }
  })
})
