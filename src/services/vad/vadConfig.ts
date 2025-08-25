
export interface VADConfig {
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

export const defaultVadConfig: VADConfig = {
  microphoneEnabled: false, // This comes from app state, not config
  vadThreshold: parseFloat(import.meta.env.VITE_VAD_THRESHOLD) || 0.8,
  volume: parseFloat(import.meta.env.VITE_AUDIO_VOLUME) || 1.0,
  vadEnabled: import.meta.env.VITE_VAD_ENABLED !== 'false'
}

