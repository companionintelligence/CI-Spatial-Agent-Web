// Service-specific configurations driven by environment variables
// Each service has its own dedicated config object

import type { AudioConfigPartial, STTConfigPartial, TTSConfigPartial } from '../services/audioTypes'
import { SYSTEM_PROMPT, type LLMConfig } from '../services/llm/llmTypes'

// Audio service configuration
export const audioConfig: AudioConfigPartial = {
  microphoneEnabled: false, // This comes from app state, not config
  vadThreshold: parseFloat(import.meta.env.VITE_VAD_THRESHOLD) || 0.8,
  volume: parseFloat(import.meta.env.VITE_AUDIO_VOLUME) || 1.0,
  vadEnabled: import.meta.env.VITE_VAD_ENABLED !== 'false'
}

// TTS service configuration
export const ttsConfig: TTSConfigPartial = {
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

// STT service configuration
export const sttConfig: STTConfigPartial = {
  language: import.meta.env.VITE_STT_LANGUAGE || 'en-US',
  continuous: import.meta.env.VITE_STT_CONTINUOUS !== 'false',
  remote: import.meta.env.VITE_STT_REMOTE === 'true',
  apiKey: import.meta.env.VITE_STT_API_KEY
}

// LLM service configuration
export const llmConfig: Partial<LLMConfig> = {
  llm_provider: import.meta.env.VITE_LLM_PROVIDER || 'mlc',
  mlc_model: import.meta.env.VITE_LLM_LOCAL_MODEL || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  ollama_url: import.meta.env.VITE_LLM_OLLAMA_API_URL || '',
  ollama_model: import.meta.env.VITE_LLM_OLLAMA_MODEL || 'gemma3:1b',
  openai_api_key: import.meta.env.VITE_LLM_OPENAI_API_KEY || '',
  openai_api_url: import.meta.env.VITE_LLM_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  openai_model: import.meta.env.VITE_LLM_OPENAI_MODEL || 'gpt-3.5-turbo',
  system_prompt: (import.meta.env.VITE_LLM_SYSTEM_PROMPT || SYSTEM_PROMPT).replace(/\\n/g, '\n')
}

export const config = {
  audio: audioConfig,
  tts: ttsConfig,
  stt: sttConfig,
  llm: llmConfig
}
