export interface AudioConfig {
  microphoneEnabled: boolean
  vadThreshold: number
  volume: number
  vadEnabled: boolean
}

export interface VADResult {
  isSpeech: boolean
  confidence: number
  audio?: ArrayBuffer
}

// Whisper data interface for visemes
export interface WhisperData {
  words?: string[]
  wtimes?: number[]
  wdurations?: number[]
}

export interface TTSConfig {
  voice: string
  speed: number
  pitch: number
  volume: number
  remote: boolean
  apiKey?: string
  url?: string
  model?: string
  voiceSettings?: {
    stability?: number
    similarity_boost?: number
  }
}

export interface STTConfig {
  language: string
  continuous: boolean
  remote: boolean
  apiKey?: string
}

// Whisper-specific configuration
export interface WhisperConfig {
  model: string
  language?: string
  quantized: boolean
  multilingual: boolean
}

// STT result interface for consistency across services
export interface STTResult {
  text: string
  confidence: number
  final: boolean
  interim?: boolean
  timestamp?: number
}

export const defaultAudioConfig: AudioConfig = {
  microphoneEnabled: false,
  vadThreshold: 0.8,
  volume: 1.0,
  vadEnabled: true
}

export const defaultTTSConfig: TTSConfig = {
  voice: 'en_US-hfc_female-medium',
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  remote: false,
  url: 'https://api.openai.com/v1/audio/speech',
  model: 'tts-1',
  voiceSettings: {
    stability: 0.5,
    similarity_boost: 0.8
  }
}

export const defaultSTTConfig: STTConfig = {
  language: 'en-US',
  continuous: true,
  remote: false
}

export const defaultWhisperConfig: WhisperConfig = {
  model: 'Xenova/whisper-tiny',
  language: 'en',
  quantized: true,
  multilingual: false
}
