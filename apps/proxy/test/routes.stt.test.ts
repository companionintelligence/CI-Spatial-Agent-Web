import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/server.js'
import { pcmToWav } from '../src/upstreams/whisper.js'

const pcm = (n = 16) => new Float32Array(n).fill(0.25).buffer

const post = (body: ArrayBuffer, query = '?sampleRate=16000') =>
  createApp().request(`/api/stt${query}`, { method: 'POST', body })

afterEach(() => vi.restoreAllMocks())

describe('pcmToWav', () => {
  it('writes a RIFF/WAVE header a Whisper server can decode', () => {
    // Posting raw floats gets a 400 that says nothing about why; the container
    // is the difference between working and an opaque rejection.
    const wav = pcmToWav(pcm(4), 16000)
    const text = new TextDecoder().decode(wav.slice(0, 4))
    expect(text).toBe('RIFF')
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe('WAVE')
  })

  it('declares IEEE float, mono, at the given rate', () => {
    const wav = pcmToWav(pcm(4), 24000)
    const view = new DataView(wav.buffer)
    expect(view.getUint16(20, true)).toBe(3) // format 3 = float
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(24000)
  })

  it('sizes the data chunk to the sample count', () => {
    const wav = pcmToWav(pcm(10), 16000)
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(40)
    expect(wav.byteLength).toBe(44 + 40)
  })
})

describe('POST /api/stt', () => {
  it('rejects a missing body', async () => {
    expect((await post(new ArrayBuffer(0))).status).toBe(400)
  })

  it('rejects an implausible sample rate', async () => {
    expect((await post(pcm(), '?sampleRate=12')).status).toBe(400)
  })

  it('returns the transcript from the upstream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ text: '  hello there  ' }), { status: 200 }))
    )
    const res = await post(pcm())
    expect(res.status).toBe(200)
    expect((await res.json()) as { text: string }).toMatchObject({ text: 'hello there' })
  })

  it('posts a decodable WAV, not raw floats', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: 'x' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await post(pcm())
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const form = init.body as FormData
    const file = form.get('file') as File
    expect(file).toBeTruthy()
    expect(new TextDecoder().decode((await file.arrayBuffer()).slice(0, 4))).toBe('RIFF')
  })

  it('surfaces an unreachable upstream as 502 rather than hanging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    expect((await post(pcm())).status).toBe(502)
  })
})
