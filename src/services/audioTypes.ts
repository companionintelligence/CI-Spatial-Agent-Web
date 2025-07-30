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

export interface TTSConfig {
  voice: string
  speed: number
  pitch: number
  volume: number
  remote: boolean
  apiKey?: string
}

export interface STTConfig {
  language: string
  continuous: boolean
  remote: boolean
  apiKey?: string
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
  remote: false
}

export const defaultSTTConfig: STTConfig = {
  language: 'en-US',
  continuous: true,
  remote: false
}
