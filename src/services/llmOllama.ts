/**
 * Ollama LLM Implementation
 *
 * This module provides local LLM processing using Ollama API with streaming support.
 * Handles breath chunking for TTS integration and includes WebLLM fallback.
 */

import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type { LLMMessage, LLMResponse, WebLLMStreamChunk } from './llmTypes'

// Constants
const MIN_BREATH_LENGTH = 20

export interface LLMOllamaParams {
  userMessage: string
  interrupt: number
  messages: LLMMessage[]
  ollamaUrl: string
  ollamaModel?: string
  latestInterrupt: number
  responseCallback?: (response: LLMResponse) => void
  updateMessages?: (userMessage: string, assistantMessage: string) => void
  setThinking?: (thinking: boolean) => void
  // WebLLM fallback parameters
  webllmEngine?: WebWorkerMLCEngine | null
  webllmReady?: boolean
}

export interface LLMOllamaResult {
  success: boolean
  fullResponse?: string
  error?: Error
  usedFallback?: boolean
}

/**
 * Process user input using Ollama API with optional WebLLM fallback
 */
export async function llmOllama(params: LLMOllamaParams): Promise<LLMOllamaResult> {
  const {
    userMessage,
    interrupt,
    messages,
    ollamaUrl,
    ollamaModel = 'llama3.2',
    latestInterrupt,
    responseCallback,
    updateMessages,
    setThinking,
    webllmEngine,
    webllmReady
  } = params

  setThinking?.(true)

  const rcounter = 1000
  let bcounter = 0
  let breath = ''

  const breathHelper = (fragment: string | null = null, finished = false) => {
    if (latestInterrupt > interrupt) {
      console.log('LLM: skipping - work is old', interrupt)
      return
    }

    if (!fragment || !fragment.length || finished) {
      if (breath.length && responseCallback) {
        responseCallback({
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

      if (responseCallback) {
        responseCallback({
          text: breath,
          breath,
          ready: true,
          final: false,
          interrupt,
          rcounter,
          bcounter
        })
      }

      console.log('LLM - publishing Ollama fragment =', breath, 'time =', interrupt)
      breath = fragment.slice(i)
      bcounter++
    }
  }

  try {
    const allMessages = [...messages, { role: 'user' as const, content: userMessage }]

    const requestMessages = allMessages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    console.log('LLM - sending Ollama request to', ollamaUrl)

    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ollamaModel,
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
        if (latestInterrupt > interrupt) {
          console.log('LLM: Ollama request outdated, stopping')
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        // remove 'data: ' prefix if present`
        const chunkCleaned = chunk.replace(/^data: /, '').trim()
        const lines = chunkCleaned.split('\n').filter((line) => line.trim())
        console.log(chunk, lines)

        for (const line of lines) {
          try {
            if (line === '[DONE]') {
              breathHelper(null, true)
              break
            }
            const data = JSON.parse(line)
            console.log('Ollama chunk data:', data)
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
      updateMessages?.(userMessage, fullResponse)
      setThinking?.(false)

      return { success: true, fullResponse }
    } finally {
      reader.releaseLock()
    }
  } catch (err) {
    console.error('LLM: Ollama reasoning error', err)
    setThinking?.(false)

    // If Ollama fails and we have WebLLM as fallback, try that
    if (webllmEngine && webllmReady) {
      console.log('LLM: Falling back to WebLLM due to Ollama error')

      try {
        setThinking?.(true)

        const allMessages = [...messages, { role: 'user' as const, content: userMessage }]
        const requestMessages = allMessages.map((msg) => ({
          role: msg.role,
          content: msg.content
        }))

        const asyncChunkGenerator = await webllmEngine.chat.completions.create({
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

        const paragraph = await webllmEngine.getMessage()
        updateMessages?.(userMessage, paragraph)
        setThinking?.(false)

        return { success: true, fullResponse: paragraph, usedFallback: true }
      } catch (fallbackErr) {
        console.error('LLM: WebLLM fallback also failed', fallbackErr)
        setThinking?.(false)
        return { success: false, error: fallbackErr as Error }
      }
    } else {
      return { success: false, error: err as Error }
    }
  }
}
