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
 * - Connects to local TTS service for speaking responses (remote TTS not yet implemented)
 * - Integrates with chat service for message history
 * - Responds to app config changes (local vs cloud mode)
 * - Provides status callbacks for UI updates
 */

import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import * as webllm from '@mlc-ai/web-llm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { llmCloud } from './models/llmCloud'
import { llmDirected } from './models/llmDirected'
import { llmLocal } from './models/llmLocal'
import { llmOllama } from './models/llmOllama'
import { defaultLLMConfig, type LLMConfig, SYSTEM_PROMPT } from './llmConfig'
import type { LLMStatusUpdate, LLMResponse, LLMState, LLMPerformRequest } from './llmTypes'

// Constants from the original implementation
const selectedModel = 'Llama-3.2-3B-Instruct-q4f16_1-MLC'

// Worker string for WebLLM
const workerString = `
import * as webllm from 'https://esm.run/@mlc-ai/web-llm';
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => { handler.onmessage(msg); };
`

type LLMServiceProps = {
  config?: Partial<LLMConfig>
  onStatus?: (update: LLMStatusUpdate) => void
  onResponse?: (response: LLMResponse) => void
}

export const useLLMService = ({ config: configPartial = {}, onStatus, onResponse }: LLMServiceProps) => {
  const config = useMemo(() => ({ ...defaultLLMConfig, ...configPartial }), [configPartial])
  const [state, setState] = useState<LLMState>({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    thinking: false,
    ready: false,
    loading: false,
    selectedModel,
    engine: null,
    _latest_interrupt: 0
  })

  const initializedRef = useRef(false)

  const processThinkBlocks = useCallback((input: string) => {
    const thinkBlocks: string[] = []

    const cleanedResponse = input.replace(/<think>(.*?)<\/think>/gs, (_, content) => {
      thinkBlocks.push(content.trim())
      return ''
    })

    return { cleanedResponse, thinkBlocks }
  }, [])

  const load = useCallback(async () => {
    if (config.llm_provider !== 'mlc' || !config.mlc_model) return
    if (state.loading) return

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const initProgressCallback = (status: { text: string }) => {
        if (onStatus) {
          onStatus({
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

        if (onStatus) {
          onStatus({
            color: 'ready',
            text: 'Ready'
          })
        }
      }

      if (onStatus) {
        onStatus({
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

      if (onStatus) {
        onStatus({
          color: 'error',
          text: 'Failed to load model'
        })
      }
    }
  }, [config.llm_provider, config.mlc_model, state.loading, state.ready, onStatus])

  // Initialize function that starts loading the LLM
  const initialize = useCallback(async () => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Determine which mode to use and set ready state
    if (config.llm_provider === 'script') {
      setState((prev) => ({ ...prev, ready: true }))
    } else if (config.llm_provider === 'ollama' && config.ollama_url) {
      setState((prev) => ({ ...prev, ready: true }))
    } else if (config.llm_provider === 'mlc' && config.mlc_model) {
      await load()
    } else if (
      config.llm_provider === 'openai' &&
      config.openai_api_key &&
      config.openai_api_url &&
      config.openai_model
    ) {
      setState((prev) => ({ ...prev, ready: true }))
    }
  }, [
    config.llm_provider,
    config.mlc_model,
    config.ollama_url,
    config.openai_api_key,
    config.openai_api_url,
    config.openai_model,
    load
  ])

  // Auto-initialize when the service is created
  useEffect(() => {
    // Small delay to ensure the service is fully mounted
    const timer = setTimeout(() => {
      initialize()
    }, 100)

    return () => clearTimeout(timer)
  }, [initialize])

  const processUserInput = useCallback(
    async (request: LLMPerformRequest) => {
      if (!request.final || !request.bargein) return

      const text = request.text?.trim()
      if (!text || !text.length) return

      // Early return if loading or not ready
      if (state.loading || !state.ready) {
        return
      }

      // Handle interruptions
      if (state.thinking && state.engine?.interruptGenerate) {
        state.engine.interruptGenerate()
        setState((prev) => ({ ...prev, thinking: false }))
      }

      setState((prev) => ({ ...prev, _latest_interrupt: request.interrupt }))

      const baseParams = {
        userMessage: text,
        interrupt: request.interrupt,
        messages: state.messages,
        latestInterrupt: state._latest_interrupt,
        responseCallback: onResponse,
        updateMessages: (userMsg: string, assistantMsg: string) => {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMsg },
              { role: 'assistant', content: assistantMsg }
            ]
          }))
        },
        setThinking: (thinking: boolean) => {
          setState((prev) => ({ ...prev, thinking }))
        },
        statusCallback: onStatus,
        processThinkBlocks
      }

      try {
        // Route to appropriate LLM based on config
        if (config.llm_provider === 'script') {
          const result = await llmDirected(baseParams)
          if (!result.success && result.error) {
            console.error('LLM: Directed reasoning failed:', result.error)
          }
        } else if (config.llm_provider === 'ollama' && config.ollama_model) {
          const result = await llmOllama({
            ...baseParams,
            llmUrl: config.ollama_url,
            llmModel: config.ollama_model
          })
          if (!result.success && result.error) {
            console.error('LLM: Ollama reasoning failed:', result.error)
          }
        } else if (config.llm_provider === 'mlc' && config.mlc_model && state.engine) {
          const result = await llmLocal({
            ...baseParams,
            engine: state.engine
          })
          if (!result.success && result.error) {
            console.error('LLM: Local reasoning failed:', result.error)
          }
        } else if (
          config.llm_provider === 'openai' &&
          config.openai_api_key &&
          config.openai_api_url &&
          config.openai_model
        ) {
          // Use cloud API for OpenAI
          const result = await llmCloud({
            ...baseParams,
            llmModel: config.openai_model,
            llmAuth: config.openai_api_key,
            llmUrl: config.openai_api_url
          })
          if (!result.success && result.error) {
            console.error('LLM: Remote reasoning failed:', result.error)
          }
        } else {
          console.error('LLM: Unsupported provider or missing configuration', config.llm_provider)
          if (onStatus) {
            onStatus({
              color: 'error',
              text: 'Unsupported LLM provider or missing configuration'
            })
          }
        }
      } catch (error) {
        console.error('LLM - error processing input:', error)
        onStatus?.({
          color: 'error',
          text: 'Error processing request'
        })
      }
    },
    [
      state.loading,
      state.ready,
      state.thinking,
      state.engine,
      state.messages,
      state._latest_interrupt,
      onResponse,
      onStatus,
      processThinkBlocks,
      config.llm_provider,
      config.ollama_model,
      config.mlc_model,
      config.openai_api_key,
      config.openai_api_url,
      config.openai_model,
      config.ollama_url
    ]
  )

  const clearHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }]
    }))
  }, [])

  return {
    state,
    actions: {
      load,
      processUserInput,
      clearHistory
    }
  }
}
