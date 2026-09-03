import type { ResolvedConfig } from '../config.js'

/**
 * Whisper STT adapter — OpenAI-compatible `/v1/audio/transcriptions`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Speech input was `webkitSpeechRecognition`: Chromium-only, and it streams the
 * user's microphone audio to Google. For a product whose entire premise is that
 * nothing leaves your network, that is the wrong default — and it means voice
 * input simply does not work in Firefox or in most XR browsers.
 *
 * The shape is deliberately OpenAI-compatible so one adapter covers
 * faster-whisper, whisper.cpp's server, speaches and vox-box without per-server
 * code.
 */

export interface SttRequest {
  /** 32-bit float PCM mono, as the browser VAD captures it. */
  audio: ArrayBuffer
  sampleRate: number
  language?: string
}

export interface SttResult {
  text: string
}

export interface SttAdapter {
  readonly name: string
  transcribe(req: SttRequest, signal: AbortSignal): Promise<SttResult>
  health(): Promise<{ ok: boolean; detail?: string }>
}

/**
 * Wrap raw float PCM in a WAV container.
 *
 * The VAD hands us bare samples, and every Whisper server expects a decodable
 * container — posting raw floats gets a 400 that says nothing about why. 32-bit
 * float WAV (format 3) avoids a quantisation pass we would only be doing to
 * satisfy the file header.
 */
export function pcmToWav(pcm: ArrayBuffer, sampleRate: number): Uint8Array<ArrayBuffer> {
  const samples = new Float32Array(pcm)
  const dataBytes = samples.length * 4
  const buffer = new ArrayBuffer(44 + dataBytes)
  const out = new Uint8Array(buffer)
  const view = new DataView(buffer)

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 3, true) // IEEE float
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 4, true)
  view.setUint16(32, 4, true)
  view.setUint16(34, 32, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)

  new Float32Array(buffer, 44).set(samples)
  return out
}

export function createWhisperAdapter(cfg: ResolvedConfig): SttAdapter {
  const base = cfg.sttUrl

  return {
    name: 'whisper',

    async transcribe(req: SttRequest, signal: AbortSignal): Promise<SttResult> {
      const wav = pcmToWav(req.audio, req.sampleRate)
      const form = new FormData()
      form.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
      form.append('model', cfg.sttModel)
      if (req.language) form.append('language', req.language)

      let res: Response
      try {
        res = await fetch(`${base}/v1/audio/transcriptions`, { method: 'POST', body: form, signal })
      } catch (err) {
        throw new Error(`whisper request failed: ${(err as Error).message}`)
      }
      if (!res.ok) throw new Error(`whisper responded ${res.status}`)

      const payload = (await res.json()) as { text?: string }
      return { text: typeof payload.text === 'string' ? payload.text.trim() : '' }
    },

    async health() {
      try {
        const res = await fetch(`${base}/v1/models`, { method: 'GET' })
        return { ok: res.ok, detail: `whisper ${res.status}` }
      } catch (err) {
        return { ok: false, detail: `whisper unreachable: ${(err as Error).message}` }
      }
    }
  }
}

export function selectSttUpstream(cfg: ResolvedConfig): SttAdapter {
  return createWhisperAdapter(cfg)
}
