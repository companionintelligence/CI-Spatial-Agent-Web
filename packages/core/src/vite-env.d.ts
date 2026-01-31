/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_API_URL?: string
  readonly VITE_CLOUD_LLM_URL?: string
  readonly VITE_CLOUD_LLM_MODEL?: string
  readonly VITE_CLOUD_LLM_AUTH?: string
  readonly VITE_FLOWISE_API_URL?: string
  readonly VITE_FLOWISE_CHATFLOW_ID?: string
  readonly VITE_IS_FLOWISE?: string
  readonly VITE_STT_API_URL?: string
  readonly VITE_STT_API_KEY?: string
  readonly VITE_STT_MODEL?: string
  readonly VITE_STT_LANGUAGE?: string
  readonly VITE_TTS_API_URL?: string
  readonly VITE_TTS_API_KEY?: string
  readonly VITE_TTS_VOICE_ID?: string
  readonly VITE_TTS_SIMILARITY_BOOST?: string
  readonly VITE_TTS_STABILITY?: string
  readonly VITE_TTS_SPEED?: string
  readonly VITE_TTS_MODEL_ID?: string
  readonly VITE_TTS_VOLUME?: string
  readonly VITE_TTS_OPTIMIZE_STREAMING_LATENCY?: string
  readonly VITE_TTS_OUTPUT_FORMAT?: string
  readonly VITE_VAD_THRESHOLD?: string
  readonly VITE_VAD_SAMPLE_RATE?: string
  readonly VITE_VAD_SILENCE_DURATION_MS?: string
  readonly VITE_DIRECTED_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
