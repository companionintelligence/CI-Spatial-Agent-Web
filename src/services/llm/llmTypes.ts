import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMConfig {
  llm_provider?: 'script' | 'mlc' | 'ollama' | 'openai' // | 'flowise' | 'anthropic'
  mlc_model?: string
  ollama_url?: string
  ollama_model?: string
  openai_api_url?: string
  openai_api_key?: string
  openai_model?: string
  system_prompt?: string
}

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

export interface LLMParams {
  userMessage: string
  interrupt: number
  messages: LLMMessage[]
  latestInterrupt: number
  responseCallback?: (response: LLMResponse) => void
  updateMessages?: (userMessage: string, assistantMessage: string) => void
  setThinking?: (thinking: boolean) => void
  statusCallback?: (update: LLMStatusUpdate) => void
  processThinkBlocks?: (input: string) => { cleanedResponse: string; thinkBlocks: string[] }
  engine?: WebWorkerMLCEngine
  llmUrl?: string
  llmModel?: string
  llmAuth?: string
  isFlowise?: boolean
}

export interface LLMResult {
  success: boolean
  fullResponse?: string
  thinkBlocks?: string[]
  error?: Error
}

export const SYSTEM_PROMPT = `You are a helpful AI assistant with a friendly personality. You are embodied as a 3D avatar and can speak your responses out loud.

Key behaviors:
- Keep responses conversational and natural
- Break longer responses into shorter sentences for better speech synthesis
- Be engaging and personable in your interactions
- Respond helpfully to questions and requests
- If someone says "stop", they are interrupting you - acknowledge this briefly

Remember: Your responses will be spoken aloud, so write in a way that sounds natural when spoken.`

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  llm_provider: 'mlc',
  mlc_model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  openai_api_url: 'https://api.openai.com/v1/chat/completions',
  openai_api_key: '',
  openai_model: 'gpt-3.5-turbo',
  // llm_flowise: false,
  ollama_url: '',
  ollama_model: 'gemma3:1b',
  system_prompt: SYSTEM_PROMPT
}

export const AVAILABLE_LOCAL_MODELS = [
  'gemma-2-2b-it-q4f16_1-MLC',
  'Llama-3.1-8B-Instruct-q4f32_1-MLC',
  'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  'SmolLM2-360M-Instruct-q4f16_1-MLC'
]

export const COMMON_REMOTE_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
]

export const COMMON_OLLAMA_MODELS = [
  'llama3.2',
  'llama3.2:1b',
  'llama3.1:8b',
  'llama3.1:70b',
  'mistral:7b',
  'codellama:7b',
  'phi3:3.8b',
  'gemma3:1b',
  'gemma2:2b'
]
