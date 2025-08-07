import { useCallback } from 'react'

import { useSimpleStore } from '../utils/SimpleStore'
import type { ChatMessage, ChatState } from './types'
import { initialChatState } from './types'

export const useChatService = () => {
  const [state, setState] = useSimpleStore<ChatState>(() => initialChatState)

  const addMessage = useCallback((text: string, isUser: boolean) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: Date.now()
    }

    setState((prev) => {
      prev.messages.push(newMessage)
      return prev
    })
  }, [setState])

  const streamMessage = useCallback(
    (fragment: string, finished: boolean) => {
      const lastLLMStreamingMessage = state.messages.find((msg) => msg.isUser === false && msg.text.endsWith('...'))
      if (lastLLMStreamingMessage) {
        setState((prev) => {
          lastLLMStreamingMessage.text = lastLLMStreamingMessage.text.slice(0, -3) + fragment + (finished ? '' : '...')
          return prev
        })
      } else {
        addMessage(fragment + (finished ? '' : '...'), false)
      }
    },
    [addMessage, setState, state.messages]
  )

  const updateCurrentMessage = useCallback((message: string) => {
    state.currentMessage = message
    setState(state)
  }, [state, setState])

  const clearCurrentMessage = useCallback(() => {
    state.currentMessage = ''
    setState(state)
  }, [state, setState])

  return {
    state,
    actions: {
      addMessage,
      streamMessage,
      updateCurrentMessage,
      clearCurrentMessage
    }
  }
}
