/**
 * @class English lip-sync processor
 * @author Simplified version for testing
 * Adapted for TypeScript and modern avatar system
 */

interface VisemeResult {
  visemes: string[]
  times: number[]
  durations: number[]
}

export class LipsyncEn {
  constructor() {
    // Simplified implementation - using direct letter to viseme mapping
  }

  /**
   * Pre-process text for lipsync
   */
  preProcessText(text: string): string {
    return text.replace(/[^a-zA-Z\s]/g, '').toUpperCase()
  }

  /**
   * Convert words to visemes
   */
  wordsToVisemes(words: string): VisemeResult | null {
    if (!words || words.length === 0) return null

    const cleanWords = this.preProcessText(words)
    if (!cleanWords || cleanWords.length === 0) return null

    // Simplified implementation - convert letters to basic visemes
    const visemes: string[] = []
    const times: number[] = []
    const durations: number[] = []

    let currentTime = 0
    const chars = [...cleanWords]
    
    for (const char of chars) {
      const viseme = this.letterToViseme(char)
      if (viseme) {
        // Merge consecutive identical visemes
        if (visemes.length > 0 && visemes[visemes.length - 1] === viseme) {
          durations[durations.length - 1] += 100 // Extend duration
        } else {
          visemes.push(viseme)
          times.push(currentTime)
          durations.push(150) // Base duration
        }
        currentTime += 100
      } else if (char === ' ') {
        currentTime += 50 // Space pause
      }
    }

    return visemes.length > 0 ? { visemes, times, durations } : null
  }

  private letterToViseme(char: string): string | null {
    // Simple letter to viseme mapping
    const mapping: Record<string, string> = {
      // Vowels
      A: 'aa',
      E: 'E', 
      I: 'I',
      O: 'O',
      U: 'U',
      // Consonants
      P: 'PP',
      B: 'PP',
      M: 'PP',
      F: 'FF',
      V: 'FF',
      W: 'FF',
      T: 'DD',
      D: 'DD',
      TH: 'TH',
      N: 'nn',
      L: 'nn',
      S: 'SS',
      Z: 'SS',
      C: 'SS',
      SH: 'SS',
      K: 'kk',
      G: 'kk',
      Q: 'kk',
      R: 'RR',
      Y: 'I',
      H: 'aa', // Breath sound, use open vowel
      J: 'kk',
      X: 'kk'
    }

    return mapping[char] || null
  }
}
