import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { createOllamaAdapter } from '../src/upstreams/ollama.js'
import type { ChatEvent } from '../src/upstreams/types.js'

function streamResponse(chunks: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    }
  })
  return new Response(body, { status, headers: { 'content-type': 'application/x-ndjson' } })
}

async function collect(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

afterEach(() => vi.restoreAllMocks())

describe('ollama adapter', () => {
  it('maps NDJSON message/content and done into normalized events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          JSON.stringify({ message: { content: 'Hel' } }) + '\n',
          JSON.stringify({ message: { content: 'lo' } }) + '\n',
          JSON.stringify({ done: true }) + '\n'
        ])
      )
    )
    const adapter = createOllamaAdapter(resolveConfig({}))
    const events = await collect(adapter.chat({ messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal))
    expect(events).toEqual([
      { type: 'chunk', content: 'Hel' },
      { type: 'chunk', content: 'lo' },
      { type: 'done' }
    ])
  })

  it('skips malformed lines instead of aborting the stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'garbage not json\n',
          JSON.stringify({ message: { content: 'ok' } }) + '\n',
          JSON.stringify({ done: true }) + '\n'
        ])
      )
    )
    const adapter = createOllamaAdapter(resolveConfig({}))
    const events = await collect(adapter.chat({ messages: [] }, new AbortController().signal))
    expect(events.filter((e) => e.type === 'chunk')).toEqual([{ type: 'chunk', content: 'ok' }])
  })

  it('yields a normalized error on a non-ok upstream response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })))
    const adapter = createOllamaAdapter(resolveConfig({}))
    const events = await collect(adapter.chat({ messages: [] }, new AbortController().signal))
    expect(events[0].type).toBe('error')
  })
})
