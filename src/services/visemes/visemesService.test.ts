import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initializeVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesSequence,
  visemesToRig,
  visemesUpdate
} from './visemesService'
import type { VisemeSequenceItem, VisemeState, WhisperData } from './visemeTypes'
import { createEmptyVisemeTarget } from './visemeTypes'

describe('visemesService', () => {
  describe('visemesSequence', () => {
    it('should return empty array when whisper data is null', () => {
      const volume = initializeVisemeState()
      const result = visemesSequence(volume, null, 1000)

      expect(result).toEqual([])
    })

    it('should generate viseme sequence from whisper data', () => {
      const volume = initializeVisemeState()
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [0],
        wdurations: [500]
      }

      const result = visemesSequence(volume, whisperData, 1000)

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should apply time offset with fudge factor', () => {
      const volume = initializeVisemeState()
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [0],
        wdurations: [500]
      }
      const baseTime = 1000

      const result = visemesSequence(volume, whisperData, baseTime)

      if (result.length > 0) {
        result.forEach((item) => {
          // The timing calculation includes attack/release curves, so the first timestamp
          // might be offset backward by up to 60ms, but should still be close to baseTime + 150
          expect(item.ts[0]).toBeGreaterThanOrEqual(baseTime + 90) // Allow for attack curve
          expect(item.ts[1]).toBeGreaterThanOrEqual(baseTime + 150)
          expect(item.ts[2]).toBeGreaterThanOrEqual(baseTime + 150)
        })
      }
    })

    it('should handle empty words array', () => {
      const volume = initializeVisemeState()
      const whisperData: WhisperData = {
        words: [],
        wtimes: [],
        wdurations: []
      }

      const result = visemesSequence(volume, whisperData, 1000)

      expect(result).toEqual([])
    })
  })

  describe('visemesUpdate', () => {
    let mockState: VisemeState
    let mockSequence: VisemeSequenceItem[]

    beforeEach(() => {
      mockState = initializeVisemeState()
      mockSequence = [
        {
          template: { name: 'viseme' },
          ts: [100, 150, 200],
          vs: {
            viseme_aa: [null, 0.8, 0]
          }
        },
        {
          template: { name: 'viseme' },
          ts: [300, 350, 400],
          vs: {
            viseme_PP: [null, 0.9, 0]
          }
        }
      ]
      mockState.sequence = mockSequence
    })

    it('should initialize targets if not present', () => {
      const state: VisemeState = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targets: undefined as any,
        dirty: {},
        sequence: []
      }

      visemesUpdate(state, 100)

      expect(state.targets).toBeDefined()
      expect(state.targets).toEqual(createEmptyVisemeTarget())
    })

    it('should initialize dirty tracker if not present', () => {
      const state: VisemeState = {
        targets: createEmptyVisemeTarget(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dirty: undefined as any,
        sequence: []
      }

      visemesUpdate(state, 100)

      expect(state.dirty).toBeDefined()
    })

    it('should dampen existing visemes', () => {
      mockState.targets.viseme_aa = 1.0

      visemesUpdate(mockState, 50) // Time before any sequence items

      expect(mockState.targets.viseme_aa).toBeLessThan(1.0)
      expect(mockState.targets.viseme_aa).toBeGreaterThan(0)
    })

    it('should set visemes to zero when very small', () => {
      mockState.targets.viseme_aa = 0.005 // Below 0.01 threshold

      visemesUpdate(mockState, 50)

      expect(mockState.targets.viseme_aa).toBe(0)
    })

    it('should apply active sequence items', () => {
      const currentTime = 125 // Within first sequence item range [100, 200]

      visemesUpdate(mockState, currentTime)

      expect(mockState.targets.viseme_aa).toBeGreaterThan(0)
    })

    it('should ignore sequence items outside time range', () => {
      const currentTime = 50 // Before any sequence items

      visemesUpdate(mockState, currentTime)

      // Should not set viseme_aa from sequence
      expect(mockState.targets.viseme_aa).toBeLessThanOrEqual(0.01) // Only dampening effect
    })

    it('should apply attack curve for early times', () => {
      const currentTime = 110 // Early in first sequence item
      mockState.targets.viseme_aa = 0 // Start clean

      visemesUpdate(mockState, currentTime)

      const earlyValue = mockState.targets.viseme_aa

      // Reset and test later time
      mockState.targets.viseme_aa = 0
      visemesUpdate(mockState, 150) // Peak time

      const peakValue = mockState.targets.viseme_aa

      expect(earlyValue).toBeLessThan(peakValue)
    })

    it('should apply release curve for late times', () => {
      const currentTime = 180 // Late in first sequence item
      mockState.targets.viseme_aa = 0

      visemesUpdate(mockState, currentTime)

      const lateValue = mockState.targets.viseme_aa

      // Reset and test peak time
      mockState.targets.viseme_aa = 0
      visemesUpdate(mockState, 150) // Peak time

      const peakValue = mockState.targets.viseme_aa

      expect(lateValue).toBeLessThan(peakValue)
    })

    it('should handle multiple overlapping sequence items', () => {
      // Add overlapping sequence item
      mockState.sequence.push({
        template: { name: 'viseme' },
        ts: [120, 160, 220],
        vs: {
          viseme_E: [null, 0.7, 0]
        }
      })

      const currentTime = 140 // Within both ranges

      visemesUpdate(mockState, currentTime)

      expect(mockState.targets.viseme_aa).toBeGreaterThan(0)
      expect(mockState.targets.viseme_E).toBeGreaterThan(0)
    })

    it('should handle sequence items with no vs data', () => {
      mockState.sequence = [
        {
          template: { name: 'viseme' },
          ts: [100, 150, 200],
          vs: {}
        }
      ]

      expect(() => {
        visemesUpdate(mockState, 150)
      }).not.toThrow()
    })

    it('should handle sequence items with null values in vs', () => {
      mockState.sequence = [
        {
          template: { name: 'viseme' },
          ts: [100, 150, 200],
          vs: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            viseme_aa: null as any
          }
        }
      ]

      expect(() => {
        visemesUpdate(mockState, 150)
      }).not.toThrow()
    })
  })

  describe('visemesToRig', () => {
    let mockState: VisemeState

    beforeEach(() => {
      mockState = initializeVisemeState()
      mockState.targets.viseme_aa = 0.5
      mockState.targets.viseme_PP = 0.8
    })

    it('should return early if no targets', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockState.targets = undefined as any

      expect(() => {
        visemesToRig(mockState, 100)
      }).not.toThrow()
    })

    it('should initialize dirty tracker if not present', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockState.dirty = undefined as any

      visemesToRig(mockState, 100)

      expect(mockState.dirty).toBeDefined()
    })

    it('should apply global amplification', () => {
      const originalValue = mockState.targets.viseme_aa
      const amplify = 2.0

      visemesToRig(mockState, 100, amplify)

      expect(mockState.targets.viseme_aa).toBe(originalValue * amplify)
    })

    it('should skip unchanged values for optimization', () => {
      mockState.dirty.viseme_aa = 0.5 // Same as current value
      const mockVrm = { expressionManager: { setValue: vi.fn() } }
      mockState.vrm = mockVrm

      visemesToRig(mockState, 100)

      expect(mockVrm.expressionManager.setValue).not.toHaveBeenCalledWith('viseme_aa', expect.any(Number))
    })

    it('should update dirty values for changed targets', () => {
      mockState.dirty.viseme_aa = 0.3 // Different from current 0.5
      const mockVrm = { expressionManager: { setValue: vi.fn() } }
      mockState.vrm = mockVrm

      visemesToRig(mockState, 100)

      expect(mockState.dirty.viseme_aa).toBe(0.5)
      expect(mockVrm.expressionManager.setValue).toHaveBeenCalledWith('viseme_aa', 0.5)
    })

    it('should handle VRM avatars', () => {
      const mockVrm = { expressionManager: { setValue: vi.fn() } }
      mockState.vrm = mockVrm

      visemesToRig(mockState, 100)

      expect(mockVrm.expressionManager.setValue).toHaveBeenCalledWith('viseme_aa', 0.5)
      expect(mockVrm.expressionManager.setValue).toHaveBeenCalledWith('viseme_PP', 0.8)
    })

    it('should handle morph target avatars', () => {
      const mockMorphs = [{ morphTargetInfluences: [0, 0, 0, 0, 0] }, { morphTargetInfluences: [0, 0, 0] }]
      const mockDictionary = {
        viseme_aa: [1, 2], // Maps to indices in morph targets
        viseme_PP: [0, 3]
      }

      mockState.morphs = mockMorphs
      mockState.dictionary = mockDictionary

      visemesToRig(mockState, 100)

      expect(mockMorphs[0].morphTargetInfluences[1]).toBe(0.5) // viseme_aa
      expect(mockMorphs[0].morphTargetInfluences[2]).toBe(0.5) // viseme_aa
      expect(mockMorphs[0].morphTargetInfluences[0]).toBe(0.8) // viseme_PP
      expect(mockMorphs[0].morphTargetInfluences[3]).toBe(0.8) // viseme_PP
    })

    it('should skip morph targets without dictionary', () => {
      const mockMorphs = [{ morphTargetInfluences: [0, 0, 0] }]
      mockState.morphs = mockMorphs
      mockState.dictionary = undefined

      expect(() => {
        visemesToRig(mockState, 100)
      }).not.toThrow()

      // Values should remain unchanged
      expect(mockMorphs[0].morphTargetInfluences[0]).toBe(0)
    })

    it('should skip undefined morph target influences', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockMorphs = [{ morphTargetInfluences: undefined as any }]
      const mockDictionary = { viseme_aa: [0] }

      mockState.morphs = mockMorphs
      mockState.dictionary = mockDictionary

      expect(() => {
        visemesToRig(mockState, 100)
      }).not.toThrow()
    })

    it('should handle out-of-range morph target indices', () => {
      const mockMorphs = [{ morphTargetInfluences: [0, 0] }] // Only 2 elements
      const mockDictionary = { viseme_aa: [5] } // Index out of range

      mockState.morphs = mockMorphs
      mockState.dictionary = mockDictionary

      expect(() => {
        visemesToRig(mockState, 100)
      }).not.toThrow()
    })
  })

  describe('initializeVisemeState', () => {
    it('should create a proper initial state', () => {
      const state = initializeVisemeState()

      expect(state.targets).toEqual(createEmptyVisemeTarget())
      expect(state.dirty).toEqual({})
      expect(state.sequence).toEqual([])
      expect(state.vrm).toBeUndefined()
      expect(state.morphs).toBeUndefined()
      expect(state.dictionary).toBeUndefined()
    })

    it('should create new objects each time', () => {
      const state1 = initializeVisemeState()
      const state2 = initializeVisemeState()

      expect(state1).not.toBe(state2)
      expect(state1.targets).not.toBe(state2.targets)
      expect(state1.dirty).not.toBe(state2.dirty)
      expect(state1.sequence).not.toBe(state2.sequence)
    })
  })

  describe('setupVisemeStateForVRM', () => {
    it('should set VRM reference', () => {
      const state = initializeVisemeState()
      const mockVrm = { expressionManager: { setValue: vi.fn() } }

      setupVisemeStateForVRM(state, mockVrm)

      expect(state.vrm).toBe(mockVrm)
    })
  })

  describe('setupVisemeStateForMorphTargets', () => {
    it('should set morph targets and dictionary', () => {
      const state = initializeVisemeState()
      const mockMorphs = [{ morphTargetInfluences: [0, 0, 0] }]
      const mockDictionary = { viseme_aa: [0, 1] }

      setupVisemeStateForMorphTargets(state, mockMorphs, mockDictionary)

      expect(state.morphs).toBe(mockMorphs)
      expect(state.dictionary).toBe(mockDictionary)
    })
  })
})
