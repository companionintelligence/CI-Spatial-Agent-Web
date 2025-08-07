import { describe, expect, it } from 'vitest'
import type { VisemeSequenceItem, VisemeState, VisemeTarget, WhisperData } from './visemeTypes'
import { createEmptyVisemeTarget } from './visemeTypes'

describe('visemeTypes', () => {
  describe('createEmptyVisemeTarget', () => {
    it('should create a viseme target with all values set to 0', () => {
      const target = createEmptyVisemeTarget()

      expect(target).toEqual({
        viseme_PP: 0,
        viseme_FF: 0,
        viseme_TH: 0,
        viseme_DD: 0,
        viseme_kk: 0,
        viseme_CH: 0,
        viseme_SS: 0,
        viseme_nn: 0,
        viseme_RR: 0,
        viseme_aa: 0,
        viseme_E: 0,
        viseme_I: 0,
        viseme_O: 0,
        viseme_U: 0
      })
    })

    it('should create a new object each time', () => {
      const target1 = createEmptyVisemeTarget()
      const target2 = createEmptyVisemeTarget()

      expect(target1).not.toBe(target2)
      expect(target1).toEqual(target2)
    })
  })

  describe('Type Definitions', () => {
    it('should have correct VisemeTarget structure', () => {
      const target: VisemeTarget = createEmptyVisemeTarget()

      // Test that all required viseme properties exist
      const expectedKeys = [
        'viseme_PP',
        'viseme_FF',
        'viseme_TH',
        'viseme_DD',
        'viseme_kk',
        'viseme_CH',
        'viseme_SS',
        'viseme_nn',
        'viseme_RR',
        'viseme_aa',
        'viseme_E',
        'viseme_I',
        'viseme_O',
        'viseme_U'
      ]

      expectedKeys.forEach((key) => {
        expect(target).toHaveProperty(key)
        expect(typeof target[key as keyof VisemeTarget]).toBe('number')
      })
    })

    it('should support VisemeSequenceItem structure', () => {
      const sequenceItem: VisemeSequenceItem = {
        template: { name: 'viseme' },
        ts: [100, 150, 200],
        vs: {
          viseme_aa: [null, 0.8, 0]
        },
        viseme: 'aa',
        time: 100,
        duration: 100
      }

      expect(sequenceItem.template.name).toBe('viseme')
      expect(sequenceItem.ts).toHaveLength(3)
      expect(sequenceItem.vs.viseme_aa).toEqual([null, 0.8, 0])
    })

    it('should support VisemeState structure', () => {
      const state: VisemeState = {
        targets: createEmptyVisemeTarget(),
        dirty: {},
        sequence: []
      }

      expect(state.targets).toBeDefined()
      expect(state.dirty).toBeDefined()
      expect(state.sequence).toBeInstanceOf(Array)
    })

    it('should support WhisperData structure', () => {
      const whisperData: WhisperData = {
        words: ['hello', 'world'],
        wtimes: [0, 1000],
        wdurations: [500, 600]
      }

      expect(whisperData.words).toHaveLength(2)
      expect(whisperData.wtimes).toHaveLength(2)
      expect(whisperData.wdurations).toHaveLength(2)
    })
  })
})
