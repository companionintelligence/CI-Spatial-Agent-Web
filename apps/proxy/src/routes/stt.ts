import { Hono } from 'hono'

import { resolveConfig } from '../config.js'
import { selectSttUpstream } from '../upstreams/whisper.js'

export const sttRoutes = new Hono()

/**
 * POST /api/stt — transcribe an utterance locally.
 *
 * Body is raw 32-bit float PCM (what the browser VAD already captures and, until
 * now, threw away) with the sample rate in the query string. Raw bytes rather
 * than multipart because the client has a plain ArrayBuffer and the appliance is
 * same-origin — building a multipart body in the browser to have the proxy take
 * it apart again buys nothing.
 *
 * This is what makes voice input work in Firefox and XR browsers, and stops the
 * microphone being streamed to Google by `webkitSpeechRecognition`.
 */
sttRoutes.post('/stt', async (c) => {
  const sampleRate = Number(c.req.query('sampleRate') ?? '16000')
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    return c.json({ error: 'sampleRate query parameter is required and must be plausible' }, 400)
  }

  const audio = await c.req.arrayBuffer()
  if (!audio || audio.byteLength < 4) {
    return c.json({ error: 'audio body is required' }, 400)
  }

  const cfg = resolveConfig()
  const adapter = selectSttUpstream(cfg)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)
  c.req.raw.signal.addEventListener('abort', () => controller.abort())

  try {
    const result = await adapter.transcribe(
      { audio, sampleRate, language: c.req.query('language') },
      controller.signal
    )
    return c.json({ text: result.text, upstream: adapter.name })
  } catch (err) {
    return c.json({ error: (err as Error).message ?? String(err) }, 502)
  } finally {
    clearTimeout(timeout)
  }
})
