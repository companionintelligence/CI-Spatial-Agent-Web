import { createSimpleStore } from "@hexafield/simple-store"

export interface STTConfig {
  language: string
  continuous: boolean
  remote: boolean
  apiKey?: string
}

// Whisper-specific configuration

// STT result interface for consistency across services
export interface STTResult {
  text: string
  confidence: number
  final: boolean
  interim?: boolean
  timestamp?: number
}

export const defaultSTTConfig: STTConfig = {
  language: import.meta.env.VITE_STT_LANGUAGE || 'en-US',
  continuous: import.meta.env.VITE_STT_CONTINUOUS !== 'false',
  remote: import.meta.env.VITE_STT_REMOTE === 'true',
  apiKey: import.meta.env.VITE_STT_API_KEY
}

