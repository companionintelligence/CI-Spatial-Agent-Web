import { describe, expect, it } from 'vitest'

import { BoundaryTimeline } from './BoundaryTimeline'

const TEXT = 'hello there friend'

describe('BoundaryTimeline', () => {
  it('starts empty', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    expect(t.toWordTimings().words).toEqual([])
  })

  it('records words with the engine’s own elapsed times', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 0)
    t.addBoundary(6, 400)
    t.addBoundary(12, 900)
    const { words, wtimes } = t.toWordTimings()
    expect(words).toEqual(['hello', 'there', 'friend'])
    expect(wtimes).toEqual([0, 400, 900])
  })

  it('corrects the previous word to end where the next one starts', () => {
    // The provisional duration for "hello" is a guess; the next boundary is fact.
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 0)
    expect(t.toWordTimings().wdurations[0]).not.toBe(400)
    t.addBoundary(6, 400)
    expect(t.toWordTimings().wdurations[0]).toBe(400)
  })

  it('closes the final word against the real utterance end', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 0)
    t.addBoundary(6, 400)
    t.finish(1100)
    expect(t.toWordTimings().wdurations[1]).toBe(700)
  })

  it('uses charLength when the engine supplies it', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 0, 5)
    expect(t.toWordTimings().words).toEqual(['hello'])
  })

  it('recovers the word when charIndex points at the whitespace before it', () => {
    // Engines disagree here; a one-character shift would make every shape wrong.
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(5, 400)
    expect(t.toWordTimings().words).toEqual(['there'])
  })

  it('ignores out-of-range and non-finite boundaries', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(-1, 0)
    t.addBoundary(999, 0)
    t.addBoundary(0, Number.NaN)
    expect(t.length).toBe(0)
  })

  it('never lets a correction make a duration negative', () => {
    // Some engines emit a boundary with a lower elapsedTime than the previous one.
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 500)
    t.addBoundary(6, 100)
    expect(t.toWordTimings().wdurations.every((d) => d > 0)).toBe(true)
  })

  it('reads Chromium millisecond timings as-is', () => {
    // Measured on macOS Chromium: "hello there my good friend" reported
    // boundaries at 870 / 1136 / 1307 / 1488 / 1701 with a 2352 end.
    const t = new BoundaryTimeline()
    t.reset('hello there my good friend')
    t.addBoundary(0, 870, 5)
    t.addBoundary(6, 1136, 5)
    t.finish(2352)
    const { wtimes, wdurations } = t.toWordTimings()
    expect(wtimes).toEqual([870, 1136])
    expect(wdurations[1]).toBeCloseTo(1216)
  })

  it('scales a spec-compliant seconds engine up to milliseconds', () => {
    // Firefox follows the spec and reports seconds. The same utterance would be
    // 0.870 / 1.136 / 2.352 — indistinguishable per-event, obvious in aggregate.
    const t = new BoundaryTimeline()
    t.reset('hello there my good friend')
    t.addBoundary(0, 0.87, 5)
    t.addBoundary(6, 1.136, 5)
    t.finish(2.352)
    const { wtimes, wdurations } = t.toWordTimings()
    expect(wtimes[0]).toBeCloseTo(870)
    expect(wtimes[1]).toBeCloseTo(1136)
    expect(wdurations[1]).toBeCloseTo(1216)
  })

  it('keeps the engine’s start-up latency instead of assuming speech starts at zero', () => {
    // Chromium does not begin speaking for ~870 ms after speak(). The mouth must
    // stay shut for that gap; the old estimator started the jaw moving instantly.
    const t = new BoundaryTimeline()
    t.reset('hello there my good friend')
    t.addBoundary(0, 870, 5)
    expect(t.toWordTimings().wtimes[0]).toBe(870)
  })

  it('reset clears a previous utterance', () => {
    const t = new BoundaryTimeline()
    t.reset(TEXT)
    t.addBoundary(0, 0)
    t.reset('new text')
    expect(t.length).toBe(0)
  })
})
