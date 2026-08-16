import { describe, expect, it } from 'vitest'
import { PhonemeTimingEngine, blendAudioAndText } from './phonemeTiming'
import type { AudioLipSyncState } from './audioLipSync'

describe('phonemeTiming', () => {
  it('schedules viseme sequence from text and interpolates playback position', () => {
    const engine = new PhonemeTimingEngine()
    engine.setUtterance('Hello world', 1.0)

    const startViseme = engine.getActiveViseme(0.05)
    expect(startViseme).not.toBeNull()
    expect(startViseme?.jawOpen).toBeDefined()

    const midViseme = engine.getActiveViseme(0.5)
    expect(midViseme).not.toBeNull()

    const pastEnd = engine.getActiveViseme(2.0)
    expect(pastEnd).toBeNull()
  })

  it('blends audio state and phonetic viseme weights cleanly', () => {
    const audioState: AudioLipSyncState = {
      energy: 0.6,
      lowBand: 0.5,
      midBand: 0.4,
      highBand: 0.2,
      isSpeaking: true
    }

    const engine = new PhonemeTimingEngine()
    engine.setUtterance('Hello', 0.5)
    const textWeights = engine.getActiveViseme(0.1)

    const blended = blendAudioAndText(audioState, textWeights, null, 0.5)
    expect(blended.jawOpen).toBeGreaterThan(0.1)
    expect(blended.mouthClose).toBeLessThan(0.3)
  })

  it('decays to neutral mouth state when silent', () => {
    const silentState: AudioLipSyncState = {
      energy: 0.0,
      lowBand: 0.0,
      midBand: 0.0,
      highBand: 0.0,
      isSpeaking: false
    }

    const prevWeights = {
      jawOpen: 0.5,
      mouthClose: 0.0,
      mouthFunnel: 0.0,
      mouthPucker: 0.0,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      mouthStretchLeft: 0.0,
      mouthStretchRight: 0.0,
      mouthRollLower: 0.0,
      mouthRollUpper: 0.0,
      mouthShrugLower: 0.0,
      mouthShrugUpper: 0.0,
      mouthPressLeft: 0.0,
      mouthPressRight: 0.0,
      mouthLowerDownLeft: 0.0,
      mouthLowerDownRight: 0.0,
      mouthUpperUpLeft: 0.0,
      mouthUpperUpRight: 0.0,
      tongueOut: 0.0
    }

    const blended = blendAudioAndText(silentState, null, prevWeights, 0.5)
    expect(blended.jawOpen).toBeLessThan(0.5)
  })
})
