import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Barge-in / interruption coverage for the TTS queue.
 *
 *  - C1: after a barge-in (stopSpeaking) clears the queue mid-playback, a fresh
 *        speak() must still play. The regression was that the interrupted audio's
 *        completion handler resumed and clobbered `nextExpectedId`, so every later
 *        message id stopped matching and all speech went silent.
 *  - H4: stopSpeaking must stop the AudioBufferSourceNode that is actually playing,
 *        not merely empty the queue.
 *
 * These exercise the real hook against a mocked Web Audio + fetch surface. Because
 * the queue keys on a module-global id counter, each test re-imports the module so
 * the counter starts from 0 and a freshly-mounted hook's cursor lines up.
 */

// ---- Web Audio mock -------------------------------------------------------

class MockGainNode {
  gain = { value: 0 }
  connect() {}
  disconnect() {}
}

class MockAudioBufferSourceNode {
  buffer: unknown = null
  onended: (() => void) | null = null
  started = false
  stopped = false
  connect() {}
  disconnect() {}
  start() {
    this.started = true
    MockAudioContext.startedSources.push(this)
  }
  stop() {
    // Browser semantics: a second stop() throws; stopping fires 'ended'.
    if (this.stopped) throw new Error('cannot stop twice')
    this.stopped = true
    this.onended?.()
  }
}

class MockAudioContext {
  static startedSources: MockAudioBufferSourceNode[] = []
  destination = {}
  createGain() {
    return new MockGainNode()
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode()
  }
  decodeAudioData(_buffer: ArrayBuffer) {
    return Promise.resolve({} as AudioBuffer)
  }
  close() {
    return Promise.resolve()
  }
}

// Drain all pending microtasks by crossing a macrotask boundary.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const spokenTexts = (fn: ReturnType<typeof vi.fn>): string[] => fn.mock.calls.map((call) => call[0] as string)

let useTTSService: typeof import('./ttsService').useTTSService

beforeEach(async () => {
  MockAudioContext.startedSources = []
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(8)
  })) as unknown as typeof fetch

  // Fresh module → module-global id counter resets to 0.
  vi.resetModules()
  ;({ useTTSService } = await import('./ttsService'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TTS barge-in', () => {
  it('H4: stopSpeaking stops the audio source that is currently playing', async () => {
    const { result } = renderHook(() => useTTSService({ config: { mode: 'remote' } }))

    await act(async () => {
      await result.current.actions.speak('hello there friend')
    })
    await flush()

    const source = MockAudioContext.startedSources[0]
    expect(source).toBeTruthy()
    expect(source.started).toBe(true)
    expect(source.stopped).toBe(false)

    await act(async () => {
      result.current.actions.stopSpeaking()
    })

    // The in-flight utterance is actually cut off, not just dequeued.
    expect(source.stopped).toBe(true)
  })

  it('C1: a stop() mid-playback then a new speak() still plays', async () => {
    const onSpeechStart = vi.fn()
    const { result } = renderHook(() =>
      useTTSService({ config: { mode: 'remote' }, onSpeechStart })
    )

    // Enqueue several utterances; remote mode plays them one at a time, so only the
    // first reaches playback while the others wait behind it.
    await act(async () => {
      await result.current.actions.speak('one')
      await result.current.actions.speak('two')
      await result.current.actions.speak('three')
    })
    await flush()

    expect(spokenTexts(onSpeechStart)).toContain('one')
    const firstSource = MockAudioContext.startedSources[0]
    expect(firstSource).toBeTruthy()

    // Barge-in: clear the queue while the first utterance is still playing.
    await act(async () => {
      result.current.actions.stopSpeaking()
    })
    await flush()

    // Simulate the interrupted audio finishing *after* the barge-in. On the buggy
    // code this is exactly when the stale loop advanced nextExpectedId to a value
    // no future message id could match.
    await act(async () => {
      firstSource.onended?.()
    })
    await flush()

    // A brand-new utterance enqueued after the barge-in must play.
    await act(async () => {
      await result.current.actions.speak('four')
    })
    await flush()

    expect(spokenTexts(onSpeechStart)).toContain('four')
  })
})
