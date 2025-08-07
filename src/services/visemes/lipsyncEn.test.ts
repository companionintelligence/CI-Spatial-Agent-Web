import { beforeEach, describe, expect, it } from 'vitest'

import { LipsyncEn } from './lipsyncEn'

describe('LipsyncEn', () => {
  let lipsync: LipsyncEn

  beforeEach(() => {
    lipsync = new LipsyncEn()
  })

  describe('preProcessText', () => {
    it('should convert text to uppercase', () => {
      expect(lipsync.preProcessText('hello')).toBe('HELLO')
    })

    it('should remove non-alphabetic characters except spaces', () => {
      expect(lipsync.preProcessText('hello123!@# world')).toBe('HELLO WORLD')
    })

    it('should handle empty string', () => {
      expect(lipsync.preProcessText('')).toBe('')
    })

    it('should preserve spaces', () => {
      expect(lipsync.preProcessText('hello world')).toBe('HELLO WORLD')
    })

    it('should handle multiple spaces', () => {
      expect(lipsync.preProcessText('hello  world')).toBe('HELLO  WORLD')
    })
  })

  describe('wordsToVisemes', () => {
    it('should return null for empty input', () => {
      expect(lipsync.wordsToVisemes('')).toBe(null)
    })

    it('should return null for null input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(lipsync.wordsToVisemes(null as any)).toBe(null)
    })

    it('should return null for undefined input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(lipsync.wordsToVisemes(undefined as any)).toBe(null)
    })

    it('should convert simple words to visemes', () => {
      const result = lipsync.wordsToVisemes('HELLO')

      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes).toBeDefined()
        expect(result.times).toBeDefined()
        expect(result.durations).toBeDefined()
        expect(result.visemes.length).toBeGreaterThan(0)
        expect(result.times.length).toBe(result.visemes.length)
        expect(result.durations.length).toBe(result.visemes.length)
      }
    })

    it('should produce valid viseme names', () => {
      const result = lipsync.wordsToVisemes('HELLO')

      if (result) {
        const validVisemes = ['aa', 'E', 'I', 'O', 'U', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR']

        result.visemes.forEach((viseme) => {
          expect(validVisemes).toContain(viseme)
        })
      }
    })

    it('should handle common English words correctly', () => {
      const testWords = ['THE', 'AND', 'IS', 'TO', 'OF']

      testWords.forEach((word) => {
        const result = lipsync.wordsToVisemes(word)
        expect(result).not.toBe(null)
        if (result) {
          expect(result.visemes.length).toBeGreaterThan(0)
        }
      })
    })

    it('should produce sequential times', () => {
      const result = lipsync.wordsToVisemes('HELLO')

      if (result && result.times.length > 1) {
        for (let i = 1; i < result.times.length; i++) {
          expect(result.times[i]).toBeGreaterThanOrEqual(result.times[i - 1])
        }
      }
    })

    it('should produce positive durations', () => {
      const result = lipsync.wordsToVisemes('HELLO')

      if (result) {
        result.durations.forEach((duration) => {
          expect(duration).toBeGreaterThan(0)
        })
      }
    })
  })

  describe('phoneme to viseme mapping', () => {
    it('should handle vowel phonemes', () => {
      const vowelWords = ['A', 'E', 'I', 'O', 'U']

      vowelWords.forEach((word) => {
        const result = lipsync.wordsToVisemes(word)
        expect(result).not.toBe(null)
        if (result) {
          expect(result.visemes.length).toBeGreaterThan(0)
        }
      })
    })

    it('should handle consonant phonemes', () => {
      const consonantWords = ['P', 'B', 'T', 'D', 'K', 'G']

      consonantWords.forEach((word) => {
        const result = lipsync.wordsToVisemes(word)
        expect(result).not.toBe(null)
        if (result) {
          expect(result.visemes.length).toBeGreaterThan(0)
        }
      })
    })

    it('should handle complex words', () => {
      const complexWords = ['THROUGH', 'THOUGHT', 'NIGHT', 'LIGHT', 'RIGHT']

      complexWords.forEach((word) => {
        const result = lipsync.wordsToVisemes(word)
        expect(result).not.toBe(null)
        if (result) {
          expect(result.visemes.length).toBeGreaterThan(0)
        }
      })
    })
  })

  describe('edge cases', () => {
    it('should handle single letter words', () => {
      const result = lipsync.wordsToVisemes('I')
      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })

    it('should handle repeated letters', () => {
      const result = lipsync.wordsToVisemes('BOOK')
      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })

    it('should handle words with silent letters', () => {
      const result = lipsync.wordsToVisemes('KNOW')
      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })
  })
})
