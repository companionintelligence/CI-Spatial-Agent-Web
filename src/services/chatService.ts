import { useCallback, useState } from 'react'
import type { AppConfig, AppState, ChatMessage } from './types'
import { initialState } from './types'

export const useChatService = () => {
  const [state, setState] = useState<AppState>(initialState)

  const addMessage = useCallback((text: string, isUser: boolean) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: Date.now()
    }

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }))
  }, [])

  const updateCurrentMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      currentMessage: message
    }))
  }, [])

  const clearCurrentMessage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentMessage: ''
    }))
  }, [])

  const setRecording = useCallback((isRecording: boolean) => {
    setState((prev) => ({
      ...prev,
      isRecording
    }))
  }, [])

  const updateConfig = useCallback((configUpdate: Partial<AppConfig>) => {
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        ...configUpdate
      }
    }))
  }, [])

  return {
    state,
    actions: {
      addMessage,
      updateCurrentMessage,
      clearCurrentMessage,
      setRecording,
      updateConfig
    }
  }
}
