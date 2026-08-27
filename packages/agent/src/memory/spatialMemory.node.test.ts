import { describe, expect, it } from 'vitest'

import { SpatialMemory } from './spatialMemory'

const T0 = 1_000_000

describe('SpatialMemory', () => {
  it('remembers a labelled observation', () => {
    const memory = new SpatialMemory()
    memory.observe('Cup', { position: [1, 0, 2], now: T0 })
    expect(memory.recall('cup', T0)?.position).toEqual([1, 0, 2])
  })

  it('is case- and whitespace-insensitive', () => {
    const memory = new SpatialMemory()
    memory.observe('  CHAIR ', { now: T0 })
    expect(memory.recall('chair', T0)).toBeTruthy()
  })

  it('does NOT erase a known position when re-seen without one', () => {
    // Seeing the cup again from across the room, unanchored, must not make us
    // forget where it is. That asymmetry is the whole point of permanence.
    const memory = new SpatialMemory()
    memory.observe('cup', { position: [1, 0, 2], now: T0 })
    memory.observe('cup', { now: T0 + 100 })
    expect(memory.recall('cup', T0 + 100)?.position).toEqual([1, 0, 2])
  })

  it('counts repeat sightings', () => {
    const memory = new SpatialMemory()
    memory.observe('cup', { now: T0 })
    memory.observe('cup', { now: T0 + 1 })
    expect(memory.recall('cup', T0 + 1)?.hits).toBe(2)
  })

  it('forgets an object that has not been seen for long enough', () => {
    const memory = new SpatialMemory({ forgetAfterMs: 1000 })
    memory.observe('cup', { now: T0 })
    expect(memory.recall('cup', T0 + 1500)).toBeNull()
  })

  it('evicts the least recently seen when over capacity', () => {
    const memory = new SpatialMemory({ capacity: 2 })
    memory.observe('a', { now: T0 })
    memory.observe('b', { now: T0 + 1 })
    memory.observe('c', { now: T0 + 2 })
    expect(memory.size).toBe(2)
    expect(memory.recall('a', T0 + 2)).toBeNull()
  })

  it('lists most recently seen first', () => {
    const memory = new SpatialMemory()
    memory.observe('a', { now: T0 })
    memory.observe('b', { now: T0 + 10 })
    expect(memory.list(T0 + 10).map((o) => o.label)).toEqual(['b', 'a'])
  })

  it('describes an empty memory honestly', () => {
    expect(new SpatialMemory().describe(T0)).toMatch(/not seen anything/)
  })

  it('marks anchored objects in its description', () => {
    const memory = new SpatialMemory()
    memory.observe('cup', { position: [0, 0, 0], now: T0 })
    memory.observe('door', { now: T0 })
    const described = memory.describe(T0)
    expect(described).toContain('cup (anchored)')
    expect(described).toContain('door')
  })
})
