import { describe, it, expect } from 'vitest'
import { collectRecognitionResults } from './sttService'

/**
 * Regression guard for the continuous-recognition bug: the onresult loop was bounded by
 * `i < 1`, so once `resultIndex` advanced past 0 (every segment after the first in a
 * continuous session) the handler processed nothing and the speech was silently dropped.
 * `collectRecognitionResults` must return one entry per result from `resultIndex` to the end.
 */

// Minimal duck-typed SpeechRecognitionEvent — one alternative per result, plus isFinal.
function makeEvent(resultIndex: number, results: Array<{ transcript: string; isFinal: boolean; confidence?: number }>) {
  const list = results.map((r) => ({ 0: { transcript: r.transcript, confidence: r.confidence }, isFinal: r.isFinal, length: 1 }))
  return { resultIndex, results: Object.assign(list, { length: list.length }) } as any
}

describe('collectRecognitionResults', () => {
  it('returns the single interim result at the start of an utterance', () => {
    const out = collectRecognitionResults(makeEvent(0, [{ transcript: 'hello', isFinal: false }]))
    expect(out).toEqual([{ text: 'hello', final: false, confidence: 1 }])
  })

  it('processes a later finalized segment (resultIndex > 0) — the regression', () => {
    // A continuous session: results[0] already finalized earlier; this event delivers
    // results[1] as newly final. The old `i < 1` bound dropped this entirely.
    const event = makeEvent(1, [
      { transcript: 'first sentence', isFinal: true },
      { transcript: 'second sentence', isFinal: true, confidence: 0.9 }
    ])
    const out = collectRecognitionResults(event)
    expect(out).toEqual([{ text: 'second sentence', final: true, confidence: 0.9 }])
  })

  it('collects ALL new results when several arrive in one event', () => {
    const event = makeEvent(0, [
      { transcript: ' one ', isFinal: true },
      { transcript: 'two', isFinal: true },
      { transcript: 'thr', isFinal: false }
    ])
    const out = collectRecognitionResults(event)
    expect(out.map((r) => r.text)).toEqual(['one', 'two', 'thr'])
    expect(out.map((r) => r.final)).toEqual([true, true, false])
  })

  it('trims whitespace and defaults missing confidence to 1', () => {
    const out = collectRecognitionResults(makeEvent(0, [{ transcript: '  spaced  ', isFinal: true }]))
    expect(out[0]).toEqual({ text: 'spaced', final: true, confidence: 1 })
  })

  it('returns empty when resultIndex is past the end', () => {
    expect(collectRecognitionResults(makeEvent(2, [{ transcript: 'x', isFinal: true }]))).toEqual([])
  })
})
