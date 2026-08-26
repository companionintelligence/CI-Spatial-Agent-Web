import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { __resetMemoryCache, createCiServerAdapter } from '../src/upstreams/ciServer.js'

const cfg = () =>
  resolveConfig({
    APP_UPSTREAM: 'ci-server',
    APP_CISERVER_URL: 'http://ci-server:3000',
    APP_CI_SERVER_API_KEY: 'k',
    APP_OLLAMA_URL: 'http://ollama:11434'
  })

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

/** One NDJSON chunk, as the Ollama generation upstream streams. */
const ollamaStream = (text: string) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: text }, done: false }) + '\n'))
        c.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: '' }, done: true }) + '\n'))
        c.close()
      }
    }),
    { status: 200 }
  )

async function drain(adapter: ReturnType<typeof createCiServerAdapter>, signal = new AbortController().signal) {
  const events = []
  for await (const e of adapter.chat({ messages: [{ role: 'user', content: 'where is my cup' }] }, signal)) {
    events.push(e)
  }
  return events
}

beforeEach(() => __resetMemoryCache())
afterEach(() => vi.restoreAllMocks())

describe('ci-server memory adapter', () => {
  it('recalls context, augments the prompt, and streams the generated reply', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url))
        if (String(url).endsWith('/memory/context')) return json({ block: 'The user is Liam.' })
        if (String(url).endsWith('/memory/recall')) return json({ block: 'Cup: on the desk.', resultCount: 1 })
        if (String(url).endsWith('/memory/turn')) return json({ created: 2 })
        return ollamaStream('On your desk.')
      })
    )

    const events = await drain(createCiServerAdapter(cfg()))
    expect(events.some((e) => e.type === 'chunk' && e.content.includes('On your desk'))).toBe(true)
    expect(calls.some((u) => u.endsWith('/memory/context'))).toBe(true)
    expect(calls.some((u) => u.endsWith('/memory/recall'))).toBe(true)
    expect(calls.some((u) => u.endsWith('/memory/turn'))).toBe(true)
  })

  it('injects both memory blocks ahead of the conversation', async () => {
    let generationBody = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).endsWith('/memory/context')) return json({ block: 'PROFILE' })
        if (String(url).endsWith('/memory/recall')) return json({ block: 'RECALLED' })
        if (String(url).endsWith('/memory/turn')) return json({})
        generationBody = String(init?.body ?? '')
        return ollamaStream('ok')
      })
    )
    await drain(createCiServerAdapter(cfg()))
    expect(generationBody).toContain('PROFILE')
    expect(generationBody).toContain('RECALLED')
  })

  it('still answers when memory is unreachable', async () => {
    // Memory is an ENHANCEMENT. A companion that answers without its notes beats
    // one that refuses to answer because the notes are down.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/memory/')) throw new Error('ECONNREFUSED')
        return ollamaStream('I can still talk.')
      })
    )
    const events = await drain(createCiServerAdapter(cfg()))
    expect(events.some((e) => e.type === 'chunk' && e.content.includes('still talk'))).toBe(true)
  })

  it('tolerates a memory endpoint returning an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/memory/')) return json({ error: 'nope' }, 500)
        return ollamaStream('fine')
      })
    )
    expect((await drain(createCiServerAdapter(cfg()))).some((e) => e.type === 'chunk')).toBe(true)
  })

  it('caches the profile block instead of refetching it every turn', async () => {
    // L0 describes the USER, not the turn. Refetching per turn would add a round
    // trip to every reply for data that does not change.
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/memory/context')) return json({ block: 'PROFILE' })
      if (String(url).includes('/memory/')) return json({ block: '' })
      return ollamaStream('ok')
    })
    vi.stubGlobal('fetch', fetchMock)
    const adapter = createCiServerAdapter(cfg())
    await drain(adapter)
    await drain(adapter)
    const contextCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/memory/context'))
    expect(contextCalls).toHaveLength(1)
  })

  it('does not persist a barged-in turn', async () => {
    // Persisting half a sentence would teach the companion things it never said.
    const controller = new AbortController()
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/memory/')) return json({ block: '' })
      controller.abort()
      return ollamaStream('interrupted')
    })
    vi.stubGlobal('fetch', fetchMock)
    await drain(createCiServerAdapter(cfg()), controller.signal).catch(() => undefined)
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/memory/turn'))).toBe(false)
  })

  it('reports health from the CI-Server probe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
    expect(await createCiServerAdapter(cfg()).health()).toMatchObject({ ok: true })
  })
})
