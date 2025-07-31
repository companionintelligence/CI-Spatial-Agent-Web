/**
 * Cloud/Remote LLM Implementation
 *
 * This module provides remote LLM processing for services like OpenAI, Anthropic, etc.
 * Supports both standard chat completions and Flowise integration.
 */

import type { LLMMessage, LLMResponse } from './llmTypes'

export interface LLMCloudParams {
  userMessage: string
  interrupt: number
  messages: LLMMessage[]
  llmUrl: string
  llmModel?: string
  llmAuth?: string
  isFlowise?: boolean
  latestInterrupt: number
  responseCallback?: (response: LLMResponse) => void
  updateMessages?: (userMessage: string, assistantMessage: string) => void
  processThinkBlocks?: (input: string) => { cleanedResponse: string; thinkBlocks: string[] }
  statusCallback?: (update: { color: 'ready' | 'loading' | 'error'; text: string }) => void
}

export interface LLMCloudResult {
  success: boolean
  fullResponse?: string
  thinkBlocks?: string[]
  error?: Error
}

/**
 * Process think blocks from models like DeepSeek
 */
function defaultProcessThinkBlocks(input: string) {
  const thinkBlocks: string[] = []

  const cleanedResponse = input.replace(/<think>(.*?)<\/think>/gs, (_, content) => {
    thinkBlocks.push(content.trim())
    return ''
  })

  return { cleanedResponse, thinkBlocks }
}

/**
 * Process user input using remote/cloud LLM API
 */
export async function llmCloud(params: LLMCloudParams): Promise<LLMCloudResult> {
  const {
    userMessage,
    interrupt,
    messages,
    llmUrl,
    llmModel = 'gpt-3.5-turbo',
    llmAuth,
    isFlowise = false,
    latestInterrupt,
    responseCallback,
    updateMessages,
    processThinkBlocks = defaultProcessThinkBlocks,
    statusCallback
  } = params

  const allMessages = [...messages, { role: 'user' as const, content: userMessage }]

  const body = JSON.stringify({
    model: llmModel,
    messages: isFlowise ? undefined : allMessages.map((msg) => ({ role: msg.role, content: msg.content })),
    ...(isFlowise && { question: userMessage })
  })

  console.log('LLM - sending request to remote', body)

  const props: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(llmAuth && { Authorization: `Bearer ${llmAuth}` })
    },
    body
  }

  try {
    const response = await fetch(llmUrl, props)

    if (!response.ok) {
      console.error('LLM: reasoning error', response)
      return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) }
    }

    // Check if this request is still current
    if (interrupt < latestInterrupt) {
      console.log('LLM: Cloud request outdated, stopping')
      return { success: false, error: new Error('Request outdated') }
    }

    const rcounter = 1000
    let bcounter = 0

    const json = await response.json()

    let sentence: string | null = null
    if (json.choices) {
      sentence = json.choices[0].message.content
    } else if (json.text) {
      sentence = json.text
    }

    if (sentence && sentence.length) {
      const { cleanedResponse, thinkBlocks } = processThinkBlocks(sentence)

      if (thinkBlocks.length && statusCallback) {
        statusCallback({
          color: 'ready',
          text: thinkBlocks.join(' ')
        })
      }

      if (!cleanedResponse || !cleanedResponse.length) {
        return { success: true, fullResponse: '', thinkBlocks }
      }

      // Update messages
      updateMessages?.(userMessage, cleanedResponse)

      // Split response into fragments for TTS
      const fragments = cleanedResponse.split(/[.!?]|,/)
      fragments.forEach((breath) => {
        if (responseCallback && breath.trim()) {
          responseCallback({
            text: breath,
            breath,
            ready: true,
            final: true,
            interrupt,
            rcounter,
            bcounter
          })
          bcounter++
        }
      })

      return { success: true, fullResponse: cleanedResponse, thinkBlocks }
    }

    return { success: true, fullResponse: '' }
  } catch (err) {
    console.error('LLM: reasoning catch error - bad remote url?', err)
    return { success: false, error: err as Error }
  }
}
