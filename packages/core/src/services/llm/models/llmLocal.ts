/**
 * Local LLM Implementation using WebLLM
 *
 * This module provides local LLM processing using WebLLM engine with streaming support.
 * Handles breath chunking for TTS integration and interrupt management.
 */

import * as webllm from '@mlc-ai/web-llm'

import type { LLMParams, LLMResult, WebLLMStreamChunk } from '../llmTypes'

const MIN_BREATH_LENGTH = 20

export async function llmLocal(params: LLMParams): Promise<LLMResult> {
  const { userMessage, interrupt, messages, engine, latestInterrupt, responseCallback, updateMessages, setThinking } =
    params

  if (!engine) {
    console.error('LLM: Engine not ready')
    return { success: false, error: new Error('Engine not ready') }
  }

  setThinking?.(true)

  const rcounter = 1000
  let bcounter = 0
  let breath = ''

  const breathHelper = (fragment: string | null = null, finished = false) => {
    if (latestInterrupt > interrupt) {
      console.log('LLM: skipping - work is old', interrupt)
      return
    }

    if (!fragment || !fragment.length) {
      if (finished && responseCallback) {
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

      console.log('LLM - publishing fragment =', breath, 'time =', interrupt)
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
    console.log('LLM - sending local request', requestMessages)

    const asyncChunkGenerator = await engine.chat.completions.create({
      messages: requestMessages,
      stream: true
    })

    console.log(asyncChunkGenerator)

    const isAsyncIterable = (obj: unknown): obj is AsyncIterable<WebLLMStreamChunk> => {
      return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj
    }

    if (isAsyncIterable(asyncChunkGenerator)) {
      for await (const chunk of asyncChunkGenerator) {
        console.log({ chunk })
        if (!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
        const content = chunk.choices[0].delta.content
        const finished = chunk.choices[0].finish_reason
        breathHelper(content, finished === 'stop')
      }
    } else {
      const response = asyncChunkGenerator as unknown as webllm.ChatCompletion
      const choices = response.choices
      if (choices && choices.length) {
        const content = choices[0].message.content
        const finished = choices[0].finish_reason
        breathHelper(content, finished === 'stop')
      }
    }

    const paragraph = await engine.getMessage()
    console.log({ paragraph })

    updateMessages?.(userMessage, paragraph)
    setThinking?.(false)

    return { success: true, fullResponse: paragraph }
  } catch (err) {
    console.error('LLM: Local reasoning error', err)
    setThinking?.(false)
    return { success: false, error: err as Error }
  }
}
