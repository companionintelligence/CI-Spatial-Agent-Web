import { describe, expect, it, vi } from 'vitest'

import { ConversationMachine, toDisplayStatus, type ConversationEvent } from './ConversationMachine'

/** Drive a machine through a sequence and return it. */
const drive = (...events: ConversationEvent[]) => {
  const m = new ConversationMachine()
  for (const e of events) m.send(e)
  return m
}

describe('ConversationMachine', () => {
  it('starts idle and accepting input', () => {
    const m = new ConversationMachine()
    expect(m.current).toBe('idle')
    expect(m.acceptsInput).toBe(true)
    expect(m.isSpeaking).toBe(false)
  })

  it('walks a whole turn: listen, submit, think, speak, done', () => {
    const m = new ConversationMachine()
    expect(m.send('MIC_OPENED')).toBe('listening')
    expect(m.send('SPEECH_DETECTED')).toBe('listening')
    expect(m.send('USER_SUBMITTED')).toBe('thinking')
    expect(m.send('AUDIO_STARTED')).toBe('speaking')
    expect(m.isSpeaking).toBe(true)
    expect(m.send('AUDIO_ENDED')).toBe('idle')
    expect(m.isSpeaking).toBe(false)
  })

  it('allows several audio clips inside one turn', () => {
    // Sentence-chunked TTS fires AUDIO_STARTED per sentence; that must not be
    // treated as illegal or the second sentence stops driving the mouth.
    const m = drive('USER_SUBMITTED', 'AUDIO_STARTED')
    expect(m.send('AUDIO_STARTED')).toBe('speaking')
    expect(m.snapshot.ignored).toBe(0)
  })

  it('completes a turn that produces no audio at all', () => {
    // A silent install (TTS off) still has to return to idle, or the UI hangs
    // on "thinking" forever.
    expect(drive('USER_SUBMITTED', 'AUDIO_ENDED').current).toBe('idle')
  })

  it('routes barge-in through interrupted, not straight to idle', () => {
    // Interruption is a settling state: the audio graph and the face's speech
    // layer each need an explicit release. Skipping it is what froze an
    // expression mid-word.
    const m = drive('USER_SUBMITTED', 'AUDIO_STARTED')
    expect(m.send('BARGE_IN')).toBe('interrupted')
    expect(m.isSpeaking).toBe(false)
    expect(m.send('AUDIO_ENDED')).toBe('idle')
  })

  it('lets the user start the next turn straight out of an interruption', () => {
    const m = drive('USER_SUBMITTED', 'AUDIO_STARTED', 'BARGE_IN')
    expect(m.acceptsInput).toBe(true)
    expect(m.send('USER_SUBMITTED')).toBe('thinking')
  })

  it('can be interrupted while still thinking, before any audio', () => {
    expect(drive('USER_SUBMITTED', 'BARGE_IN').current).toBe('interrupted')
  })

  it('never reports speaking outside the speaking state', () => {
    // The stuck-jaw bug in Phase 1 was exactly this invariant being violated.
    const states: ConversationEvent[][] = [
      [],
      ['MIC_OPENED'],
      ['USER_SUBMITTED'],
      ['USER_SUBMITTED', 'AUDIO_STARTED', 'AUDIO_ENDED'],
      ['USER_SUBMITTED', 'AUDIO_STARTED', 'BARGE_IN'],
      ['FAILED']
    ]
    for (const seq of states) {
      const m = drive(...seq)
      if (m.current !== 'speaking') expect(m.isSpeaking, seq.join('>')).toBe(false)
    }
  })

  it('ignores an illegal event instead of throwing, and counts it', () => {
    // A UI event arriving a frame late must never crash a render loop.
    const m = new ConversationMachine()
    expect(() => m.send('AUDIO_ENDED')).not.toThrow()
    expect(m.current).toBe('idle')
    expect(m.snapshot.ignored).toBe(1)
  })

  it('does not bump the revision for an ignored event', () => {
    const m = new ConversationMachine()
    m.send('AUDIO_ENDED')
    expect(m.snapshot.revision).toBe(0)
  })

  it('bumps the revision on an accepted self-transition', () => {
    const m = drive('MIC_OPENED')
    const before = m.snapshot.revision
    m.send('SPEECH_DETECTED')
    expect(m.snapshot.revision).toBe(before + 1)
  })

  it('accepts() agrees with what send() actually does', () => {
    const m = drive('USER_SUBMITTED')
    expect(m.accepts('AUDIO_STARTED')).toBe(true)
    expect(m.accepts('MIC_CLOSED')).toBe(false)
    const before = m.current
    m.send('MIC_CLOSED')
    expect(m.current).toBe(before)
  })

  it('reaches failed from every working state, and recovers', () => {
    for (const seq of [[], ['MIC_OPENED'], ['USER_SUBMITTED'], ['USER_SUBMITTED', 'AUDIO_STARTED']]) {
      const m = drive(...(seq as ConversationEvent[]))
      expect(m.send('FAILED')).toBe('failed')
      expect(m.send('RECOVERED')).toBe('idle')
    }
  })

  it('lets the user retry directly from failed without a reset', () => {
    const m = drive('FAILED')
    expect(m.acceptsInput).toBe(true)
    expect(m.send('USER_SUBMITTED')).toBe('thinking')
  })

  it('RESET returns to idle from anywhere', () => {
    for (const seq of [['MIC_OPENED'], ['USER_SUBMITTED', 'AUDIO_STARTED'], ['FAILED']]) {
      expect(drive(...(seq as ConversationEvent[])).send('RESET')).toBe('idle')
    }
  })

  it('notifies subscribers only on accepted transitions', () => {
    const m = new ConversationMachine()
    const spy = vi.fn()
    m.subscribe(spy)
    m.send('AUDIO_ENDED') // illegal from idle
    expect(spy).not.toHaveBeenCalled()
    m.send('MIC_OPENED')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].state).toBe('listening')
  })

  it('unsubscribe stops delivery', () => {
    const m = new ConversationMachine()
    const spy = vi.fn()
    m.subscribe(spy)()
    m.send('MIC_OPENED')
    expect(spy).not.toHaveBeenCalled()
  })

  it('survives a long random event stream without leaving the legal set', () => {
    // Fuzz: whatever order events arrive in, the machine must stay in a declared
    // state and never throw.
    const all: ConversationEvent[] = [
      'MIC_OPENED', 'SPEECH_DETECTED', 'MIC_CLOSED', 'USER_SUBMITTED', 'RESPONSE_STARTED',
      'AUDIO_STARTED', 'AUDIO_ENDED', 'BARGE_IN', 'ABORTED', 'FAILED', 'RECOVERED', 'RESET'
    ]
    const legal = new Set(['idle', 'listening', 'thinking', 'speaking', 'interrupted', 'failed'])
    const m = new ConversationMachine()
    let seed = 12345
    for (let i = 0; i < 20000; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      m.send(all[seed % all.length])
      expect(legal.has(m.current)).toBe(true)
    }
  })
})

describe('toDisplayStatus', () => {
  it('passes through the three active states', () => {
    expect(toDisplayStatus('listening')).toBe('listening')
    expect(toDisplayStatus('thinking')).toBe('thinking')
    expect(toDisplayStatus('speaking')).toBe('speaking')
  })

  it('presents interrupted and failed as idle, so the avatar looks settled', () => {
    expect(toDisplayStatus('interrupted')).toBe('idle')
    expect(toDisplayStatus('failed')).toBe('idle')
  })
})
