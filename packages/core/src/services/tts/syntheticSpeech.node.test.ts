import { describe, expect, it } from 'vitest'

import { createSyntheticSpeechWav, syntheticSpeechDuration } from './syntheticSpeech'

describe('synthetic speech render probe', () => {
  it('creates a valid mono PCM WAV with deterministic voiced samples', () => {
    const first = createSyntheticSpeechWav('Hello render probe')
    const second = createSyntheticSpeechWav('Hello render probe')
    const bytes = new Uint8Array(first)

    expect(first.byteLength).toBeGreaterThan(44)
    expect(Array.from(bytes.slice(0, 4))).toEqual([82, 73, 70, 70])
    expect(Array.from(bytes.slice(8, 12))).toEqual([87, 65, 86, 69])
    expect(new Uint8Array(first)).toEqual(new Uint8Array(second))

    const pcm = new Int16Array(first.slice(44))
    expect(pcm.some((sample) => sample !== 0)).toBe(true)
    expect(Math.max(...pcm)).toBeGreaterThan(1000)
    expect(Math.min(...pcm)).toBeLessThan(-1000)
  })

  it('keeps the render probe bounded and scales duration with text', () => {
    expect(syntheticSpeechDuration('')).toBe(0.7)
    expect(syntheticSpeechDuration('a'.repeat(500))).toBe(12)

    const short = createSyntheticSpeechWav('short', { sampleRate: 8000, duration: 1 })
    const long = createSyntheticSpeechWav('long', { sampleRate: 8000, duration: 2 })
    expect(short.byteLength).toBe(44 + 8000 * 2)
    expect(long.byteLength).toBe(44 + 16000 * 2)
  })
})
