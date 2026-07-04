import { describe, expect, it } from 'vitest'

import { LipsyncEn } from './lipsync/lipsyncEn'
import { lipsyncConvert } from './lipsync/lipsyncQueue'

const en = new LipsyncEn()

describe('LipsyncEn.wordsToVisemes — grapheme → Oculus viseme mapping', () => {
  it('maps a canonical word to its expected viseme sequence', () => {
    const r = en.wordsToVisemes('hello')
    expect(r).not.toBeNull()
    expect(r!.visemes).toEqual(['I', 'E', 'nn', 'O'])
  })

  it('emits a bilabial PP viseme for a leading "p"', () => {
    const r = en.wordsToVisemes('papa')
    expect(r!.visemes).toEqual(['PP', 'aa', 'PP', 'aa'])
  })

  it('assigns non-negative, monotonically non-decreasing start times', () => {
    const r = en.wordsToVisemes('hello')!
    for (let i = 1; i < r.times.length; i++) {
      expect(r.times[i]).toBeGreaterThanOrEqual(r.times[i - 1])
    }
    expect(r.times[0]).toBe(0)
    // Every viseme has a positive relative duration.
    expect(r.durations.every((d) => d > 0)).toBe(true)
  })

  it('returns null for empty input rather than throwing', () => {
    expect(en.wordsToVisemes('')).toBeNull()
  })

  it('returns null for input with no pronounceable letters', () => {
    expect(en.wordsToVisemes('!!!')).toBeNull()
  })

  it('uppercases and preprocesses before matching rules', () => {
    // Case must not change the resulting visemes.
    expect(en.wordsToVisemes('HELLO')!.visemes).toEqual(en.wordsToVisemes('hello')!.visemes)
  })
})

describe('lipsyncConvert — WhisperData timing → sequence', () => {
  it('builds one anim item per viseme with prefixed viseme keys', () => {
    const result = lipsyncConvert({ words: ['hello'], wtimes: [0], wdurations: [500] }, 'en')
    expect(result.anim).toBeDefined()
    expect(result.anim).toHaveLength(4)

    const first = result.anim![0]
    // Keys are namespaced as `viseme_<name>` (GLB convention).
    expect(Object.keys(first.vs)[0]).toMatch(/^viseme_/)
    // ts is [start, peak, end]; start precedes end.
    expect(first.ts[0]).toBeLessThan(first.ts[2])
  })

  it('orders successive words by their whisper start time', () => {
    const result = lipsyncConvert(
      { words: ['hello', 'papa'], wtimes: [0, 1000], wdurations: [500, 500] },
      'en'
    )
    expect(result.anim!.length).toBeGreaterThan(4)
    // The second word's items begin no earlier than the first word's.
    const firstWordEnd = result.anim![3].ts[0]
    const lastItem = result.anim![result.anim!.length - 1]
    expect(lastItem.ts[0]).toBeGreaterThan(firstWordEnd)
  })

  it('returns an object with no anim when whisper fields are absent', () => {
    expect(lipsyncConvert({ words: ['hi'] }, 'en').anim).toBeUndefined()
  })

  it('skips empty words in the sequence without throwing', () => {
    const result = lipsyncConvert({ words: ['', 'hello'], wtimes: [0, 10], wdurations: [0, 500] }, 'en')
    expect(result.anim).toHaveLength(4) // only "hello" contributed.
  })
})
