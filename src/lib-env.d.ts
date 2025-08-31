/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAD_THRESHOLD?: string
  readonly VITE_AUDIO_VOLUME?: string
  readonly VITE_VAD_ENABLED?: string
  readonly VITE_STT_ENABLED?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_LLM_ENABLED?: string
  readonly VITE_TTS_ENABLED?: string
  readonly VITE_LLM_PROVIDER?: string
  readonly VITE_LLM_LOCAL_MODEL?: string
  readonly VITE_LLM_OLLAMA_API_URL?: string
  readonly VITE_LLM_OLLAMA_MODEL?: string
  readonly VITE_LLM_STREAM_ENABLED?: string
  readonly VITE_OPENAI_API_URL?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_STT_PROVIDER?: string
  readonly VITE_STT_OPENAI_API_KEY?: string
  readonly VITE_STT_OPENAI_API_URL?: string
  readonly VITE_STT_OPENAI_MODEL?: string
  readonly VITE_TTS_MODE?: string
  readonly VITE_TTS_API_KEY?: string
  readonly VITE_TTS_URL?: string
  readonly VITE_TTS_MODEL?: string
  readonly VITE_TTS_STABILITY?: string
  readonly VITE_TTS_SIMILARITY_BOOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}