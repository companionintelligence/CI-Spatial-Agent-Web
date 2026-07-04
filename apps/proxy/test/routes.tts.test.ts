import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/server.js'

/** A fake streaming audio Response, as a CosyVoice2 upstream would return. */
function audioResponse(chunks: string[], contentType = 'audio/mpeg', status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    }
  })
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

afterEach(() => vi.restoreAllMocks())

describe('POST /api/tts', () => {
  it('returns 400 for empty text', async () => {
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' })
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing text field', async () => {
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voice: 'alba' })
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    })
    expect(res.status).toBe(400)
  })

  it('streams audio with the right content-type and anti-buffering headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => audioResponse(['RIFF', 'audio', 'bytes'])))
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' })
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('audio/mpeg')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(buf)).toBe('RIFFaudiobytes')
  })

  it('selects the CosyVoice2 upstream (POSTs /v1/audio/speech with the OpenAI payload)', async () => {
    const fetchMock = vi.fn(async () => audioResponse(['ok']))
    vi.stubGlobal('fetch', fetchMock)
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'speak this', voice: 'javert' })
    })
    expect(res.status).toBe(200)
    await res.arrayBuffer()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('http://host.docker.internal:8880/v1/audio/speech')
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({ input: 'speak this', voice: 'javert', stream: true })
  })

  it('returns 502 when the upstream is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))
    const app = createApp()
    const res = await app.request('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello' })
    })
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('cosyvoice')
  })
})
