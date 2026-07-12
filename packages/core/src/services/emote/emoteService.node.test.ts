import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { defaultEmoteConfig } from './configs/emoteConfig'
import { moodConfigurations } from './configs/moodConfigurations'
import {
  applyEmotion,
  emoteUpdate,
  handleBargeIn,
  initializeEmoteState,
  setupEmoteStateForMorphTargets,
  setupEmoteStateForVRM,
  startPerformance
} from './emoteService'
import type { EmotionType } from './emoteTypes'

const ALL_EMOTIONS: EmotionType[] = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'fear',
  'disgust',
  'love',
  'sleep',
  'alert'
]

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('initializeEmoteState', () => {
  it('starts neutral, not performing, with sub-states initialized', () => {
    const s = initializeEmoteState()
    expect(s.currentEmotion).toBe('neutral')
    expect(s.isPerforming).toBe(false)
    expect(s.performanceStartTime).toBe(0)
    expect(s.blinkState.isBlinking).toBe(false)
    expect(s.blinkState.nextBlinkTime).toBeGreaterThan(0)
    expect(s.tickState.currentTick).toBeNull()
  })
})

describe('applyEmotion — baseline target math', () => {
  it('writes the mood baseline onto state.targets', () => {
    const s = initializeEmoteState()
    const res = applyEmotion(s, 'happy')

    expect(res.success).toBe(true)
    // happy baseline: mouthSmile 0.6, eyesLookDown 0.1.
    expect(s.targets.mouthSmile).toBe(0.6)
    expect(s.targets.eyesLookDown).toBe(0.1)
    expect(s.currentEmotion).toBe('happy')
  })

  it('applies the angry baseline including hand-fist targets', () => {
    const s = initializeEmoteState()
    applyEmotion(s, 'angry')
    expect(s.targets.browDownLeft).toBe(0.6)
    expect(s.targets.handFistLeft).toBe(1)
    expect(s.currentEmotion).toBe('angry')
  })

  it('is a safe no-op for an emotion with no mood config (alert)', () => {
    const s = initializeEmoteState()
    const before = { ...s.targets }
    const res = applyEmotion(s, 'alert')
    // alert has no baseline in moodConfigurations → early return, no throw, targets unchanged.
    expect(res.success).toBe(true)
    expect(s.targets).toEqual(before)
  })

  it('ignores empty/undefined emotion input', () => {
    const s = initializeEmoteState()
    expect(applyEmotion(s, '' as EmotionType).success).toBe(true)
    expect(s.currentEmotion).toBe('neutral')
  })
})

describe('moodConfigurations completeness', () => {
  it('defines a baseline for every emotion except the config-less alert', () => {
    for (const emotion of ALL_EMOTIONS) {
      if (emotion === 'alert') {
        // Documents the current gap: alert has no mood config.
        expect(moodConfigurations[emotion]).toBeUndefined()
        continue
      }
      expect(moodConfigurations[emotion]).toBeDefined()
      expect(moodConfigurations[emotion].baseline).toBeDefined()
      expect(Object.keys(moodConfigurations[emotion].baseline).length).toBeGreaterThan(0)
    }
  })

  it('keeps all baseline expression values within the valid 0..1 range', () => {
    for (const key of Object.keys(moodConfigurations)) {
      const baseline = moodConfigurations[key].baseline
      for (const [name, value] of Object.entries(baseline)) {
        expect(value, `${key}.${name}`).toBeGreaterThanOrEqual(0)
        expect(value, `${key}.${name}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('provides a speech profile for every configured mood', () => {
    for (const key of Object.keys(moodConfigurations)) {
      expect(moodConfigurations[key].speech).toBeDefined()
    }
  })
})

describe('startPerformance', () => {
  it('marks the state performing and schedules a relaxation window', () => {
    const s = initializeEmoteState()
    const res = startPerformance(s, { emotion: 'happy' }, 0)

    expect(res.success).toBe(true)
    expect(s.isPerforming).toBe(true)
    expect(s.performanceStartTime).toBeGreaterThan(0)
    // Relaxation is at least the 2s animation floor after the start time.
    expect(s.relaxationTime).toBeGreaterThanOrEqual(s.performanceStartTime + 2000)
    expect(s.currentEmotion).toBe('happy')
  })

  it('honors a longer explicit relaxTime over the 2s floor', () => {
    const s = initializeEmoteState()
    startPerformance(s, { emotion: 'sad', relaxTime: 5000 }, 0)
    expect(s.relaxationTime).toBeGreaterThanOrEqual(s.performanceStartTime + 5000)
  })

  it('is a safe no-op when no performance data is supplied', () => {
    const s = initializeEmoteState()
    const res = startPerformance(s, undefined as never, 0)
    expect(res.success).toBe(true)
    expect(s.isPerforming).toBe(false)
  })
})

describe('handleBargeIn', () => {
  it('relaxes a performing state back to neutral', () => {
    const s = initializeEmoteState()
    startPerformance(s, { emotion: 'angry' }, 0)
    expect(s.isPerforming).toBe(true)

    handleBargeIn(s)

    expect(s.isPerforming).toBe(false)
    expect(s.currentEmotion).toBe('neutral')
    expect(s.performanceStartTime).toBe(0)
    expect(s.relaxationTime).toBe(0)
  })
})

describe('emoteUpdate', () => {
  it('runs a full tick without throwing and clears the performing flag once relaxed', () => {
    const s = initializeEmoteState()
    // Force an already-elapsed relaxation window so the performing branch resets.
    s.isPerforming = true
    s.relaxationTime = performance.now() - 1

    expect(() => emoteUpdate(s, 0.016, defaultEmoteConfig)).not.toThrow()
    expect(s.isPerforming).toBe(false)
  })

  it('is safe to call on a fresh (non-performing) state', () => {
    const s = initializeEmoteState()
    expect(() => emoteUpdate(s, 0.016, defaultEmoteConfig)).not.toThrow()
  })
})

describe('avatar switch VRM → GLB (regression: emote state leak)', () => {
  const makeVrm = () => ({ lookAt: undefined }) as never

  it('setupEmoteStateForMorphTargets clears the stale VRM binding', () => {
    const s = initializeEmoteState()
    setupEmoteStateForVRM(s, makeVrm())
    expect(s.vrm).toBeDefined()

    const morphs = [{ morphTargetInfluences: [0, 0] }]
    setupEmoteStateForMorphTargets(s, morphs, { mouthSmile: [1] })

    expect(s.vrm).toBeUndefined() // the leak fix — updateVRMSystems/applyToVRM now no-op on GLB
    expect(s.morphs).toBe(morphs)
  })

  it('setupEmoteStateForVRM clears stale GLB morph bindings', () => {
    const s = initializeEmoteState()
    setupEmoteStateForMorphTargets(s, [{ morphTargetInfluences: [0] }], { mouthSmile: [0] })
    expect(s.morphs).toBeDefined()

    setupEmoteStateForVRM(s, makeVrm())

    expect(s.morphs).toBeUndefined()
    expect(s.dictionary).toBeUndefined()
    expect(s.vrm).toBeDefined()
  })
})
