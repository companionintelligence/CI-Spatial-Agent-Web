/**
 * Ollama LLM Implementation
 *
 * This module provides local LLM processing using the Ollama JavaScript library.
 * Handles breath chunking for TTS integration with streaming support.
 */

import { Ollama } from 'ollama/browser'

import type { LLMParams, LLMResult } from '../llmTypes'

const MIN_BREATH_LENGTH = 20

export async function llmOllama(params: LLMParams): Promise<LLMResult> {
  const {
    userMessage,
    interrupt,
    messages,
    llmUrl,
    llmModel = 'llama3.2',
    latestInterrupt,
    responseCallback,
    updateMessages,
    setThinking
  } = params

  if (!llmUrl) {
    return { success: false, error: new Error('Ollama URL is required') }
  }

  setThinking?.(true)

  const rcounter = 1000
  let fragmentCounter = 0
  let fullResponse = ''
  let breath = ''

  const breathHelper = (fragment: string | null = null, finished = false) => {
    if (latestInterrupt > interrupt) {
      console.log('LLM: skipping - work is old', interrupt)
      return
    }

    if (!fragment || !fragment.length || finished) {
      if (fullResponse.length && responseCallback) {
        responseCallback({
          text: fullResponse,
          breath: '',
          ready: true,
          final: true,
          interrupt
        })
        fullResponse = ''
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
          text: fullResponse,
          breath,
          ready: true,
          final: false,
          interrupt,
          rcounter,
          bcounter: fragmentCounter
        })
      }
      breath = ''
      fragmentCounter++
    }
  }

  try {
    const ollama = new Ollama({
      host: llmUrl
    })

    const allMessages = [...messages, { role: 'user' as const, content: userMessage }]

    const requestMessages = allMessages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    console.log('LLM - sending Ollama request to', llmUrl, 'with model', llmModel)

    const response = await ollama.chat({
      model: llmModel,
      messages: requestMessages,
      stream: true
    })

    for await (const chunk of response) {
      if (latestInterrupt > interrupt) {
        console.log('LLM: Ollama request outdated, stopping')
        break
      }

      if (chunk.message?.content) {
        const content = chunk.message.content
        fullResponse += content
        breathHelper(content, chunk.done)
      }
    }

    updateMessages?.(userMessage, fullResponse)
    setThinking?.(false)

    breathHelper(null, true)

    return { success: true, fullResponse }
  } catch (err) {
    console.error('LLM: Ollama reasoning error', err)
    setThinking?.(false)
    return { success: false, error: err as Error }
  }
}
