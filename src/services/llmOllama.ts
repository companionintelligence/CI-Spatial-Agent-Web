/**
 * Ollama LLM Implementation
 *
 * This module provides local LLM processing using the Ollama JavaScript library.
 * Handles breath chunking for TTS integration with streaming support.
 */

import { Ollama } from 'ollama/browser'
import type { LLMMessage, LLMResponse } from './llmTypes'

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
}

export interface LLMOllamaResult {
  success: boolean
  fullResponse?: string
  error?: Error
}

/**
 * Process user input using Ollama JavaScript library
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
    setThinking
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
    // Initialize Ollama client with custom host
    const ollama = new Ollama({
      host: ollamaUrl
    })

    const allMessages = [...messages, { role: 'user' as const, content: userMessage }]

    // Convert messages to ollama format
    const requestMessages = allMessages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    console.log('LLM - sending Ollama request to', ollamaUrl, 'with model', ollamaModel)

    // Use streaming chat completion
    const response = await ollama.chat({
      model: ollamaModel,
      messages: requestMessages,
      stream: true
    })

    let fullResponse = ''

    // Handle streaming response
    for await (const chunk of response) {
      // Check if request is still current
      if (latestInterrupt > interrupt) {
        console.log('LLM: Ollama request outdated, stopping')
        break
      }

      if (chunk.message?.content) {
        const content = chunk.message.content
        fullResponse += content
        breathHelper(content, chunk.done)
      }

      if (chunk.done) {
        breathHelper(null, true)
        break
      }
    }

    // Update message history
    updateMessages?.(userMessage, fullResponse)
    setThinking?.(false)

    return { success: true, fullResponse }
  } catch (err) {
    console.error('LLM: Ollama reasoning error', err)
    setThinking?.(false)
    return { success: false, error: err as Error }
  }
}
