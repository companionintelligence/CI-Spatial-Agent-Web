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
        messages: [...prev.messages, newMessage.id],
        messageMap: { ...prev.messageMap, [newMessage.id]: newMessage },
        lastAgentResponseId: isUser ? prev.lastAgentResponseId : newMessage.id,
        lastUserMessageId: !isUser ? prev.lastUserMessageId : newMessage.id
      }))
    },  
    [setState]
  )

  const streamMessage = useCallback(
    (fragment: string, finished: boolean) => {
      setState((prev) => {
        const lastLLMStreamingMessage = prev.messageMap[prev.lastAgentResponseId]
        if (lastLLMStreamingMessage?.text.endsWith('...')) {
          prev.messageMap[prev.lastAgentResponseId].text = lastLLMStreamingMessage.text.slice(0, -3) + fragment + (finished ? '' : '...')
          return { ...prev, messageMap: { ...prev.messageMap, [prev.lastAgentResponseId]: lastLLMStreamingMessage } }
        } else {
          // Add new message
          const newMessage: ConversationMessage = {
            id: Date.now().toString(),
            text: fragment + (finished ? '' : '...'),
            isUser: false,
            timestamp: Date.now()
          }
          return {  ...prev,
            messages: [...prev.messages, newMessage.id],
            messageMap: { ...prev.messageMap, [newMessage.id]: newMessage },
            lastAgentResponseId: newMessage.id,
            lastUserMessageId: prev.lastUserMessageId
          }
        }
      })
    },
    [setState, state.messageMap]
  )

  const clearAllMessages = useCallback(() => {
    setState(initialConversationState)
  }, [setState])

  const getMessagebyId = useCallback((id: string) => {
    return state.messageMap[id]
  }, [state.messageMap])

  const actions = useMemo(
    () => ({
      addMessage,
      streamMessage,
      clearAllMessages,
      getMessagebyId
    }),
    [addMessage, streamMessage, clearAllMessages, getMessagebyId]
  )

  return useMemo(
    () => ({
      state,
      actions
    }),
    [state, actions]
  )
}
