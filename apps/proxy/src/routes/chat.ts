import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { resolveConfig } from '../config.js'
import { selectUpstream } from '../upstreams/index.js'
import type { ChatMessage } from '../upstreams/types.js'

interface ChatBody {
  messages?: ChatMessage[]
  model?: string
  stream?: boolean
}

export const chatRoutes = new Hono()

/**
 * POST /api/chat — provider-agnostic streaming chat.
 *
 * Streams normalized SSE events: {"type":"chunk","content"} … {"type":"done"}
 * (or {"type":"error","message"}). Anti-buffering headers are set so nginx and
 * the browser deliver each breath as it arrives.
 */
chatRoutes.post('/chat', async (c) => {
  let body: ChatBody
  try {
    body = await c.req.json<ChatBody>()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: 'messages[] is required' }, 400)
  }

  const cfg = resolveConfig()
  const adapter = selectUpstream(cfg)

  c.header('Cache-Control', 'no-cache')
  c.header('X-Accel-Buffering', 'no')

  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)
    // Propagate client disconnect (barge-in / nav away) to the upstream fetch.
    stream.onAbort(() => controller.abort())

    try {
      for await (const event of adapter.chat(
        { messages: body.messages as ChatMessage[], model: body.model },
        controller.signal
      )) {
        await stream.writeSSE({ data: JSON.stringify(event) })
        if (event.type === 'done' || event.type === 'error') break
      }
    } catch (err) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: (err as Error).message ?? String(err) })
      })
    } finally {
      clearTimeout(timeout)
    }
  })
})
