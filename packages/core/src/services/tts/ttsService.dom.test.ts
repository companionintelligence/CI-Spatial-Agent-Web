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

// ---- speechSynthesis mock -------------------------------------------------
// jsdom implements neither speechSynthesis nor SpeechSynthesisUtterance, and the
// browser TTS mode is now the default, so the suite has to supply both.

class MockSpeechSynthesisUtterance {
  text: string
  rate = 1
  pitch = 1
  volume = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

class MockSpeechSynthesis {
  static spoken: MockSpeechSynthesisUtterance[] = []
  static cancelled = 0
  getVoices() {
    return []
  }
  speak(utterance: MockSpeechSynthesisUtterance) {
    MockSpeechSynthesis.spoken.push(utterance)
    // Real engines fire 'end' asynchronously; the queue loop awaits it.
    setTimeout(() => utterance.onend?.(), 0)
  }
  cancel() {
    MockSpeechSynthesis.cancelled++
  }
}

const utteredTexts = (): string[] => MockSpeechSynthesis.spoken.map((u) => u.text)

// Drain all pending microtasks by crossing a macrotask boundary.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

// The pocket/local queue loop re-checks a still-generating message on a 100ms
// timer, so a single macrotask hop is not enough to observe the outcome.
async function flushFor(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

const spokenTexts = (fn: ReturnType<typeof vi.fn>): string[] => fn.mock.calls.map((call) => call[0] as string)

let useTTSService: typeof import('./ttsService').useTTSService

beforeEach(async () => {
  MockAudioContext.startedSources = []
  MockSpeechSynthesis.spoken = []
  MockSpeechSynthesis.cancelled = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext
  globalThis.speechSynthesis = new MockSpeechSynthesis() as unknown as SpeechSynthesis
  globalThis.SpeechSynthesisUtterance =
    MockSpeechSynthesisUtterance as unknown as typeof SpeechSynthesisUtterance
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

/**
 * A default install must be able to speak.
 *
 * The default mode used to be 'pocket', pointed at http://localhost:8000 — a
 * server this app does not ship and the published image does not contain. So the
 * out-of-the-box product was silent while its own intro caption called it "an AI
 * with a face, a voice and a body". The default is now the browser's own
 * speechSynthesis, which requires nothing to be installed.
 */
describe('TTS default is audible', () => {
  it('defaults to browser speechSynthesis, not a server that may not exist', async () => {
    const { defaultTTSConfig } = await import('./ttsConfig')
    expect(defaultTTSConfig.mode).toBe('browser')
  })

  it('speaks on the default config with no backend of any kind reachable', async () => {
    // Any network call at all would be a bug on this path: prove it by failing them.
    globalThis.fetch = vi.fn(async () => {
      throw new Error('no network in a default install')
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useTTSService())

    await act(async () => {
      await result.current.actions.speak('hello there')
    })
    await flush()

    expect(utteredTexts()).toContain('hello there')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('falls back to the browser voice when an opted-in Pocket server is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useTTSService({ config: { mode: 'pocket' } }))

    await act(async () => {
      await result.current.actions.speak('first')
    })
    await flushFor(250)

    // Previously this message was dropped and the session went mute.
    expect(utteredTexts()).toContain('first')

    // And the session stays audible without hammering the dead socket again.
    const callsAfterFirst = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await act(async () => {
      await result.current.actions.speak('second')
    })
    await flushFor(250)

    expect(utteredTexts()).toContain('second')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst)
  })

  it('barge-in still cancels browser speech', async () => {
    const { result } = renderHook(() => useTTSService({ config: { mode: 'browser' } }))

    await act(async () => {
      await result.current.actions.speak('a long sentence being spoken')
    })

    await act(async () => {
      result.current.actions.stopSpeaking()
    })

    expect(MockSpeechSynthesis.cancelled).toBeGreaterThan(0)
  })
})
