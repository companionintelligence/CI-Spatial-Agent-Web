import { defaultVisemeConfig, type VisemeConfig } from '../config/visemeConfig'
import type { LipsyncResult, VisemeSequenceItem, WhisperData } from '../visemeTypes'
import { LipsyncEn } from './lipsyncEn'

const lipsync = { en: new LipsyncEn() }

export function lipsyncPreProcessText(text: string, lang: string = 'en'): string {
  const processor = lipsync[lang as keyof typeof lipsync] || lipsync.en
  return processor.preProcessText(text, true)
}

export function lipsyncWordsToVisemes(words: string, lang: string = 'en') {
  const processor = lipsync[lang as keyof typeof lipsync] || lipsync.en
  return processor.wordsToVisemes(words)
}

function convertRange(value: number, fromRange: [number, number], toRange: [number, number]): number {
  const [fromMin, fromMax] = fromRange
  const [toMin, toMax] = toRange
  const fromSpan = fromMax - fromMin
  const toSpan = toMax - toMin
  const scaled = (value - fromMin) / fromSpan
  return toMin + scaled * toSpan
}

export function lipsyncConvert(
  whisperData: WhisperData,
  lipsyncLang: string = 'en',
  config: VisemeConfig = defaultVisemeConfig
): LipsyncResult {
  const result: LipsyncResult = {}

  // If visemes were not specified, generate based on the word timing data from whisper
  if (whisperData.words && whisperData.wtimes && whisperData.wdurations) {
    const lipsyncAnim: VisemeSequenceItem[] = []

    for (let i = 0; i < whisperData.words.length; i++) {
      const word = whisperData.words[i]
      const time = whisperData.wtimes[i]
      let duration = whisperData.wdurations[i]

      if (!word || !word.length) continue

      const preprocessedWord = lipsyncPreProcessText(word, lipsyncLang)
      const visemeData = lipsyncWordsToVisemes(preprocessedWord, lipsyncLang)

      if (visemeData && visemeData.visemes && visemeData.visemes.length) {
        const totalDuration =
          visemeData.times[visemeData.visemes.length - 1] + visemeData.durations[visemeData.visemes.length - 1]

        const overdrive = Math.min(duration, Math.max(0, duration - visemeData.visemes.length * 150))
        const level = config.lipsync.baseLevel + convertRange(overdrive, [0, duration], [0, config.lipsync.levelRange])
        duration = Math.min(duration, visemeData.visemes.length * 200)

        if (totalDuration > 0) {
          for (let j = 0; j < visemeData.visemes.length; j++) {
            const t = time + (visemeData.times[j] / totalDuration) * duration
            const d = (visemeData.durations[j] / totalDuration) * duration
            const viseme = visemeData.visemes[j]

            // Use configurable special viseme intensities
            const specialIntensity =
              viseme === 'PP'
                ? config.lipsync.specialVisemes.PP
                : viseme === 'FF'
                ? config.lipsync.specialVisemes.FF
                : level

            lipsyncAnim.push({
              template: { name: 'viseme' },
              ts: [t - Math.min(60, (2 * d) / 3), t + Math.min(25, d / 2), t + d + Math.min(60, d / 2)],
              vs: {
                // CHANGE: Remove "viseme_" prefix - use viseme name directly
                [`viseme_${viseme}`]: [null, specialIntensity, 0] // was: [`viseme_${viseme}`]: [null, specialIntensity, 0]
              },
              viseme,
              time,
              duration
            })
          }
        }
      }
    }

    if (lipsyncAnim.length) {
      result.anim = lipsyncAnim
    }
  }

  return result
}
