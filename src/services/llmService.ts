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
import type {
  LLMConfig,
  LLMPerformRequest,
  LLMResponse,
  LLMState,
  LLMStatusUpdate,
  WebLLMStreamChunk
} from './llmTypes'
import { DEFAULT_LLM_CONFIG, SYSTEM_PROMPT } from './llmTypes'

// Constants from the original implementation
const MIN_BREATH_LENGTH = 20
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
  const rcounterRef = useRef(1000)
  const bcounterRef = useRef(0)
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
      const messages = [...state.messages, { role: 'user' as const, content: userMessage }]

      const body = JSON.stringify({
        model: config.llm_model || 'gpt-3.5-turbo',
        messages: config.llm_flowise ? undefined : messages.map((msg) => ({ role: msg.role, content: msg.content })),
        ...(config.llm_flowise && { question: userMessage })
      })

      console.log('LLM - sending request to remote', body)

      const props: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.llm_auth && { Authorization: `Bearer ${config.llm_auth}` })
        },
        body
      }

      try {
        const response = await fetch(config.llm_url!, props)

        if (!response.ok) {
          console.error('LLM: reasoning error', response)
          return
        }

        // Check if this request is still current
        if (interrupt < state._latest_interrupt) return

        rcounterRef.current++
        bcounterRef.current = 0

        const json = await response.json()

        let sentence: string | null = null
        if (json.choices) {
          sentence = json.choices[0].message.content
        } else if (json.text) {
          sentence = json.text
        }

        if (sentence && sentence.length) {
          const { cleanedResponse, thinkBlocks } = processThinkBlocks(sentence)

          if (thinkBlocks.length && statusCallbackRef.current) {
            statusCallbackRef.current({
              color: 'ready',
              text: thinkBlocks.join(' ')
            })
          }

          if (!cleanedResponse || !cleanedResponse.length) return

          // Update messages
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMessage },
              { role: 'assistant', content: cleanedResponse }
            ]
          }))

          // Split response into fragments for TTS
          const fragments = cleanedResponse.split(/[.!?]|,/)
          fragments.forEach((breath) => {
            if (responseCallbackRef.current && breath.trim()) {
              responseCallbackRef.current({
                text: breath,
                breath,
                ready: true,
                final: true,
                interrupt,
                rcounter: rcounterRef.current,
                bcounter: bcounterRef.current
              })
              bcounterRef.current++
            }
          })
        }
      } catch (err) {
        console.error('LLM: reasoning catch error - bad remote url?', err)
      }
    },
    [state.messages, state._latest_interrupt, config]
  )

  const llmOllama = useCallback(
    async (userMessage: string, interrupt: number) => {
      setState((prev) => ({ ...prev, thinking: true }))

      rcounterRef.current++
      bcounterRef.current = 0

      let breath = ''
      const breathHelper = (fragment: string | null = null, finished = false) => {
        if (state._latest_interrupt > interrupt) {
          console.log('LLM: skipping - work is old', interrupt)
          return
        }

        if (!fragment || !fragment.length || finished) {
          if (breath.length && responseCallbackRef.current) {
            responseCallbackRef.current({
              text: breath,
              breath,
              ready: true,
              final: true,
              interrupt
            })
            breath = ''
          }
          return
        }

        const match = fragment.match(/.*?[.,!?]/)
        if (breath.length < MIN_BREATH_LENGTH || !match) {
          breath += fragment
        } else {
          const i = match[0].length
          breath += fragment.slice(0, i)

          if (responseCallbackRef.current) {
            responseCallbackRef.current({
              text: breath,
              breath,
              ready: true,
              final: false,
              interrupt,
              rcounter: rcounterRef.current,
              bcounter: bcounterRef.current
            })
          }

          console.log('LLM - publishing Ollama fragment =', breath, 'time =', interrupt)
          breath = fragment.slice(i)
          bcounterRef.current++
        }
      }

      try {
        const messages = [...state.messages, { role: 'user' as const, content: userMessage }]

        const requestMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content
        }))

        console.log('LLM - sending Ollama request to', config.ollama_url)

        const response = await fetch(config.ollama_url!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.ollama_model || 'llama3.2:3b',
            messages: requestMessages,
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`)
        }

        // Handle streaming response from Ollama
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response stream available')
        }

        const decoder = new TextDecoder()
        let fullResponse = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Check if request is still current
            if (state._latest_interrupt > interrupt) {
              console.log('LLM: Ollama request outdated, stopping')
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.message && data.message.content) {
                  const content = data.message.content
                  fullResponse += content
                  breathHelper(content, data.done)
                }

                if (data.done) {
                  breathHelper(null, true)
                  break
                }
              } catch (parseError) {
                console.warn('Failed to parse Ollama chunk:', line, parseError)
              }
            }
          }

          // Update message history
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: userMessage },
              { role: 'assistant', content: fullResponse }
            ],
            thinking: false
          }))
        } finally {
          reader.releaseLock()
        }
      } catch (err) {
        console.error('LLM: Ollama reasoning error', err)
        setState((prev) => ({ ...prev, thinking: false }))

        // If Ollama fails and we have WebLLM as fallback, try that
        if (state.engine && state.ready) {
          console.log('LLM: Falling back to WebLLM due to Ollama error')
          // Call WebLLM logic directly to avoid circular dependency
          setState((prev) => ({ ...prev, thinking: true }))
          
          try {
            const messages = [...state.messages, { role: 'user' as const, content: userMessage }]
            const requestMessages = messages.map((msg) => ({
              role: msg.role,
              content: msg.content
            }))

            const asyncChunkGenerator = await state.engine.chat.completions.create({
              messages: requestMessages,
              stream: true
            })

            // Handle WebLLM streaming response (simplified for fallback)
            const isAsyncIterable = (obj: unknown): obj is AsyncIterable<WebLLMStreamChunk> => {
              return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj
            }

            if (isAsyncIterable(asyncChunkGenerator)) {
              for await (const chunk of asyncChunkGenerator) {
                if (!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
                const content = chunk.choices[0].delta.content
                const finished = chunk.choices[0].finish_reason
                breathHelper(content, finished === 'stop')
              }
            }

            const paragraph = await state.engine.getMessage()
            setState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: paragraph }
              ],
              thinking: false
            }))
          } catch (fallbackErr) {
            console.error('LLM: WebLLM fallback also failed', fallbackErr)
            setState((prev) => ({ ...prev, thinking: false }))
            throw fallbackErr
          }
        } else {
          throw err // Re-throw if no fallback available
        }
      }
    },
    [state._latest_interrupt, state.messages, config.ollama_url, config.ollama_model, state.engine, state.ready]
  )

  const llmLocal = useCallback(
    async (userMessage: string, interrupt: number) => {
      if (!state.engine || !state.ready) {
        console.error('LLM: Engine not ready')
        return
      }

      setState((prev) => ({ ...prev, thinking: true }))

      rcounterRef.current++
      bcounterRef.current = 0

      let breath = ''
      const breathHelper = (fragment: string | null = null, finished = false) => {
        if (state._latest_interrupt > interrupt) {
          console.log('LLM: skipping - work is old', interrupt)
          return
        }

        if (!fragment || !fragment.length || finished) {
          if (breath.length && responseCallbackRef.current) {
            responseCallbackRef.current({
              text: breath,
              breath,
              ready: true,
              final: true,
              interrupt
            })
            breath = ''
          }
          return
        }

        const match = fragment.match(/.*?[.,!?]/)
        if (breath.length < MIN_BREATH_LENGTH || !match) {
          breath += fragment
        } else {
          const i = match[0].length
          breath += fragment.slice(0, i)

          if (responseCallbackRef.current) {
            responseCallbackRef.current({
              text: breath,
              breath,
              ready: true,
              final: false,
              interrupt,
              rcounter: rcounterRef.current,
              bcounter: bcounterRef.current
            })
          }

          console.log('LLM - publishing fragment =', breath, 'time =', interrupt)
          breath = fragment.slice(i)
          bcounterRef.current++
        }
      }

      try {
        const messages = [...state.messages, { role: 'user' as const, content: userMessage }]

        // Create chat completion request
        const requestMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content
        }))
        console.log('LLM - sending local request', requestMessages)

        const asyncChunkGenerator = await state.engine.chat.completions.create({
          messages: requestMessages,
          stream: true
        })

        console.log(asyncChunkGenerator)

        // Type guard for async iterable
        const isAsyncIterable = (obj: unknown): obj is AsyncIterable<WebLLMStreamChunk> => {
          return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj
        }

        // Handle streaming response
        if (isAsyncIterable(asyncChunkGenerator)) {
          for await (const chunk of asyncChunkGenerator) {
            console.log({ chunk })
            if (!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
            const content = chunk.choices[0].delta.content
            const finished = chunk.choices[0].finish_reason
            breathHelper(content, finished === 'stop')
          }
        } else {
          // Non-streaming response
          const response = asyncChunkGenerator as unknown as webllm.ChatCompletion
          const choices = response.choices
          if (choices && choices.length) {
            const content = choices[0].message.content
            const finished = choices[0].finish_reason
            breathHelper(content, finished === 'stop')
          }
        }

        // Get the complete message and add to history
        const paragraph = await state.engine.getMessage()
        console.log({ paragraph })
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            { role: 'user', content: userMessage },
            { role: 'assistant', content: paragraph }
          ],
          thinking: false
        }))
      } catch (err) {
        console.error('LLM: Local reasoning error', err)
        setState((prev) => ({ ...prev, thinking: false }))
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
            await llmOllama(text, request.interrupt)
          } else if (state.ready && state.engine) {
            console.log('LLM - using WebLLM for local processing')
            await llmLocal(text, request.interrupt)
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
      llmLocal,
      llmRemote,
      llmOllama
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
