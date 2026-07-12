import { describe, expect, it, vi } from 'vitest'

import { readLatestInterrupt } from './llmInterrupt'
import { llmOllama } from './models/llmOllama'

/**
 * Cross-turn cancellation. The stale-work guard in every adapter must observe the
 * *live* newest interrupt, not a copy captured when the turn started — otherwise a
 * new user turn can't stop the previous turn's in-flight stream (its breath
 * fragments keep calling tts.speak()).
 */

// Streaming Ollama stub: two full "breath" fragments then a done marker.
vi.mock('ollama/browser', () => ({
  Ollama: class {
    async chat() {
      return (async function* () {
        yield { message: { content: 'This is the first breath fragment. ' }, done: false }
        yield { message: { content: 'This is the second breath fragment. ' }, done: false }
        yield { message: { content: '' }, done: true }
      })()
    }
  }
}))

describe('readLatestInterrupt', () => {
  it('passes a fixed number through unchanged', () => {
    expect(readLatestInterrupt(42)).toBe(42)
  })

  it('invokes a getter so callers always see the newest value', () => {
    let current = 1
    const getter = () => current
    expect(readLatestInterrupt(getter)).toBe(1)
    current = 9
    expect(readLatestInterrupt(getter)).toBe(9)
  })
})

describe('llmOllama live-interrupt guard', () => {
  it('keeps speaking while its turn is still the newest', async () => {
    const responseCallback = vi.fn()
    const newest = 100

    await llmOllama({
      userMessage: 'hi',
      interrupt: 100,
      messages: [],
      latestInterrupt: () => newest, // live getter, still this turn
      llmUrl: 'http://localhost:11434',
      llmModel: 'llama3.2',
      responseCallback
    })

    expect(responseCallback).toHaveBeenCalled()
  })

  it('stops emitting breath fragments once a newer turn supersedes it', async () => {
    const responseCallback = vi.fn()
    // A new user turn (200) has already superseded this stream's turn (100).
    const newest = 200

    await llmOllama({
      userMessage: 'hi',
      interrupt: 100,
      messages: [],
      latestInterrupt: () => newest, // live getter reports the newer turn
      llmUrl: 'http://localhost:11434',
      llmModel: 'llama3.2',
      responseCallback
    })

    // The guard fires on the live value, so nothing is spoken for the stale turn.
    expect(responseCallback).not.toHaveBeenCalled()
  })
})
