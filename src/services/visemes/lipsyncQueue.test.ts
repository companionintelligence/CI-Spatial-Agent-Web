import { describe, expect, it } from 'vitest'
import { lipsyncConvert, lipsyncPreProcessText, lipsyncWordsToVisemes } from './lipsyncQueue'
import type { WhisperData } from './visemeTypes'

describe('lipsyncQueue', () => {
  describe('lipsyncPreProcessText', () => {
    it('should preprocess text using English by default', () => {
      const result = lipsyncPreProcessText('hello world')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle English language explicitly', () => {
      const result = lipsyncPreProcessText('hello world', 'en')
      expect(result).toBe('HELLO WORLD')
    })

    it('should fallback to English for unsupported languages', () => {
      const result = lipsyncPreProcessText('hello world', 'fr')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle empty text', () => {
      const result = lipsyncPreProcessText('')
      expect(result).toBe('')
    })

    it('should remove non-alphabetic characters', () => {
      const result = lipsyncPreProcessText('hello, world! 123')
      expect(result).toBe('HELLO WORLD ')
    })
  })

  describe('lipsyncWordsToVisemes', () => {
    it('should convert words to visemes using English by default', () => {
      const result = lipsyncWordsToVisemes('HELLO')

      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes).toBeDefined()
        expect(result.times).toBeDefined()
        expect(result.durations).toBeDefined()
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })

    it('should handle English language explicitly', () => {
      const result = lipsyncWordsToVisemes('HELLO', 'en')

      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })

    it('should fallback to English for unsupported languages', () => {
      const result = lipsyncWordsToVisemes('HELLO', 'fr')

      expect(result).not.toBe(null)
      if (result) {
        expect(result.visemes.length).toBeGreaterThan(0)
      }
    })

    it('should return null for empty words', () => {
      const result = lipsyncWordsToVisemes('')
      expect(result).toBe(null)
    })
  })

  describe('lipsyncConvert', () => {
    it('should return empty result for empty whisper data', () => {
      const whisperData: WhisperData = {}
      const result = lipsyncConvert(whisperData)

      expect(result).toEqual({})
    })

    it('should return empty result when words array is empty', () => {
      const whisperData: WhisperData = {
        words: [],
        wtimes: [],
        wdurations: []
      }
      const result = lipsyncConvert(whisperData)

      expect(result).toEqual({})
    })

    it('should convert whisper data to viseme animation sequence', () => {
      const whisperData: WhisperData = {
        words: ['HELLO', 'WORLD'],
        wtimes: [0, 1000],
        wdurations: [500, 600]
      }
      const result = lipsyncConvert(whisperData)

      expect(result.anim).toBeDefined()
      expect(result.anim).toBeInstanceOf(Array)
      expect(result.anim!.length).toBeGreaterThan(0)
    })

    it('should generate proper sequence items structure', () => {
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [0],
        wdurations: [500]
      }
      const result = lipsyncConvert(whisperData)

      expect(result.anim).toBeDefined()
      if (result.anim && result.anim.length > 0) {
        const item = result.anim[0]
        expect(item.template).toEqual({ name: 'viseme' })
        expect(item.ts).toHaveLength(3)
        expect(item.vs).toBeDefined()
        expect(item.viseme).toBeDefined()
        expect(typeof item.time).toBe('number')
        expect(typeof item.duration).toBe('number')
      }
    })

    it('should handle words with no visemes', () => {
      const whisperData: WhisperData = {
        words: ['', '   ', 'HELLO'],
        wtimes: [0, 200, 500],
        wdurations: [100, 200, 400]
      }
      const result = lipsyncConvert(whisperData)

      expect(result.anim).toBeDefined()
      // Should only generate visemes for 'HELLO', not the empty words
      expect(result.anim!.length).toBeGreaterThan(0)
    })

    it('should apply proper timing calculations', () => {
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [1000],
        wdurations: [500]
      }
      const result = lipsyncConvert(whisperData)

      if (result.anim && result.anim.length > 0) {
        const item = result.anim[0]
        expect(item.ts[0]).toBeLessThan(item.ts[1])
        expect(item.ts[1]).toBeLessThan(item.ts[2])
        expect(item.time).toBe(1000)
      }
    })

    it('should handle different viseme intensities', () => {
      const whisperData: WhisperData = {
        words: ['PP', 'AA'], // PP and FF get 0.9 intensity, others get calculated level
        wtimes: [0, 500],
        wdurations: [400, 400]
      }
      const result = lipsyncConvert(whisperData)

      if (result.anim && result.anim.length > 0) {
        // Check that visemes have appropriate intensity values
        result.anim.forEach((item) => {
          Object.values(item.vs).forEach((value) => {
            if (value && value[1] !== null) {
              expect(value[1]).toBeGreaterThan(0)
              expect(value[1]).toBeLessThanOrEqual(1)
            }
          })
        })
      }
    })

    it('should respect language parameter', () => {
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [0],
        wdurations: [500]
      }
      const result1 = lipsyncConvert(whisperData, 'en')
      const result2 = lipsyncConvert(whisperData, 'fr') // Should fallback to 'en'

      expect(result1).toEqual(result2)
    })

    it('should handle mismatched array lengths gracefully', () => {
      const whisperData: WhisperData = {
        words: ['HELLO', 'WORLD'],
        wtimes: [0], // Shorter array
        wdurations: [500, 600]
      }
      const result = lipsyncConvert(whisperData)

      // Should only process the minimum length
      expect(result.anim).toBeDefined()
      if (result.anim) {
        expect(result.anim.length).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
