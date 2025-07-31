/**
 * LLM Service - Phase 4 Implementation
 *
 * This service provides a comprehensive LLM integration that supports both local and remote models.
 * It's a direct port from the archive/chat/llm.js implementation with modern React/TypeScript patterns.
 *
 * Features:
 * - Local LLM support using Ollama (preferred) or WebLLM fallback
 * - Remote API support (OpenAI, Anthropic, etc.)
 * - Streaming responses with "breath" chunking for TTS integration
 * - Barge-in interruption support
 * - System prompt management
 * - Conversation context handling
 * - Environment variable configuration
 *
 * Local LLM Priority:
 * 1. Ollama (if VITE_OLLAMA_API_URL is configured)
 * 2. WebLLM (as fallback if Ollama unavailable)
 *
 * Key behaviors matching the archive implementation:
 * - Breaks responses into natural speech chunks (MIN_BREATH_LENGTH)
 * - Supports interrupt timestamps for barge-in
 * - Processes <think> blocks from models like DeepSeek
 * - Maintains conversation history with system prompts
 * - Web worker implementation for local models
 *
 * Integration points:
 * - Connects to TTS service for speaking responses
 * - Integrates with chat service for message history
 * - Responds to app config changes (local vs cloud mode)
 * - Provides status callbacks for UI updates
 */

import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import * as webllm from '@mlc-ai/web-llm'
import { useCallback, useRef, useState } from 'react'
import { llmCloud } from './llmCloud'
import { llmLocal } from './llmLocal'
import { llmOllama } from './llmOllama'
import type { LLMConfig, LLMPerformRequest, LLMResponse, LLMState, LLMStatusUpdate } from './llmTypes'
import { DEFAULT_LLM_CONFIG, SYSTEM_PROMPT } from './llmTypes'

// Constants from the original implementation
const selectedModel = 'Llama-3.2-3B-Instruct-q4f16_1-MLC'

// Worker string for WebLLM
const workerString = `
import * as webllm from 'https://esm.run/@mlc-ai/web-llm';
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => { handler.onmessage(msg); };
`

export const useLLMService = () => {
  const [state, setState] = useState<LLMState>({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    thinking: false,
    ready: false,
    loading: false,
    selectedModel,
    engine: null,
    _latest_interrupt: 0
  })

  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const statusCallbackRef = useRef<((update: LLMStatusUpdate) => void) | null>(null)
  const responseCallbackRef = useRef<((response: LLMResponse) => void) | null>(null)

  const processThinkBlocks = (input: string) => {
    const thinkBlocks: string[] = []

    const cleanedResponse = input.replace(/<think>(.*?)<\/think>/gs, (_, content) => {
      thinkBlocks.push(content.trim())
      return ''
    })

    return { cleanedResponse, thinkBlocks }
  }

  const load = useCallback(async () => {
    if (state.loading) return

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const initProgressCallback = (status: { text: string }) => {
        if (statusCallbackRef.current) {
          statusCallbackRef.current({
            color: state.ready ? 'ready' : 'loading',
            text: status.text
          })
        }
      }

      const completed = (engine: unknown) => {
        setState((prev) => ({
          ...prev,
          engine: engine as WebWorkerMLCEngine,
          ready: true,
          loading: false
        }))

        if (statusCallbackRef.current) {
          statusCallbackRef.current({
            color: 'ready',
            text: 'Ready'
          })
        }
      }

      if (statusCallbackRef.current) {
        statusCallbackRef.current({
          color: state.ready ? 'ready' : 'loading',
          text: `Loading local model ${selectedModel}`
        })
      }

      // Use web worker approach for better performance
      const worker = new Worker(URL.createObjectURL(new Blob([workerString], { type: 'text/javascript' })), {
        type: 'module'
      })

      const engine = await webllm.CreateWebWorkerMLCEngine(worker, selectedModel, { initProgressCallback })

      completed(engine)
    } catch (err) {
      console.error('LLM - worker fetch error', err)
      setState((prev) => ({ ...prev, loading: false }))

      if (statusCallbackRef.current) {
        statusCallbackRef.current({
          color: 'error',
          text: 'Failed to load model'
        })
      }
    }
  }, [state.loading, state.ready])

  const llmRemote = useCallback(
    async (userMessage: string, interrupt: number) => {
      const result = await llmCloud({
        userMessage,
        interrupt,
        messages: state.messages,
        llmUrl: config.llm_url!,
        llmModel: config.llm_model,
        llmAuth: config.llm_auth,
        isFlowise: config.llm_flowise,
        latestInterrupt: state._latest_interrupt,
        responseCallback: responseCallbackRef.current || undefined,
        updateMessages: (userMsg, assistantMsg) => {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMsg },
              { role: 'assistant', content: assistantMsg }
            ]
          }))
        },
        processThinkBlocks,
        statusCallback: statusCallbackRef.current || undefined
      })

      if (!result.success && result.error) {
        console.error('LLM: Remote reasoning failed:', result.error)
      }
    },
    [state.messages, state._latest_interrupt, config]
  )

  const llmOllamaWrapper = useCallback(
    async (userMessage: string, interrupt: number) => {
      const result = await llmOllama({
        userMessage,
        interrupt,
        messages: state.messages,
        ollamaUrl: config.ollama_url!,
        ollamaModel: config.ollama_model,
        latestInterrupt: state._latest_interrupt,
        responseCallback: responseCallbackRef.current || undefined,
        updateMessages: (userMsg, assistantMsg) => {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMsg },
              { role: 'assistant', content: assistantMsg }
            ]
          }))
        },
        setThinking: (thinking) => {
          setState((prev) => ({ ...prev, thinking }))
        }
      })

      if (!result.success && result.error) {
        console.error('LLM: Ollama reasoning failed:', result.error)
      }
    },
    [state._latest_interrupt, state.messages, config.ollama_url, config.ollama_model]
  )

  const llmLocalWrapper = useCallback(
    async (userMessage: string, interrupt: number) => {
      if (!state.engine || !state.ready) {
        console.error('LLM: Engine not ready')
        return
      }

      const result = await llmLocal({
        userMessage,
        interrupt,
        messages: state.messages,
        engine: state.engine,
        latestInterrupt: state._latest_interrupt,
        responseCallback: responseCallbackRef.current || undefined,
        updateMessages: (userMsg, assistantMsg) => {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMsg },
              { role: 'assistant', content: assistantMsg }
            ]
          }))
        },
        setThinking: (thinking) => {
          setState((prev) => ({ ...prev, thinking }))
        }
      })

      if (!result.success && result.error) {
        console.error('LLM: Local reasoning failed:', result.error)
      }
    },
    [state.engine, state.ready, state._latest_interrupt, state.messages]
  )

  const processUserInput = useCallback(
    async (request: LLMPerformRequest) => {
      // Only process final utterances with bargein enabled
      if (!request.final || !request.bargein) return

      const text = request.text?.trim()
      if (!text || !text.length) return

      console.log('LLM - processing user input:', text, 'time:', request.interrupt)

      // Stop local reasoning if in progress
      if (state.thinking && state.engine && state.engine.interruptGenerate) {
        console.log('LLM - interrupting previous generation')
        state.engine.interruptGenerate()
        setState((prev) => ({ ...prev, thinking: false }))
      }

      // Load local model if needed (only for WebLLM, Ollama doesn't need loading)
      if (config.llm_local && !config.ollama_url && !state.ready && !state.loading) {
        console.log('LLM - loading WebLLM model for first use')
        await load()
        return
      }

      // Don't process if we're still loading (only relevant for WebLLM)
      if (state.loading) {
        console.log('LLM - still loading WebLLM, skipping request')
        return
      }

      // Update latest interrupt timestamp
      setState((prev) => ({ ...prev, _latest_interrupt: request.interrupt }))

      console.log('LLM - routing to', config.llm_local ? 'local' : 'remote', 'implementation')

      // Route to appropriate LLM implementation
      try {
        if (config.llm_local) {
          // Check if Ollama is configured and available
          if (config.ollama_url && config.ollama_url.trim()) {
            console.log('LLM - using Ollama for local processing')
            await llmOllamaWrapper(text, request.interrupt)
          } else if (state.ready && state.engine) {
            console.log('LLM - using WebLLM for local processing')
            await llmLocalWrapper(text, request.interrupt)
          } else {
            console.error('LLM - no local options available')
            if (statusCallbackRef.current) {
              statusCallbackRef.current({
                color: 'error',
                text: 'No local LLM options configured'
              })
            }
            return
          }
        } else {
          await llmRemote(text, request.interrupt)
        }
      } catch (error) {
        console.error('LLM - error processing input:', error)
        if (statusCallbackRef.current) {
          statusCallbackRef.current({
            color: 'error',
            text: 'Error processing request'
          })
        }
      }
    },
    [
      state.thinking,
      state.engine,
      state.ready,
      state.loading,
      config.llm_local,
      config.ollama_url,
      load,
      llmLocalWrapper,
      llmRemote,
      llmOllamaWrapper
    ]
  )

  const updateConfig = useCallback((newConfig: Partial<LLMConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }))
  }, [])

  const setStatusCallback = useCallback((callback: (update: LLMStatusUpdate) => void) => {
    statusCallbackRef.current = callback
  }, [])

  const setResponseCallback = useCallback((callback: (response: LLMResponse) => void) => {
    responseCallbackRef.current = callback
  }, [])

  const clearHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }]
    }))
  }, [])

  return {
    state,
    config,
    actions: {
      load,
      processUserInput,
      updateConfig,
      setStatusCallback,
      setResponseCallback,
      clearHistory
    }
  }
}
