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
import { llmCloud } from './llmCloud'
import { llmDirected } from './llmDirected'
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

type LLMServiceProps = {
  config?: Partial<LLMConfig>
  onStatus?: (update: LLMStatusUpdate) => void
  onResponse?: (response: LLMResponse) => void
}

export const useLLMService = ({ config: configPartial = {}, onStatus, onResponse }: LLMServiceProps) => {
  const config = useMemo(() => ({ ...DEFAULT_LLM_CONFIG, ...configPartial }), [configPartial])
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
  }, [state.loading, state.ready, onStatus])

  // Initialize function that starts loading the LLM
  const initialize = useCallback(async () => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Determine which mode to use and set ready state
    if (config.directed_mode) {
      setState((prev) => ({ ...prev, ready: true }))
    } else if (config.llm_local && config.ollama_url) {
      setState((prev) => ({ ...prev, ready: true }))
    } else if (!config.llm_local) {
      setState((prev) => ({ ...prev, ready: true }))
    } else if (config.llm_local && !config.ollama_url && !state.ready && !state.loading) {
      await load()
    }
  }, [config.llm_local, config.ollama_url, config.directed_mode, state.ready, state.loading, load])

  // Auto-initialize when the service is created
  useEffect(() => {
    // Small delay to ensure the service is fully mounted
    const timer = setTimeout(() => {
      initialize()
    }, 100)

    return () => clearTimeout(timer)
  }, [initialize])

  // Re-initialize when config changes
  useEffect(() => {
    if (initializedRef.current) {
      console.log('LLM: Config changed, re-initializing...')
      initialize()
    }
  }, [config.llm_local, config.ollama_url, config.directed_mode, initialize])

  const processUserInput = useCallback(
    async (request: LLMPerformRequest) => {
      if (!request.final || !request.bargein) return

      const text = request.text?.trim()
      if (!text || !text.length) return

      // Early return if loading or not ready
      if (state.loading || (!config.directed_mode && !state.ready)) {
        if (config.llm_local && !config.ollama_url && !state.ready && !state.loading) {
          await load()
        }
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
        if (config.directed_mode) {
          const result = await llmDirected(baseParams)
          if (!result.success && result.error) {
            console.error('LLM: Directed reasoning failed:', result.error)
          }
        } else if (config.llm_local) {
          if (config.ollama_url?.trim()) {
            const result = await llmOllama({
              ...baseParams,
              llmUrl: config.ollama_url,
              llmModel: config.ollama_model
            })
            if (!result.success && result.error) {
              console.error('LLM: Ollama reasoning failed:', result.error)
            }
          } else if (state.engine) {
            const result = await llmLocal({
              ...baseParams,
              engine: state.engine
            })
            if (!result.success && result.error) {
              console.error('LLM: Local reasoning failed:', result.error)
            }
          } else {
            console.error('LLM - no local options available')
            onStatus?.({
              color: 'error',
              text: 'No local LLM options configured'
            })
          }
        } else {
          const result = await llmCloud({
            ...baseParams,
            llmUrl: config.llm_url!,
            llmModel: config.llm_model,
            llmAuth: config.llm_auth,
            isFlowise: config.llm_flowise
          })
          if (!result.success && result.error) {
            console.error('LLM: Remote reasoning failed:', result.error)
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
      config.directed_mode,
      config.llm_local,
      config.ollama_url,
      config.ollama_model,
      config.llm_url,
      config.llm_model,
      config.llm_auth,
      config.llm_flowise,
      onResponse,
      onStatus,
      processThinkBlocks,
      load
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
      initialize,
      processUserInput,
      clearHistory
    }
  }
}
