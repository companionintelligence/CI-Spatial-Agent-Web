import { Hono } from 'hono'

import { resolveConfig } from '../config.js'
import { selectTtsUpstream } from '../upstreams/cosyvoice.js'
import { isTimedAdapter } from '../upstreams/headtts.js'

interface TtsBody {
  text?: string
  voice?: string
  format?: string
}

export const ttsRoutes = new Hono()

/**
 * POST /api/tts — provider-agnostic streaming text-to-speech.
 *
 * Accepts `{ text, voice?, format? }` and streams the synthesized audio back as
 * chunked binary (Content-Type matches the requested format, e.g. audio/mpeg).
 * Mirrors /api/chat: a runtime-configured upstream (CosyVoice2 by default), the
 * same anti-buffering headers so nginx forwards each audio chunk as it arrives,
 * and client-disconnect propagation to abort the upstream fetch (barge-in).
 */
ttsRoutes.post('/tts', async (c) => {
  let body: TtsBody
  try {
    body = await c.req.json<TtsBody>()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return c.json({ error: 'text is required' }, 400)
  }

  const cfg = resolveConfig()
  const adapter = selectTtsUpstream(cfg)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)
  // Propagate client disconnect (barge-in / nav away) to the upstream fetch.
  c.req.raw.signal.addEventListener('abort', () => controller.abort())

  let audio
  try {
    audio = await adapter.speak(
      { text, voice: body.voice, format: body.format },
      controller.signal
    )
  } catch (err) {
    clearTimeout(timeout)
    return c.json({ error: (err as Error).message ?? String(err) }, 502)
  }

  c.header('Content-Type', audio.contentType)
  c.header('Cache-Control', 'no-cache')
  c.header('X-Accel-Buffering', 'no')

  // Clear the request timeout once the stream drains (or aborts), so we neither
  // leak the timer nor kill a long-but-healthy synthesis mid-stream.
  const source = audio.body
  const monitored = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const reader = source.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          ctrl.enqueue(value)
        }
        ctrl.close()
      } catch (err) {
        ctrl.error(err)
      } finally {
        clearTimeout(timeout)
        reader.releaseLock()
      }
    },
    cancel(reason) {
      clearTimeout(timeout)
      controller.abort()
      return source.cancel(reason)
    }
  })

  return c.body(monitored)
})

/**
 * POST /api/tts/timed — synthesized audio WITH word and viseme timings.
 *
 * The whole point of this route is the timing channel: without it the browser is
 * left inferring mouth shapes from the spectrum, which cannot place a bilabial
 * closure or tell a /t/ from a /d/. With it, the client schedules real phonetic
 * shapes against the engine's own clock.
 *
 * Returns JSON rather than a stream because the timing-capable upstream is not
 * incremental — see upstreams/headtts.ts. Callers that only want bytes should
 * keep using the streaming POST /api/tts.
 *
 * 501 when the configured upstream cannot report timings, so the client can fall
 * back to the acoustic tier deliberately instead of guessing from a 404.
 */
ttsRoutes.post('/tts/timed', async (c) => {
  let body: TtsBody
  try {
    body = await c.req.json<TtsBody>()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return c.json({ error: 'text is required' }, 400)

  const cfg = resolveConfig()
  const adapter = selectTtsUpstream(cfg)
  if (!isTimedAdapter(adapter)) {
    return c.json(
      { error: `TTS upstream "${adapter.name}" does not report timings`, upstream: adapter.name },
      501
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)
  c.req.raw.signal.addEventListener('abort', () => controller.abort())

  try {
    const result = await adapter.speakTimed(
      { text, voice: body.voice, format: body.format },
      controller.signal
    )
    return c.json({
      audio: result.audioBase64,
      contentType: result.contentType,
      timings: result.timings
    })
  } catch (err) {
    return c.json({ error: (err as Error).message ?? String(err) }, 502)
  } finally {
    clearTimeout(timeout)
  }
})
