import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { serve } from '@hono/node-server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/server.js'
import type { ChatEvent } from '../src/upstreams/types.js'

let ollamaServer: Server
let proxyServer: { close: (cb?: () => void) => void }
let proxyPort = 0
let mockMode: 'finite' | 'infinite' = 'finite'
let upstreamAborted = false

/** Read a real SSE response body into normalized ChatEvents. */
async function readSSE(res: Response): Promise<ChatEvent[]> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const events: ChatEvent[] = []
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      for (const line of frame.split('\n')) {
        const t = line.trim()
        if (t.startsWith('data:')) events.push(JSON.parse(t.slice(5).trim()))
      }
    }
  }
  return events
}

beforeAll(async () => {
  // Mock Ollama: streams NDJSON, deliberately splitting a token across two writes
  // within a single line to exercise cross-boundary buffering.
  ollamaServer = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      upstreamAborted = false
      res.on('close', () => {
        if (!res.writableEnded) upstreamAborted = true
      })
      res.writeHead(200, { 'content-type': 'application/x-ndjson' })
      res.write('{"message":{"content":"Hel')
      setTimeout(() => {
        if (res.writableEnded) return
        res.write('lo, "}}\n')
        res.write('{"message":{"content":"world"}}\n')
        if (mockMode === 'finite') {
          res.write('{"done":true}\n')
          res.end()
        }
        // 'infinite' mode keeps the connection open for the abort test.
      }, 30)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((resolve) => ollamaServer.listen(0, resolve))
  const ollamaPort = (ollamaServer.address() as AddressInfo).port

  process.env.APP_UPSTREAM = 'ollama'
  process.env.APP_OLLAMA_URL = `http://127.0.0.1:${ollamaPort}`

  await new Promise<void>((resolve) => {
    proxyServer = serve({ fetch: createApp().fetch, port: 0 }, (info: AddressInfo) => {
      proxyPort = info.port
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => proxyServer.close(() => resolve()))
  await new Promise<void>((resolve) => ollamaServer.close(() => resolve()))
  delete process.env.APP_OLLAMA_URL
  delete process.env.APP_UPSTREAM
})

describe('proxy streaming integration', () => {
  it('reassembles content across write boundaries and terminates on done', async () => {
    mockMode = 'finite'
    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
    })
    expect(res.status).toBe(200)
    const events = await readSSE(res)
    const content = events.filter((e) => e.type === 'chunk').map((e) => (e as { content: string }).content).join('')
    expect(content).toBe('Hello, world')
    expect(events.at(-1)).toEqual({ type: 'done' })
  })

  it('propagates a client abort to the upstream connection', async () => {
    mockMode = 'infinite'
    const ac = new AbortController()
    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: ac.signal
    })
    const reader = res.body!.getReader()
    await reader.read() // receive the first streamed bytes, proving the stream is live
    ac.abort()
    await vi.waitFor(() => expect(upstreamAborted).toBe(true), { timeout: 3000 })
  })
})
