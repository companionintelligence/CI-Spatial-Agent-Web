import { beforeEach, describe, expect, it } from 'vitest'

import {
  __resetLatency,
  beginTurn,
  getLastLatencyTrace,
  getLatencyTrace,
  mark,
  overBudget
} from './latency'

beforeEach(() => __resetLatency())

describe('latency trace', () => {
  it('measures stages relative to the turn, not to each other', () => {
    beginTurn()
    mark('llm-first-token')
    const trace = getLatencyTrace()
    expect(trace['turn-start']).toBe(0)
    expect(trace['llm-first-token']).toBeGreaterThanOrEqual(0)
  })

  it('keeps the FIRST observation of a stage', () => {
    // These are first-token / first-audio metrics. Letting a later chunk
    // overwrite them silently turns latency into duration.
    beginTurn()
    mark('first-audio')
    const first = getLatencyTrace()['first-audio']
    mark('first-audio')
    expect(getLatencyTrace()['first-audio']).toBe(first)
  })

  it('retains the previous turn so a HUD does not flicker mid-turn', () => {
    beginTurn()
    mark('first-audio')
    beginTurn()
    expect(getLastLatencyTrace()?.['first-audio']).toBeDefined()
    expect(getLatencyTrace()['first-audio']).toBeUndefined()
  })

  it('reports only the stages that blew their budget', () => {
    expect(overBudget({ 'llm-first-token': 100, 'first-audio': 5000 })).toEqual(['first-audio'])
  })

  it('reports nothing for an empty trace', () => {
    expect(overBudget({})).toEqual([])
  })

  it('ignores stages that have no budget', () => {
    expect(overBudget({ 'stt-final': 99999 })).toEqual([])
  })
})
