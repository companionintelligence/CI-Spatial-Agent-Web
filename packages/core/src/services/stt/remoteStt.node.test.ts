import { afterEach, describe, expect, it, vi } from 'vitest'

import { transcribeRemote } from './remoteStt'

afterEach(() => vi.restoreAllMocks())

const audio = new Float32Array(8).fill(0.1).buffer

describe('transcribeRemote', () => {
  it('posts the raw PCM with the sample rate in the query', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: 'hi' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeRemote(audio, 16000)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('sampleRate=16000')
    expect(init.body).toBe(audio)
    expect(result).toEqual({ ok: true, text: 'hi' })
  })

  it('passes a language when given one', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: '' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await transcribeRemote(audio, 16000, { language: 'en' })
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain('language=en')
  })

  it('reports a non-ok response without throwing', async () => {
    // A failing transcription must degrade to "no transcript", never take down
    // the turn — the user can repeat themselves; a crash loses the session.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })))
    expect(await transcribeRemote(audio, 16000)).toMatchObject({ ok: false, text: '' })
  })

  it('reports a transport failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await transcribeRemote(audio, 16000)).toMatchObject({ ok: false, error: 'offline' })
  })

  it('trims the transcript', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: '  spaced  ' }), { status: 200 })))
    expect((await transcribeRemote(audio, 16000)).text).toBe('spaced')
  })
})
