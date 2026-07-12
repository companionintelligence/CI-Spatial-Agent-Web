import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import {
  convertToVRMTarget,
  initializeVisemeState,
  resetVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesToRig,
  visemesSequence
} from './visemesService'
import { createEmptyVisemeTarget, createEmptyVRMVisemeTarget } from './visemeTypes'
import type { VisemeSequenceItem, WhisperData } from './visemeTypes'

// Silence the service's informational console noise so a failing assertion is easy to spot.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

const whisper = (over: Partial<WhisperData> = {}): WhisperData => ({
  words: ['hello'],
  wtimes: [0],
  wdurations: [500],
  ...over
})

describe('convertToVRMTarget', () => {
  it('maps the 14 GLB visemes down to the 5 VRM mouth shapes', () => {
    const glb = createEmptyVisemeTarget()
    glb.viseme_PP = 0.5 // bilabial → ou
    glb.viseme_aa = 0.9 // → aa
    glb.viseme_kk = 0.4 // velar → ih
    glb.viseme_E = 0.7 // → ee

    const vrm = convertToVRMTarget(glb)

    expect(vrm).toEqual({ aa: 0.9, ee: 0.7, ih: 0.4, oh: 0, ou: 0.5 })
  })

  it('takes the max when several GLB visemes collapse onto one VRM viseme', () => {
    const glb = createEmptyVisemeTarget()
    // E, I, FF, CH, SS all map to ee — the largest should win.
    glb.viseme_E = 0.2
    glb.viseme_I = 0.9
    glb.viseme_FF = 0.4

    expect(convertToVRMTarget(glb).ee).toBe(0.9)
  })

  it('leaves the target empty when no GLB viseme is active', () => {
    expect(convertToVRMTarget(createEmptyVisemeTarget())).toEqual(createEmptyVRMVisemeTarget())
  })

  it('ignores zero/negative viseme values (only value > 0 is mapped)', () => {
    const glb = createEmptyVisemeTarget()
    glb.viseme_O = 0 // → oh, but 0 must not register
    expect(convertToVRMTarget(glb).oh).toBe(0)
  })
})

describe('visemesSequence', () => {
  it('produces one sequence item per generated viseme, well-ordered in time', () => {
    const seq = visemesSequence({} as never, whisper())

    // "hello" → 4 visemes (I, E, nn, O).
    expect(seq).toHaveLength(4)

    for (const item of seq) {
      // ts is a 3-tuple [start, peak, end] and must be monotonically non-decreasing.
      expect(item.ts).toHaveLength(3)
      expect(item.ts[0]).toBeLessThanOrEqual(item.ts[1])
      expect(item.ts[1]).toBeLessThanOrEqual(item.ts[2])
      // Every item carries at least one viseme value.
      expect(Object.keys(item.vs).length).toBeGreaterThan(0)
    }
  })

  it('offsets every timestamp by the configured fudge factor', () => {
    const base = visemesSequence({} as never, whisper())
    const shifted = visemesSequence({} as never, whisper(), {
      timing: { fudgeFactor: 1_000_000, attackTime: 0, releaseTime: 0, minDuration: 0 },
      intensity: { baseMultiplier: 1, minThreshold: 0, dampeningFactor: 0.95 },
      curves: { attackCurve: 'linear', releaseCurve: 'linear' },
      lipsync: { baseLevel: 0.8, levelRange: 0.6, specialVisemes: { PP: 0.9, FF: 0.9 } }
    })
    // The huge fudge factor pushes the shifted sequence far into the future.
    expect(shifted[0].ts[0]).toBeGreaterThan(base[0].ts[0] + 900_000)
  })

  it('returns an empty array for null whisper data without throwing', () => {
    expect(() => visemesSequence({} as never, null)).not.toThrow()
    expect(visemesSequence({} as never, null)).toEqual([])
  })

  it('returns an empty array when required whisper fields are missing', () => {
    expect(visemesSequence({} as never, { words: ['hi'] } as WhisperData)).toEqual([])
    expect(visemesSequence({} as never, { wtimes: [0], wdurations: [1] } as WhisperData)).toEqual([])
  })

  it('returns an empty array for an empty words array', () => {
    expect(visemesSequence({} as never, whisper({ words: [], wtimes: [], wdurations: [] }))).toEqual([])
  })

  it('skips unpronounceable words without throwing', () => {
    // "!!!" preprocesses to nothing → no visemes, but the call must stay safe.
    expect(() => visemesSequence({} as never, whisper({ words: ['!!!'] }))).not.toThrow()
  })
})

describe('initializeVisemeState', () => {
  it('starts in GLB (14-viseme) mode by default', () => {
    const s = initializeVisemeState()
    expect(s.isVRMMode).toBe(false)
    expect(s.targets).toEqual(createEmptyVisemeTarget())
    expect(s.sequence).toEqual([])
    expect(s.dirty).toEqual({})
  })

  it('starts in VRM (5-viseme) mode when requested', () => {
    const s = initializeVisemeState(true)
    expect(s.isVRMMode).toBe(true)
    expect(s.targets).toEqual(createEmptyVRMVisemeTarget())
  })
})

describe('setupVisemeStateForMorphTargets', () => {
  it('wires morph targets + dictionary and forces GLB mode', () => {
    const s = initializeVisemeState(true) // start in VRM mode…
    const morphs = [{ morphTargetInfluences: [0, 0, 0] }]
    const dictionary = { viseme_aa: [0, 1] }

    setupVisemeStateForMorphTargets(s, morphs, dictionary)

    expect(s.morphs).toBe(morphs)
    expect(s.dictionary).toBe(dictionary)
    expect(s.isVRMMode).toBe(false) // …forced back to GLB.
  })
})

describe('resetVisemeState (barge-in)', () => {
  const item = (): VisemeSequenceItem =>
    ({ ts: [0, 1, 2], vs: { viseme_aa: [null, 0.8, 0.8] }, template: { name: 'x' } }) as VisemeSequenceItem

  it('zeroes the GLB morph influences the mouth was frozen at, not just the sequence', () => {
    const state = initializeVisemeState(false)
    const morphs = [{ morphTargetInfluences: [0, 0, 0, 0] }]
    const dictionary = { viseme_aa: [0, 1], viseme_O: [2, 3] }
    setupVisemeStateForMorphTargets(state, morphs, dictionary)

    // Simulate being mid-sentence: mouth is open and a sequence is still queued.
    morphs[0].morphTargetInfluences[0] = 0.8
    morphs[0].morphTargetInfluences[1] = 0.6
    morphs[0].morphTargetInfluences[2] = 0.5
    state.sequence = [item()]

    resetVisemeState(state)

    // Mouth actually closes (all mapped morphs zeroed) and nothing is left scheduled.
    expect(morphs[0].morphTargetInfluences).toEqual([0, 0, 0, 0])
    expect(state.sequence).toEqual([])
    // Bindings survive so the next utterance still animates the same avatar.
    expect(state.morphs).toBe(morphs)
    expect(state.dictionary).toBe(dictionary)
    expect(state.isVRMMode).toBe(false)
  })

  it('zeroes VRM mouth expressions and keeps the vrm binding', () => {
    const setValue = vi.fn()
    const state = initializeVisemeState(true)
    // Minimal VRM stand-in exposing the expressionManager surface reset() uses.
    state.vrm = { expressionManager: { setValue } } as never
    state.sequence = [item()]

    resetVisemeState(state)

    expect(state.sequence).toEqual([])
    for (const key of ['aa', 'ee', 'ih', 'oh', 'ou']) {
      expect(setValue).toHaveBeenCalledWith(key, 0)
    }
    // The vrm binding is preserved (a full state swap used to drop it).
    expect(state.vrm).toBeTruthy()
    expect(state.isVRMMode).toBe(true)
  })
})

describe('avatar switch VRM → GLB (regression: viseme state leak)', () => {
  // A VRM exposing the 5 mouth expressions → setupVisemeStateForVRM enters VRM mode.
  const makeVrm = () =>
    ({
      expressionManager: {
        expressionMap: { aa: {}, ee: {}, ih: {}, oh: {}, ou: {} },
        setValue: vi.fn()
      }
    }) as never

  it('setupVisemeStateForMorphTargets clears the stale VRM and resets GLB targets', () => {
    const s = initializeVisemeState()
    setupVisemeStateForVRM(s, makeVrm())
    expect(s.vrm).toBeDefined()
    expect(s.isVRMMode).toBe(true)

    setupVisemeStateForMorphTargets(s, [{ morphTargetInfluences: [0, 0] }], { viseme_aa: [1] })

    expect(s.vrm).toBeUndefined() // the leak fix — no stale VRM binding
    expect(s.isVRMMode).toBe(false)
    expect(s.targets).toEqual(createEmptyVisemeTarget()) // reset to 14-viseme GLB shape
  })

  it('visemesToRig drives the new GLB morphs, not the disposed VRM, after the switch', () => {
    const s = initializeVisemeState()
    const vrm = makeVrm()
    setupVisemeStateForVRM(s, vrm)

    const morphs = [{ morphTargetInfluences: [0, 0, 0] }]
    setupVisemeStateForMorphTargets(s, morphs, { viseme_aa: [1] })
    ;(s.targets as Record<string, number>).viseme_aa = 0.8

    visemesToRig(s, 0)

    expect(morphs[0].morphTargetInfluences[1]).toBeCloseTo(0.8) // GLB morph written
    expect((vrm as { expressionManager: { setValue: ReturnType<typeof vi.fn> } }).expressionManager.setValue).not.toHaveBeenCalled() // old VRM untouched
  })
})
