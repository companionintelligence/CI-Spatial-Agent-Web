import { createSimpleStore } from "@hexafield/simple-store"

export interface WhisperConfig {
    model: string
    language?: string
    quantized: boolean
    multilingual: boolean
  }
  
// Whisper data interface for visemes
export interface WhisperData {
    words?: string[]
    wtimes?: number[]
    wdurations?: number[]
}

export const defaultWhisperConfig: WhisperConfig = {
model: 'Xenova/whisper-tiny',
language: 'en',
quantized: true,
multilingual: false
}

  
export interface TTSConfig {
    voice: string
    speed: number
    pitch: number
    volume: number
    mode: 'browser' | 'local' | 'remote' // browser = speechSynthesis API, local = vits-web worker, remote = API call
    apiKey?: string
    url?: string
    model?: string
    voiceSettings?: {
      stability?: number
      similarity_boost?: number
    }
  }
  
  export const defaultTTSConfig: TTSConfig = {
    voice: import.meta.env.VITE_TTS_VOICE || 'en_US-hfc_female-medium',
    speed: parseFloat(import.meta.env.VITE_TTS_SPEED) || 1.0,
    pitch: parseFloat(import.meta.env.VITE_TTS_PITCH) || 1.0,
    volume: parseFloat(import.meta.env.VITE_TTS_VOLUME) || 1.0,
    mode: import.meta.env.VITE_TTS_MODE || 'browser', // 'browser', 'local' or 'remote'
    apiKey: import.meta.env.VITE_TTS_API_KEY,
    url: import.meta.env.VITE_TTS_URL || 'https://api.openai.com/v1/audio/speech',
    model: import.meta.env.VITE_TTS_MODEL || 'tts-1',
    voiceSettings: {
      stability: parseFloat(import.meta.env.VITE_TTS_STABILITY) || 0.5,
      similarity_boost: parseFloat(import.meta.env.VITE_TTS_SIMILARITY_BOOST) || 0.8
    }
  }

  