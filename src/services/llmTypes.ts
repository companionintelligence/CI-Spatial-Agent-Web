import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMConfig {
  llm_local: boolean
  llm_model?: string
  llm_url?: string
  llm_auth?: string
  llm_flowise?: boolean
  ollama_url?: string
  ollama_model?: string
}

// WebLLM response interfaces
export interface WebLLMStreamChunk {
  choices: Array<{
    delta: {
      content?: string
    }
    finish_reason?: string
  }>
}

export interface WebLLMNonStreamResponse {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason?: string
  }>
}

export type WebLLMResponse = AsyncIterable<WebLLMStreamChunk> & WebLLMNonStreamResponse

// WebLLM Engine interface for type safety
export interface WebLLMEngine {
  chat: {
    completions: {
      create: (params: {
        messages: Array<{ role: string; content: string }>
        stream?: boolean
      }) => Promise<WebLLMResponse>
    }
  }
  getMessage: () => Promise<string>
  interruptGenerate?: () => void
}

export interface LLMState {
  messages: LLMMessage[]
  thinking: boolean
  ready: boolean
  loading: boolean
  selectedModel: string
  engine: WebWorkerMLCEngine | null
  _latest_interrupt: number
}

export interface LLMResponse {
  text: string
  breath: string
  ready: boolean
  final: boolean
  interrupt: number
  rcounter?: number
  bcounter?: number
}

export interface LLMStatusUpdate {
  color: 'ready' | 'loading' | 'error'
  text: string
}

export interface LLMPerformRequest {
  text: string
  human: boolean
  final: boolean
  bargein: boolean
  interrupt: number
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  llm_local: import.meta.env.VITE_LOCAL_LLM_ENABLED !== 'false',
  llm_model: import.meta.env.VITE_DEFAULT_LOCAL_MODEL || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  llm_url: import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  llm_auth: import.meta.env.VITE_OPENAI_API_KEY || '',
  llm_flowise: false,
  ollama_url: import.meta.env.VITE_OLLAMA_API_URL || '',
  ollama_model: import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2:3b'
}

// Available local models (matching archive implementation)
export const AVAILABLE_LOCAL_MODELS = [
  'gemma-2-2b-it-q4f16_1-MLC',
  'Llama-3.1-8B-Instruct-q4f32_1-MLC',
  'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  'SmolLM2-360M-Instruct-q4f16_1-MLC'
]

// Common remote models
export const COMMON_REMOTE_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
]

// Common Ollama models
export const COMMON_OLLAMA_MODELS = [
  'llama3.2:3b',
  'llama3.2:1b',
  'llama3.1:8b',
  'llama3.1:70b',
  'mistral:7b',
  'codellama:7b',
  'phi3:3.8b',
  'gemma2:2b'
]

export const SYSTEM_PROMPT = `You are a helpful AI assistant with a friendly personality. You are embodied as a 3D avatar and can speak your responses out loud.

Key behaviors:
- Keep responses conversational and natural
- Break longer responses into shorter sentences for better speech synthesis
- Be engaging and personable in your interactions
- Respond helpfully to questions and requests
- If someone says "stop", they are interrupting you - acknowledge this briefly

Remember: Your responses will be spoken aloud, so write in a way that sounds natural when spoken.`
