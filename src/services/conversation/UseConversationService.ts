import { useSimpleStore } from '@hexafield/simple-store/react'
import { useCallback, useMemo } from 'react'

import type { ConversationMessage, ConversationState } from './conversationType'
import { initialConversationState } from './conversationType'

export const useConversationService = () => {
  const [state, setState] = useSimpleStore<ConversationState>(() => initialConversationState)

  const addMessage = useCallback(
    (text: string, isUser: boolean) => {
      const newMessage: ConversationMessage = {
        id: Date.now().toString(),
        text,
        isUser,
        timestamp: Date.now()
      }
      
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }))
    },
    [setState]
  )

  const streamMessage = useCallback(
    (fragment: string, finished: boolean) => {
      setState((prev) => {
        const lastLLMStreamingMessage = prev.messages.find((msg) => msg.isUser === false && msg.text.endsWith('...'))

        if (lastLLMStreamingMessage) {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === lastLLMStreamingMessage.id
              ? { ...msg, text: msg.text.slice(0, -3) + fragment + (finished ? '' : '...') }
              : msg
          )
          return { ...prev, messages: updatedMessages }
        } else {
          // Add new message
          const newMessage: ConversationMessage = {
            id: Date.now().toString(),
            text: fragment + (finished ? '' : '...'),
            isUser: false,
            timestamp: Date.now()
          }
          return { ...prev, messages: [...prev.messages, newMessage] }
        }
      })
    },
    [addMessage, setState, state.messages]
  )

  const updateCurrentMessage = useCallback(
    (message: string) => {
      setState((prev) => ({
        ...prev,
        currentMessage: message
      }))
    },
    [setState]
  )

  const clearCurrentMessage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentMessage: ''
    }))
  }, [setState])

  const actions = useMemo(
    () => ({
      addMessage,
      streamMessage,
      updateCurrentMessage,
      clearCurrentMessage
    }),
    [addMessage, streamMessage, updateCurrentMessage, clearCurrentMessage]
  )

  return useMemo(
    () => ({
      state,
      actions
    }),
    [state, actions]
  )
}
