import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { createOpenAIAdapter } from '../src/upstreams/openaiCompat.js'
import type { ChatEvent } from '../src/upstreams/types.js'

function sseResponse(lines: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const l of lines) controller.enqueue(enc.encode(l))
      controller.close()
    }
  })
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

async function collect(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

const cfg = () => resolveConfig({ APP_UPSTREAM: 'openai', APP_OPENAI_API_KEY: 'sk-test' })

afterEach(() => vi.restoreAllMocks())

describe('openai-compatible adapter', () => {
  it('maps SSE delta content and [DONE] into normalized events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] }) + '\n\n',
          'data: ' + JSON.stringify({ choices: [{ delta: { content: ' there' } }] }) + '\n\n',
          'data: [DONE]\n\n'
        ])
      )
    )
    const events = await collect(createOpenAIAdapter(cfg()).chat({ messages: [] }, new AbortController().signal))
    expect(events).toEqual([
      { type: 'chunk', content: 'Hi' },
      { type: 'chunk', content: ' there' },
      { type: 'done' }
    ])
  })

  it('ignores non-data and empty lines', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          ': keepalive\n\n',
          'data: ' + JSON.stringify({ choices: [{ delta: {} }] }) + '\n\n',
          'data: ' + JSON.stringify({ choices: [{ delta: { content: 'x' } }] }) + '\n\n',
          'data: [DONE]\n\n'
        ])
      )
    )
    const events = await collect(createOpenAIAdapter(cfg()).chat({ messages: [] }, new AbortController().signal))
    expect(events.filter((e) => e.type === 'chunk')).toEqual([{ type: 'chunk', content: 'x' }])
  })
})
