/**
 * LLM Service - Phase 4 Implementation
 * 
 * This service provides a comprehensive LLM integration that supports both local and remote models.
 * It's a direct port from the archive/chat/llm.js implementation with modern React/TypeScript patterns.
 * 
 * Features:
 * - Local LLM support using WebLLM (@mlc-ai/web-llm)
 * - Remote API support (OpenAI, Anthropic, Ollama, etc.)
 * - Streaming responses with "breath" chunking for TTS integration
 * - Barge-in interruption support
 * - System prompt management
 * - Conversation context handling
 * - Environment variable configuration
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

import { useState, useCallback, useRef } from 'react'
import * as webllm from '@mlc-ai/web-llm'
import type {
  LLMConfig,
  LLMResponse,
  LLMState,
  LLMStatusUpdate,
  LLMPerformRequest,
  WebLLMEngine,
  WebLLMStreamChunk,
  WebLLMNonStreamResponse
} from './llmTypes'
import { DEFAULT_LLM_CONFIG, SYSTEM_PROMPT } from './llmTypes'

// Constants from the original implementation
const MIN_BREATH_LENGTH = 20
const selectedModel = "Llama-3.1-8B-Instruct-q4f32_1-MLC"

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
      return ""
    })
  
    return { cleanedResponse, thinkBlocks }
  }

  const load = useCallback(async () => {
    if (state.loading) return
    
    setState(prev => ({ ...prev, loading: true }))
    
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
        setState(prev => ({
          ...prev,
          engine: engine as WebLLMEngine,
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
      const worker = new Worker(
        URL.createObjectURL(new Blob([workerString], { type: 'text/javascript' })),
        { type: 'module' }
      )
      
      const engine = await webllm.CreateWebWorkerMLCEngine(
        worker,
        selectedModel,
        { initProgressCallback }
      )
      
      completed(engine)
    } catch (err) {
      console.error("LLM - worker fetch error", err)
      setState(prev => ({ ...prev, loading: false }))
      
      if (statusCallbackRef.current) {
        statusCallbackRef.current({
          color: 'error',
          text: 'Failed to load model'
        })
      }
    }
  }, [state.loading, state.ready])

  const llmRemote = useCallback(async (userMessage: string, interrupt: number) => {
    const messages = [...state.messages, { role: 'user' as const, content: userMessage }]
    
    const body = JSON.stringify({
      model: config.llm_model || 'gpt-3.5-turbo',
      messages: config.llm_flowise 
        ? undefined 
        : messages.map(msg => ({ role: msg.role, content: msg.content })),
      ...(config.llm_flowise && { question: userMessage })
    })

    console.log("LLM - sending request to remote", body)

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
        console.error("LLM: reasoning error", response)
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
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'user', content: userMessage }, { role: 'assistant', content: cleanedResponse }]
        }))

        // Split response into fragments for TTS
        const fragments = cleanedResponse.split(/[.!?]|,/)
        fragments.forEach(breath => {
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
      console.error("LLM: reasoning catch error - bad remote url?", err)
    }
  }, [state.messages, state._latest_interrupt, config])

  const llmLocal = useCallback(async (userMessage: string, interrupt: number) => {
    if (!state.engine || !state.ready) {
      console.error("LLM: Engine not ready")
      return
    }

    setState(prev => ({ ...prev, thinking: true }))
    
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
        
        console.log("LLM - publishing fragment =", breath, "time =", interrupt)
        breath = fragment.slice(i)
        bcounterRef.current++
      }
    }

    try {
      const messages = [...state.messages, { role: 'user' as const, content: userMessage }]
      
      // Create chat completion request
      const requestMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const asyncChunkGenerator = await state.engine.chat.completions.create({
        messages: requestMessages,
        stream: true
      })

      // Type guard for async iterable
      const isAsyncIterable = (obj: unknown): obj is AsyncIterable<WebLLMStreamChunk> => {
        return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj
      }

      // Handle streaming response
      if (isAsyncIterable(asyncChunkGenerator)) {
        for await (const chunk of asyncChunkGenerator) {
          if (!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
          const content = chunk.choices[0].delta.content
          const finished = chunk.choices[0].finish_reason
          breathHelper(content, finished === 'stop')
        }
      } else {
        // Non-streaming response
        const response = asyncChunkGenerator as WebLLMNonStreamResponse
        const choices = response.choices
        if (choices && choices.length) {
          const content = choices[0].message.content
          const finished = choices[0].finish_reason
          breathHelper(content, finished === 'stop')
        }
      }

      // Get the complete message and add to history
      const paragraph = await state.engine.getMessage()
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'user', content: userMessage }, { role: 'assistant', content: paragraph }],
        thinking: false
      }))

    } catch (err) {
      console.error("LLM: Local reasoning error", err)
      setState(prev => ({ ...prev, thinking: false }))
    }
  }, [state.engine, state.ready, state._latest_interrupt, state.messages])

  const processUserInput = useCallback(async (request: LLMPerformRequest) => {
    // Only process final utterances with bargein enabled
    if (!request.final || !request.bargein) return
    
    const text = request.text?.trim()
    if (!text || !text.length) return

    console.log("LLM - processing user input:", text, "time:", request.interrupt)

    // Stop local reasoning if in progress
    if (state.thinking && state.engine && state.engine.interruptGenerate) {
      console.log("LLM - interrupting previous generation")
      state.engine.interruptGenerate()
      setState(prev => ({ ...prev, thinking: false }))
    }

    // Load local model if needed
    if (config.llm_local && !state.ready && !state.loading) {
      console.log("LLM - loading local model for first use")
      await load()
      return
    }

    // Don't process if we're still loading
    if (state.loading) {
      console.log("LLM - still loading, skipping request")
      return
    }

    // Update latest interrupt timestamp
    setState(prev => ({ ...prev, _latest_interrupt: request.interrupt }))

    console.log("LLM - routing to", config.llm_local ? "local" : "remote", "implementation")
    
    // Route to appropriate LLM implementation
    try {
      if (config.llm_local) {
        if (!state.ready || !state.engine) {
          console.error("LLM - local engine not ready")
          if (statusCallbackRef.current) {
            statusCallbackRef.current({
              color: 'error',
              text: 'Local model not ready'
            })
          }
          return
        }
        await llmLocal(text, request.interrupt)
      } else {
        await llmRemote(text, request.interrupt)
      }
    } catch (error) {
      console.error("LLM - error processing input:", error)
      if (statusCallbackRef.current) {
        statusCallbackRef.current({
          color: 'error',
          text: 'Error processing request'
        })
      }
    }
  }, [state.thinking, state.engine, state.ready, state.loading, config.llm_local, load, llmLocal, llmRemote])

  const updateConfig = useCallback((newConfig: Partial<LLMConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
    console.trace()
  }, [])

  const setStatusCallback = useCallback((callback: (update: LLMStatusUpdate) => void) => {
    statusCallbackRef.current = callback
  }, [])

  const setResponseCallback = useCallback((callback: (response: LLMResponse) => void) => {
    responseCallbackRef.current = callback
  }, [])

  const clearHistory = useCallback(() => {
    setState(prev => ({
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
