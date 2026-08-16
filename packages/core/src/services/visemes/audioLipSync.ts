/**
 * audioLipSync.ts
 *
 * Real-time FFT-based lip sync engine.
 *
 * Reads frequency-band energy from a Web Audio AnalyserNode and converts it
 * into normalized mouth-shape parameters that drive the avatar's morph targets.
 *
 * Band layout (tuned for human speech at 24 kHz / 44.1 kHz sample rates):
 *   Low   (  0 –  500 Hz) → fundamental pitch + jaw openness
 *   Mid   (500 – 2500 Hz) → formants F1/F2 → vowel shape / lip stretch
 *   High  (2500 – 8000 Hz) → fricatives, sibilants, plosive bursts
 */

export interface AudioLipSyncState {
  /** Overall vocal energy (0–1). Drives general jaw openness. */
  energy: number
  /** Low-frequency vocal power (0–1). Correlates with voiced phonation. */
  lowBand: number
  /** Mid-frequency formant energy (0–1). Indicates vowel / lip stretch. */
  midBand: number
  /** High-frequency energy (0–1). Indicates fricatives / sibilants. */
  highBand: number
  /** Whether the audio is actively producing speech (above silence threshold). */
  isSpeaking: boolean
}

const SILENCE_THRESHOLD = 0.02
const SMOOTHING_FACTOR = 0.35
const ENERGY_SCALE = 2.5

export class AudioLipSync {
  private analyser: AnalyserNode
  private dataArray: Uint8Array
  private binCount: number
  private sampleRate: number
  private binWidth: number

  private _state: AudioLipSyncState = {
    energy: 0,
    lowBand: 0,
    midBand: 0,
    highBand: 0,
    isSpeaking: false
  }

  private _prev: AudioLipSyncState = {
    energy: 0,
    lowBand: 0,
    midBand: 0,
    highBand: 0,
    isSpeaking: false
  }

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser
    this.binCount = analyser.frequencyBinCount
    this.dataArray = new Uint8Array(this.binCount)
    this.sampleRate = analyser.context?.sampleRate || 44100
    this.binWidth = this.sampleRate / (this.binCount * 2)
  }

  /**
   * Call once per animation frame (inside useFrame).
   * Reads fresh FFT data and returns smoothed lip-sync parameters.
   */
  update(): AudioLipSyncState {
    if (!this.analyser) {
      return this._state
    }

    try {
      this.analyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>)
    } catch {
      return this._state
    }

    const lowEnd = Math.min(Math.floor(500 / this.binWidth), this.binCount)
    const midEnd = Math.min(Math.floor(2500 / this.binWidth), this.binCount)
    const highEnd = Math.min(Math.floor(8000 / this.binWidth), this.binCount)

    let lowSum = 0
    let midSum = 0
    let highSum = 0
    let totalSum = 0

    let lowCount = 0
    let midCount = 0
    let highCount = 0

    for (let i = 0; i < this.binCount && i < highEnd; i++) {
      const val = this.dataArray[i] / 255
      totalSum += val

      if (i < lowEnd) {
        lowSum += val
        lowCount++
      } else if (i < midEnd) {
        midSum += val
        midCount++
      } else {
        highSum += val
        highCount++
      }
    }

    const rawLow = lowCount > 0 ? (lowSum / lowCount) * ENERGY_SCALE : 0
    const rawMid = midCount > 0 ? (midSum / midCount) * ENERGY_SCALE : 0
    const rawHigh = highCount > 0 ? (highSum / highCount) * ENERGY_SCALE : 0
    const rawEnergy = this.binCount > 0
      ? (totalSum / Math.min(this.binCount, highEnd)) * ENERGY_SCALE
      : 0

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

    const energy = clamp01(rawEnergy)
    const lowBand = clamp01(rawLow)
    const midBand = clamp01(rawMid)
    const highBand = clamp01(rawHigh)
    const isSpeaking = energy > SILENCE_THRESHOLD

    const lerp = (prev: number, next: number) => prev + (next - prev) * SMOOTHING_FACTOR

    this._state = {
      energy: lerp(this._prev.energy, energy),
      lowBand: lerp(this._prev.lowBand, lowBand),
      midBand: lerp(this._prev.midBand, midBand),
      highBand: lerp(this._prev.highBand, highBand),
      isSpeaking
    }

    this._prev = { ...this._state }
    return this._state
  }

  get state(): AudioLipSyncState {
    return this._state
  }

  reset(): void {
    const silent: AudioLipSyncState = {
      energy: 0,
      lowBand: 0,
      midBand: 0,
      highBand: 0,
      isSpeaking: false
    }
    this._state = silent
    this._prev = silent
  }
}
