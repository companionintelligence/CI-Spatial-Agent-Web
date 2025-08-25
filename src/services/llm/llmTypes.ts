import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
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



