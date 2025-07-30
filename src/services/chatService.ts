import { useState, useCallback } from 'react'
import type { ChatMessage, AppState, AppConfig } from './types'
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
    
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }))
  }, [])

  const updateCurrentMessage = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      currentMessage: message
    }))
  }, [])

  const clearCurrentMessage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentMessage: ''
    }))
  }, [])

  const setRecording = useCallback((isRecording: boolean) => {
    setState(prev => ({
      ...prev,
      isRecording
    }))
  }, [])

  const updateConfig = useCallback((configUpdate: Partial<AppConfig>) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        ...configUpdate
      }
    }))
  }, [])

  const submitMessage = useCallback(() => {
    if (state.currentMessage.trim()) {
      addMessage(state.currentMessage, true)
      
      // TODO: Send to LLM service - this will be handled by the App component
      // The LLM service will process the message and generate a response
      
      clearCurrentMessage()
    }
  }, [state.currentMessage, addMessage, clearCurrentMessage])

  return {
    state,
    actions: {
      addMessage,
      updateCurrentMessage,
      clearCurrentMessage,
      setRecording,
      updateConfig,
      submitMessage
    }
  }
}
