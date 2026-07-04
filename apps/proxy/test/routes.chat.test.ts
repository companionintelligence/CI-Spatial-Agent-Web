import { describe, expect, it } from 'vitest'

import { createApp } from '../src/server.js'

describe('POST /api/chat', () => {
  it('returns 400 for an empty message list', async () => {
    const app = createApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] })
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const app = createApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    })
    expect(res.status).toBe(400)
  })

  it('streams SSE with anti-buffering headers for a valid body', async () => {
    const app = createApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    // The default upstream (host.docker.internal) is unreachable in CI, so the
    // stream should still be well-formed and surface a normalized error event.
    const text = await res.text()
    expect(text).toContain('data:')
    expect(text).toMatch(/"type":"(error|done)"/)
  })
})

describe('GET /api/health', () => {
  it('reports the resolved upstream and default model', async () => {
    const app = createApp()
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { upstream: string; model: string; reachable: boolean }
    expect(body.upstream).toBe('ollama')
    expect(body.model).toBe('gemma3:1b')
    expect(body).toHaveProperty('reachable')
  })
})
