/**
 * phonemeTiming.ts
 *
 * Real-time text-to-viseme timing engine and audio-text blender.
 *
 * Schedules phonetic viseme transitions based on spoken text and audio duration,
 * and blends acoustic FFT energy with phonetic target shapes for natural lip-sync.
 */

import type { AudioLipSyncState } from './audioLipSync'
import {
  ARKIT_LIP_SYNC_TARGETS,
  VISEME_WEIGHTS,
  type VisemeId,
  type VisemeWeights,
  getVisemeForChar
} from './visemeTable'

export interface TimedViseme {
  viseme: VisemeId
  startTime: number
  endTime: number
  weights: VisemeWeights
}

export class PhonemeTimingEngine {
  private timeline: TimedViseme[] = []
  private totalDuration: number = 0

  /**
   * Set the current spoken utterance and compute its viseme schedule.
   * @param text Spoken plain text
   * @param audioDuration Total audio clip duration in seconds (defaults to ~60ms/char)
   * @param phonemes Optional phoneme string
   */
  setUtterance(text: string, audioDuration?: number, phonemes?: string): void {
    this.timeline = []
    const source = phonemes && phonemes.length > 0 ? phonemes : text
    const cleanChars = source.replace(/\s+/g, ' ').trim().split('')

    if (cleanChars.length === 0) {
      this.totalDuration = 0
      return
    }

    const duration = audioDuration && audioDuration > 0
      ? audioDuration
      : Math.max(0.2, cleanChars.length * 0.065)

    this.totalDuration = duration

    // Relative weight heuristic: vowels take ~1.5x longer than consonants
    const charWeights = cleanChars.map((ch) => {
      const vis = getVisemeForChar(ch)
      if (['AA', 'EE', 'IH', 'OH', 'OO'].includes(vis)) return 1.5
      if (vis === 'sil') return 0.5
      return 1.0
    })

    const sumWeights = charWeights.reduce((a, b) => a + b, 0)
    let currentTime = 0

    for (let i = 0; i < cleanChars.length; i++) {
      const ch = cleanChars[i]
      const vis = getVisemeForChar(ch)
      const charDur = (charWeights[i] / sumWeights) * duration

      this.timeline.push({
        viseme: vis,
        startTime: currentTime,
        endTime: currentTime + charDur,
        weights: VISEME_WEIGHTS[vis]
      })

      currentTime += charDur
    }
  }

  /**
   * Get the active viseme weights for a given playback timestamp (in seconds).
   */
  getActiveViseme(playbackTime: number): VisemeWeights | null {
    if (this.timeline.length === 0 || playbackTime < 0 || playbackTime > this.totalDuration + 0.1) {
      return null
    }

    // Find the matching slot in the timeline
    for (let i = 0; i < this.timeline.length; i++) {
      const item = this.timeline[i]
      if (playbackTime >= item.startTime && playbackTime <= item.endTime) {
        // Interpolate with next slot if near boundary for smooth transition
        const next = this.timeline[i + 1]
        if (next) {
          const itemDur = item.endTime - item.startTime
          const progress = (playbackTime - item.startTime) / itemDur
          if (progress > 0.75) {
            const blendFactor = (progress - 0.75) / 0.25
            return lerpWeights(item.weights, next.weights, blendFactor)
          }
        }
        return item.weights
      }
    }

    return null
  }

  clear(): void {
    this.timeline = []
    this.totalDuration = 0
  }
}

function lerpWeights(a: VisemeWeights, b: VisemeWeights, t: number): VisemeWeights {
  const result: Partial<VisemeWeights> = {}
  for (const key of ARKIT_LIP_SYNC_TARGETS) {
    result[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t
  }
  return result as VisemeWeights
}

/**
 * Blend FFT audio state with text-derived viseme weights into final ARKit morph influences.
 */
export function blendAudioAndText(
  audioState: AudioLipSyncState,
  textWeights: VisemeWeights | null,
  prevWeights: VisemeWeights | null,
  alpha: number = 0.35
): VisemeWeights {
  const result: Partial<VisemeWeights> = {}
  const energy = audioState.energy
  const isSpeaking = audioState.isSpeaking

  if (!isSpeaking && (!textWeights || energy < 0.02)) {
    // Return smoothly to rest
    for (const key of ARKIT_LIP_SYNC_TARGETS) {
      const prevVal = prevWeights ? prevWeights[key] : 0
      result[key] = key === 'mouthClose' ? prevVal + (0.1 - prevVal) * 0.2 : prevVal * 0.6
      if (result[key]! < 0.001) result[key] = 0
    }
    return result as VisemeWeights
  }

  // Base jaw opening driven by combination of audio energy and phonetic jaw target
  const audioJaw = Math.min(1, energy * 1.4 + audioState.lowBand * 0.5)
  const textJaw = textWeights ? textWeights.jawOpen : 0
  const combinedJaw = textWeights ? Math.max(audioJaw * 0.6, textJaw * Math.min(1.2, energy * 2.0)) : audioJaw

  for (const key of ARKIT_LIP_SYNC_TARGETS) {
    let target = 0

    if (key === 'jawOpen') {
      target = combinedJaw
    } else if (textWeights) {
      // Scale phonetic target by current vocal energy
      const baseWeight = textWeights[key] ?? 0
      const energyMultiplier = Math.min(1.3, Math.max(0.4, energy * 2.2))
      target = baseWeight * energyMultiplier

      // Acoustic enhancements for specific frequency signatures
      if (key === 'mouthStretchLeft' || key === 'mouthStretchRight') {
        target = Math.max(target, audioState.midBand * 0.4)
      } else if (key === 'mouthFunnel' || key === 'mouthPucker') {
        target = Math.max(target, audioState.lowBand * 0.35)
      }
    } else {
      // Audio-only fallback (no text available)
      if (key === 'mouthStretchLeft' || key === 'mouthStretchRight') {
        target = audioState.midBand * 0.3
      } else if (key === 'mouthFunnel') {
        target = audioState.lowBand * 0.25
      } else if (key === 'mouthClose') {
        target = energy > 0.05 ? 0 : 0.1
      }
    }

    const prevVal = prevWeights ? prevWeights[key] : 0
    const clampedTarget = Math.min(1, Math.max(0, target))
    result[key] = prevVal + (clampedTarget - prevVal) * alpha
  }

  return result as VisemeWeights
}
