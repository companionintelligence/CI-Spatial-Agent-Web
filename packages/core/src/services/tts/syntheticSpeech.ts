/**
 * Deterministic speech-like PCM for render probes.
 *
 * This is not a user-facing TTS engine. It creates a small, voiced waveform so
 * the production AudioContext -> AnalyserNode -> AudioLipSync path can be tested
 * in a browser without downloading a model or contacting a TTS server.
 */

export interface SyntheticSpeechOptions {
  duration?: number
  sampleRate?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export function syntheticSpeechDuration(text: string): number {
  const normalized = text.trim()
  return clamp(0.7 + normalized.length * 0.052, 0.7, 12)
}

/**
 * Produce a mono 16-bit PCM WAV with deterministic vowel/consonant-like energy
 * changes. The spectrum intentionally spans low, mid, and high bands because
 * AudioLipSync reads those bands to shape jaw, lips, brows, and cheeks.
 */
export function createSyntheticSpeechWav(text: string, options: SyntheticSpeechOptions = {}): ArrayBuffer {
  const sampleRate = options.sampleRate ?? 24000
  const duration = options.duration ?? syntheticSpeechDuration(text)
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate))
  const dataBytes = frameCount * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  const normalized = text.trim() || 'hello'
  const phraseRate = 3.8 + Math.min(2.4, normalized.length / 30)
  const seed = [...normalized].reduce((total, char) => total + char.charCodeAt(0), 0)

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate
    const phrase = 0.55 + 0.45 * Math.sin(time * Math.PI * 2 * phraseRate + seed * 0.013)
    const syllable = 0.68 + 0.32 * Math.sin(time * Math.PI * 2 * 7.2 + seed * 0.007)
    const attack = Math.min(1, time * 20)
    const release = Math.min(1, (duration - time) * 18)
    const envelope = Math.max(0, phrase * syllable * attack * release)
    const fundamental = 145 + (seed % 45) + Math.sin(time * 1.7) * 8
    const voiced =
      Math.sin(time * Math.PI * 2 * fundamental) * 0.42 +
      Math.sin(time * Math.PI * 2 * fundamental * 2.01) * 0.2 +
      Math.sin(time * Math.PI * 2 * fundamental * 3.03) * 0.11
    const formant = Math.sin(time * Math.PI * 2 * 920) * 0.08
    const fricative = Math.sin(time * Math.PI * 2 * 4300) * 0.035 * (0.4 + 0.6 * syllable)
    const sample = clamp((voiced + formant + fricative) * envelope * 0.72, -0.92, 0.92)
    view.setInt16(44 + frame * 2, Math.round(sample * 32767), true)
  }

  return buffer
}
