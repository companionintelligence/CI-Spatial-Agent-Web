import { createSimpleStore } from "@hexafield/simple-store"

export const SYSTEM_PROMPT = `You are a helpful AI assistant with a friendly personality. You are embodied as a 3D avatar and can speak your responses out loud.

Key behaviors:
- Keep responses conversational and natural
- Break longer responses into shorter sentences for better speech synthesis
- Be engaging and personable in your interactions
- Respond helpfully to questions and requests
- If someone says "stop", they are interrupting you - acknowledge this briefly

Remember: Your responses will be spoken aloud, so write in a way that sounds natural when spoken.`

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



  export const defaultLLMConfig: LLMConfig = {
    llm_provider: import.meta.env.VITE_LLM_PROVIDER || 'mlc',
    mlc_model: import.meta.env.VITE_LLM_LOCAL_MODEL || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    ollama_url: import.meta.env.VITE_LLM_OLLAMA_API_URL || '',
    ollama_model: import.meta.env.VITE_LLM_OLLAMA_MODEL || 'gemma3:1b',
    openai_api_key: import.meta.env.VITE_LLM_OPENAI_API_KEY || '',
    openai_api_url: import.meta.env.VITE_LLM_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    openai_model: import.meta.env.VITE_LLM_OPENAI_MODEL || 'gpt-3.5-turbo',
    system_prompt: (import.meta.env.VITE_LLM_SYSTEM_PROMPT || SYSTEM_PROMPT).replace(/\\n/g, '\n')
  }
