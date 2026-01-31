import type { WhisperData } from './ttsConfig'

/**
 * Generate approximated whisper data from text for visemes
 * This simulates word timing data that would normally come from Whisper ASR
 */
export function approximateWhisperDataFromText(
  text: string,
  speechRate: number = 1.0,
  startTime: number = 0
): WhisperData {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return { words: [], wtimes: [], wdurations: [] }
  }

  const wtimes: number[] = []
  const wdurations: number[] = []

  let currentTime = startTime
  const baseWPM = 150 // words per minute
  const adjustedWPM = baseWPM * speechRate

  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    // More sophisticated duration calculation
    const characterCount = word.length
    const syllableCount = estimateSyllables(word)

    // Base duration on syllables but adjust for character count
    const syllableDuration = ((60 / adjustedWPM) * 1000) / 2 // Half a word time per syllable
    const characterModifier = Math.max(0.5, characterCount / 5) // Longer words take more time

    const duration = syllableCount * syllableDuration * characterModifier

    wtimes.push(currentTime)
    wdurations.push(duration)

    // Variable pause between words based on punctuation and context
    let pauseDuration = 50 + Math.random() * 50 // 50-100ms base pause

    // Add longer pauses for sentence boundaries (simulated)
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
      pauseDuration += 200 + Math.random() * 200
    } else if (word.endsWith(',')) {
      pauseDuration += 100 + Math.random() * 100
    }

    currentTime += duration + pauseDuration
  }

  return {
    words,
    wtimes,
    wdurations
  }
}

/**
 * Estimate syllables in a word (simple heuristic)
 */
function estimateSyllables(word: string): number {
  if (word.length <= 3) return 1

  const vowels = 'aeiouy'
  let syllableCount = 0
  let prevIsVowel = false

  for (let i = 0; i < word.length; i++) {
    const char = word[i].toLowerCase()
    const isVowel = vowels.includes(char)

    if (isVowel && !prevIsVowel) {
      syllableCount++
    }

    prevIsVowel = isVowel
  }

  // Handle silent 'e' at the end
  if (word.endsWith('e') && syllableCount > 1) {
    syllableCount--
  }

  return Math.max(1, syllableCount)
}
