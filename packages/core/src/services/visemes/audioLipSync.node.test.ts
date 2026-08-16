import { describe, expect, it } from 'vitest'
import { AudioLipSync } from './audioLipSync'

describe('AudioLipSync', () => {
  it('initializes with zero state and handles dummy analyser', () => {
    const mockContext = { sampleRate: 44100 }
    const mockAnalyser = {
      frequencyBinCount: 128,
      context: mockContext,
      getByteFrequencyData: (arr: Uint8Array) => {
        // fill with mock speech energy
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i < 20 ? 180 : 20
        }
      }
    } as unknown as AnalyserNode

    const lipSync = new AudioLipSync(mockAnalyser)
    expect(lipSync.state.isSpeaking).toBe(false)

    const updated = lipSync.update()
    expect(updated.energy).toBeGreaterThan(0)
    expect(updated.lowBand).toBeGreaterThan(0)
    expect(updated.isSpeaking).toBe(true)

    lipSync.reset()
    expect(lipSync.state.isSpeaking).toBe(false)
    expect(lipSync.state.energy).toBe(0)
  })
})
