/**
 * Cloud/Remote LLM Implementation
 *
 * This module provides remote LLM processing for services like OpenAI, Anthropic, etc.
 * Supports both standard chat completions and Flowise integration.
 */

import type { LLMParams, LLMResult } from '../llmTypes'

function defaultProcessThinkBlocks(input: string) {
  const thinkBlocks: string[] = []

  const cleanedResponse = input.replace(/<think>(.*?)<\/think>/gs, (_, content) => {
    thinkBlocks.push(content.trim())
    return ''
  })

  return { cleanedResponse, thinkBlocks }
}

export async function llmCloud(params: LLMParams): Promise<LLMResult> {
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

  if (!llmUrl) {
    return { success: false, error: new Error('LLM URL is required') }
  }

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
    console.log('LLM - sending request to', llmUrl, props)
    const response = await fetch(llmUrl, props)

    if (!response.ok) {
      console.error('LLM: reasoning error', response)
      return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) }
    }

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

      updateMessages?.(userMessage, cleanedResponse)

      const fragments = cleanedResponse.split(/(?<=[.!?])|(?<=,)/)
      fragments.forEach((breath, index) => {
        if (responseCallback && breath.trim()) {
          responseCallback({
            text: breath,
            breath,
            ready: true,
            final: index === fragments.length - 1,
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
