import { beforeEach, describe, expect, it } from 'vitest'

import { LipsyncEn } from './lipsyncEn'

describe('LipsyncEn Number-to-Text Conversion', () => {
  let lipsync: LipsyncEn

  beforeEach(() => {
    lipsync = new LipsyncEn()
  })

  describe('fullTextProcessing', () => {
    describe('Basic number conversion', () => {
      it('should convert single digits', () => {
        expect(lipsync.fullTextProcessing('0')).toBe('ZERO')
        expect(lipsync.fullTextProcessing('1')).toBe('ONE')
        expect(lipsync.fullTextProcessing('5')).toBe('FIVE')
        expect(lipsync.fullTextProcessing('9')).toBe('NINE')
      })

      it('should convert teens', () => {
        expect(lipsync.fullTextProcessing('10')).toBe('TEN')
        expect(lipsync.fullTextProcessing('11')).toBe('ELEVEN')
        expect(lipsync.fullTextProcessing('13')).toBe('THIRTEEN')
        expect(lipsync.fullTextProcessing('15')).toBe('FIFTEEN')
        expect(lipsync.fullTextProcessing('19')).toBe('NINETEEN')
      })

      it('should convert tens', () => {
        expect(lipsync.fullTextProcessing('20')).toBe('TWENTY')
        expect(lipsync.fullTextProcessing('30')).toBe('THIRTY')
        expect(lipsync.fullTextProcessing('50')).toBe('FIFTY')
        expect(lipsync.fullTextProcessing('90')).toBe('NINETY')
      })

      it('should convert tens with ones', () => {
        expect(lipsync.fullTextProcessing('21')).toBe('TWENTY ONE')
        expect(lipsync.fullTextProcessing('35')).toBe('THIRTY FIVE')
        expect(lipsync.fullTextProcessing('47')).toBe('FORTY SEVEN')
        expect(lipsync.fullTextProcessing('99')).toBe('NINETY NINE')
      })
    })

    describe('Hundreds conversion', () => {
      it('should convert even hundreds', () => {
        expect(lipsync.fullTextProcessing('100')).toBe('ONE HUNDRED')
        expect(lipsync.fullTextProcessing('200')).toBe('TWO HUNDRED')
        expect(lipsync.fullTextProcessing('500')).toBe('FIVE HUNDRED')
        expect(lipsync.fullTextProcessing('900')).toBe('NINE HUNDRED')
      })

      it('should convert hundreds with tens and ones', () => {
        expect(lipsync.fullTextProcessing('101')).toBe('ONE HUNDRED ONE')
        expect(lipsync.fullTextProcessing('234')).toBe('TWO HUNDRED THIRTY FOUR')
        expect(lipsync.fullTextProcessing('567')).toBe('FIVE HUNDRED SIXTY SEVEN')
        expect(lipsync.fullTextProcessing('999')).toBe('NINE HUNDRED NINETY NINE')
      })
    })

    describe('Thousands conversion', () => {
      it('should convert even thousands', () => {
        expect(lipsync.fullTextProcessing('1000')).toBe('ONE THOUSAND')
        expect(lipsync.fullTextProcessing('2000')).toBe('TWO THOUSAND')
        expect(lipsync.fullTextProcessing('5000')).toBe('FIVE THOUSAND')
      })

      it('should convert thousands with remainder', () => {
        expect(lipsync.fullTextProcessing('1001')).toBe('ONE THOUSAND ONE')
        expect(lipsync.fullTextProcessing('1234')).toBe('ONE THOUSAND TWO HUNDRED THIRTY FOUR')
        expect(lipsync.fullTextProcessing('9999')).toBe('NINE THOUSAND NINE HUNDRED NINETY NINE')
      })
    })

    describe('Millions conversion', () => {
      it('should convert even millions', () => {
        expect(lipsync.fullTextProcessing('1000000')).toBe('ONE MILLION')
        expect(lipsync.fullTextProcessing('2000000')).toBe('TWO MILLION')
        expect(lipsync.fullTextProcessing('5000000')).toBe('FIVE MILLION')
      })

      it('should convert millions with remainder', () => {
        expect(lipsync.fullTextProcessing('1000001')).toBe('ONE MILLION ONE')
        expect(lipsync.fullTextProcessing('1234567')).toBe(
          'ONE MILLION TWO HUNDRED THIRTY FOUR THOUSAND FIVE HUNDRED SIXTY SEVEN'
        )
        expect(lipsync.fullTextProcessing('2500000')).toBe('TWO MILLION FIVE HUNDRED THOUSAND')
      })
    })

    describe('Special number handling', () => {
      it('should convert area codes digit by digit', () => {
        expect(lipsync.fullTextProcessing('555')).toBe('FIVE FIVE FIVE')
        expect(lipsync.fullTextProcessing('415')).toBe('FOUR ONE FIVE')
        expect(lipsync.fullTextProcessing('212')).toBe('TWO ONE TWO')
      })

      it('should convert zip codes digit by digit', () => {
        expect(lipsync.fullTextProcessing('90210')).toBe('NINE OH TWO ONE OH')
        expect(lipsync.fullTextProcessing('12345')).toBe('ONE TWO THREE FOUR FIVE')
      })

      it('should convert years as sets of two', () => {
        expect(lipsync.fullTextProcessing('1985')).toBe('NINETEEN EIGHTY FIVE')
        expect(lipsync.fullTextProcessing('1999')).toBe('NINETEEN NINETY NINE')
        expect(lipsync.fullTextProcessing('2010')).toBe('TWO THOUSAND TEN')
        expect(lipsync.fullTextProcessing('2024')).toBe('TWENTY TWENTY FOUR')
      })
    })

    describe('Decimal numbers', () => {
      it('should convert decimal points', () => {
        expect(lipsync.fullTextProcessing('3.14')).toBe('THREE POINT FOURTEEN')
        expect(lipsync.fullTextProcessing('0.5')).toBe('ZERO POINT FIVE')
        expect(lipsync.fullTextProcessing('99.99')).toBe('NINETY NINE POINT NINETY NINE')
      })

      it('should handle comma separators as decimal points', () => {
        expect(lipsync.fullTextProcessing('3,14')).toBe('THREE POINT FOURTEEN')
        expect(lipsync.fullTextProcessing('2,5')).toBe('TWO POINT FIVE')
      })
    })

    describe('Currency and symbols', () => {
      it('should convert currency symbols', () => {
        expect(lipsync.fullTextProcessing('$5')).toBe('DOLLARS FIVE')
        expect(lipsync.fullTextProcessing('€10')).toBe('EUROS TEN')
        expect(lipsync.fullTextProcessing('$1.99')).toBe('DOLLARS ONE POINT NINETY NINE')
      })

      it('should convert mathematical symbols', () => {
        expect(lipsync.fullTextProcessing('5 + 3')).toBe('FIVE PLUS THREE')
        expect(lipsync.fullTextProcessing('50%')).toBe('FIFTY PERCENT')
        expect(lipsync.fullTextProcessing('A & B')).toBe('A AND B')
      })
    })

    describe('Mixed text and numbers', () => {
      it('should handle sentences with numbers', () => {
        expect(lipsync.fullTextProcessing('I have 5 cats')).toBe('I HAVE FIVE CATS')
        expect(lipsync.fullTextProcessing('Call me at 555-1234')).toBe('CALL ME AT FIVE FIVE FIVE ONE TWO THREE FOUR')
        expect(lipsync.fullTextProcessing('Born in 1990')).toBe('BORN IN NINETEEN NINETY')
      })

      it('should handle multiple numbers', () => {
        expect(lipsync.fullTextProcessing('1 + 1 = 2')).toBe('ONE PLUS ONE EQUALS TWO')
        expect(lipsync.fullTextProcessing('$5.99 & $3.50')).toBe(
          'DOLLARS FIVE POINT NINETY NINE AND DOLLARS THREE POINT FIFTY'
        )
      })
    })

    describe('Edge cases', () => {
      it('should handle empty strings', () => {
        expect(lipsync.fullTextProcessing('')).toBe('')
      })

      it('should handle text without numbers', () => {
        expect(lipsync.fullTextProcessing('Hello World')).toBe('HELLO WORLD')
      })

      it('should handle special characters', () => {
        expect(lipsync.fullTextProcessing('Hello, World! How are you?')).toBe('HELLO WORLD HOW ARE YOU')
      })

      it('should handle excessive spaces', () => {
        expect(lipsync.fullTextProcessing('Hello    World   123')).toBe('HELLO WORLD ONE HUNDRED TWENTY THREE')
      })
    })
  })

  describe('preProcessText with number conversion', () => {
    it('should use fullTextProcessing when includeNumbers is true', () => {
      expect(lipsync.preProcessText('I have 5 cats', true)).toBe('I HAVE FIVE CATS')
      expect(lipsync.preProcessText('$10.99', true)).toBe('DOLLARS TEN POINT NINETY NINE')
    })

    it('should use basic processing when includeNumbers is false (default)', () => {
      expect(lipsync.preProcessText('I have 5 cats')).toBe('I HAVE CATS')
      expect(lipsync.preProcessText('$10.99')).toBe('DOLLARS')
    })

    it('should maintain backward compatibility', () => {
      // These tests ensure existing behavior is preserved
      expect(lipsync.preProcessText('hello123!@# world')).toBe('HELLO WORLD')
      expect(lipsync.preProcessText('hello  world')).toBe('HELLO  WORLD')
    })
  })

  describe('Integration with wordsToVisemes', () => {
    it('should convert numbers and produce visemes', () => {
      // First test with number conversion disabled (current behavior)
      const resultBasic = lipsync.wordsToVisemes('I have 5 cats')
      expect(resultBasic?.words).toBe('I HAVE CATS')

      // Test that we can process numbers separately if needed
      const numberText = lipsync.fullTextProcessing('5')
      expect(numberText).toBe('FIVE')

      const resultNumber = lipsync.wordsToVisemes(numberText)
      expect(resultNumber?.words).toBe('FIVE')
      expect(resultNumber?.visemes).toContain('FF') // F sound
      expect(resultNumber?.visemes).toContain('aa') // I sound (AI -> aa)
      expect(resultNumber?.visemes).toContain('FF') // V sound
    })

    it('should handle complex number conversion scenarios', () => {
      const complexText = lipsync.fullTextProcessing('Call 911 for help')
      expect(complexText).toBe('CALL NINE ONE ONE FOR HELP')

      const result = lipsync.wordsToVisemes(complexText)
      expect(result?.words).toBe('CALL NINE ONE ONE FOR HELP')
      expect(result?.visemes.length).toBeGreaterThan(10)
    })
  })

  describe('Performance with large numbers', () => {
    it('should handle large numbers efficiently', () => {
      const start = performance.now()

      const results = [
        lipsync.fullTextProcessing('999999999'),
        lipsync.fullTextProcessing('123456789'),
        lipsync.fullTextProcessing('1000000000')
      ]

      const end = performance.now()
      const duration = end - start

      expect(duration).toBeLessThan(50) // Should complete in under 50ms

      expect(results[0]).toBe(
        'NINE HUNDRED NINETY NINE MILLION NINE HUNDRED NINETY NINE THOUSAND NINE HUNDRED NINETY NINE'
      )
      expect(results[1]).toBe(
        'ONE HUNDRED TWENTY THREE MILLION FOUR HUNDRED FIFTY SIX THOUSAND SEVEN HUNDRED EIGHTY NINE'
      )
      expect(results[2]).toBe('ONE BILLION')
    })
  })
})
