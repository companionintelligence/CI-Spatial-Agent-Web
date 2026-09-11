import { describe, expect, it } from 'vitest'

import { VisemeSchedule, scheduleFromWordTimings } from './VisemeSchedule'

/** Three 100 ms visemes back to back, in the millisecond shape HeadTTS emits. */
const THREE = {
  visemes: ['aa', 'PP', 'E'],
  times: [0, 100, 200],
  durations: [100, 100, 100]
}

describe('VisemeSchedule', () => {
  it('is empty before anything is loaded', () => {
    expect(new VisemeSchedule().weightsAt(0)).toEqual({})
  })

  it('reports a viseme at full weight in the middle of its span', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(THREE.visemes, THREE.times, THREE.durations)
    expect(s.weightsAt(0.05)['viseme:aa']).toBeCloseTo(1)
  })

  it('overlaps neighbours rather than switching between them', () => {
    // At a boundary both shapes should be partly present — that overlap IS the
    // coarticulation, and it is what stops the mouth from popping between poses.
    const s = new VisemeSchedule({ leadSeconds: 0.03 })
    s.setFromArrays(THREE.visemes, THREE.times, THREE.durations)
    const w = s.weightsAt(0.1)
    expect(w['viseme:aa']).toBeGreaterThan(0)
    expect(w['viseme:PP']).toBeGreaterThan(0)
  })

  it('never emits a weight above 1 even where three visemes overlap', () => {
    const s = new VisemeSchedule({ leadSeconds: 0.2 })
    s.setFromArrays(THREE.visemes, THREE.times, THREE.durations)
    for (let t = 0; t < 0.35; t += 0.01) {
      for (const v of Object.values(s.weightsAt(t))) expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('widens a sub-frame bilabial closure so it survives to the screen', () => {
    // A 5 ms /p/ at 60 fps falls between frames. Missing it turns "mama" into
    // "aa-aa", which is the single most visible lip-sync failure there is.
    const s = new VisemeSchedule({ minClosureSeconds: 0.035 })
    s.setFromArrays(['aa', 'PP', 'aa'], [0, 100, 105], [100, 5, 100])
    let sawClosure = false
    for (let t = 0.09; t < 0.16; t += 1 / 60) {
      if ((s.weightsAt(t)['viseme:PP'] ?? 0) > 0.5) sawClosure = true
    }
    expect(sawClosure, 'a short closure must still be visible on some frame').toBe(true)
  })

  it('does not widen a non-closure', () => {
    const s = new VisemeSchedule({ minClosureSeconds: 0.035, leadSeconds: 0 })
    s.setFromArrays(['E'], [0], [5])
    expect(s.duration).toBeCloseTo(0.005)
  })

  it('drops silence rather than driving a shape for it', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(['sil'], [0], [100])
    expect(s.weightsAt(0.05)).toEqual({})
  })

  it('returns nothing outside the utterance', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(THREE.visemes, THREE.times, THREE.durations)
    expect(s.weightsAt(-1)).toEqual({})
    expect(s.weightsAt(10)).toEqual({})
  })

  it('ignores malformed entries instead of poisoning the timeline', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(['aa', 'E', 'O'], [0, Number.NaN, 200], [100, 100, -5])
    expect(s.length).toBe(1)
  })

  it('sorts out-of-order input', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(['E', 'aa'], [200, 0], [100, 100])
    expect(s.weightsAt(0.05)['viseme:aa']).toBeCloseTo(1)
    expect(s.weightsAt(0.25)['viseme:E']).toBeCloseTo(1)
  })

  it('clear() empties the schedule', () => {
    const s = new VisemeSchedule()
    s.setFromArrays(THREE.visemes, THREE.times, THREE.durations)
    s.clear()
    expect(s.length).toBe(0)
    expect(s.weightsAt(0.05)).toEqual({})
  })
})

describe('scheduleFromWordTimings', () => {
  // Stand-in for LipsyncEn: "hi" -> two visemes with notional 100 ms each.
  const rules = (word: string) =>
    word === 'hi'
      ? { visemes: ['kk', 'I'], times: [0, 100], durations: [100, 100] }
      : { visemes: ['aa'], times: [0], durations: [100] }

  it('scales the rules onto each word’s real measured span', () => {
    // The word runs 1000..1400 ms. Its two visemes must fill exactly that span,
    // not the rules’ notional 200 ms.
    const out = scheduleFromWordTimings(['hi'], [1000], [400], rules)
    expect(out.visemes).toEqual(['kk', 'I'])
    expect(out.times).toEqual([1000, 1200])
    expect(out.durations).toEqual([200, 200])
  })

  it('places each word at its own start time', () => {
    const out = scheduleFromWordTimings(['a', 'a'], [0, 500], [100, 100], rules)
    expect(out.times).toEqual([0, 500])
  })

  it('skips words the rules cannot parse', () => {
    const out = scheduleFromWordTimings(['x', 'hi'], [0, 100], [50, 100], () => null)
    expect(out.visemes).toEqual([])
  })

  it('skips zero-duration words rather than dividing by zero', () => {
    const out = scheduleFromWordTimings(['hi'], [0], [0], rules)
    expect(out.visemes).toEqual([])
  })

  it('feeds a schedule that resolves back to the right shapes', () => {
    const out = scheduleFromWordTimings(['hi'], [0], [400], rules)
    const s = new VisemeSchedule({ leadSeconds: 0 })
    s.setFromArrays(out.visemes, out.times, out.durations)
    expect(s.weightsAt(0.1)['viseme:kk']).toBeCloseTo(1)
    expect(s.weightsAt(0.3)['viseme:I']).toBeCloseTo(1)
  })
})
