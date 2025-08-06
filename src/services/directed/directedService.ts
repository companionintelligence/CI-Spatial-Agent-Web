import { useCallback, useState } from 'react'
import type { DirectedActions, DirectedConfig, DirectedResponse, DirectedState } from './directedTypes'

export const useDirectedService = (): { state: DirectedState; actions: DirectedActions } => {
  const [state, setState] = useState<DirectedState>({
    config: null,
    loading: false,
    error: null
  })

  const loadResponses = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await fetch('/src/assets/directed-responses.json')
      if (!response.ok) {
        throw new Error(`Failed to load responses: ${response.statusText}`)
      }
      
      const config: DirectedConfig = await response.json()
      setState(prev => ({ 
        ...prev, 
        config, 
        loading: false 
      }))
    } catch (error) {
      console.error('Directed service: Failed to load responses:', error)
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }))
    }
  }, [])

  const findResponse = useCallback((userMessage: string): DirectedResponse | null => {
    if (!state.config) return null
    
    const lowerMessage = userMessage.toLowerCase().trim()
    
    // Find exact trigger match first
    const exactMatch = state.config.responses.find(
      response => response.trigger.toLowerCase() === lowerMessage
    )
    if (exactMatch) return exactMatch
    
    // Find partial trigger match
    const partialMatch = state.config.responses.find(
      response => lowerMessage.includes(response.trigger.toLowerCase())
    )
    if (partialMatch) return partialMatch
    
    return null
  }, [state.config])

  const getDefaultResponse = useCallback((): DirectedResponse | null => {
    if (!state.config) return null
    
    return state.config.responses.find(response => response.trigger === 'default') || null
  }, [state.config])

  return {
    state,
    actions: {
      loadResponses,
      findResponse,
      getDefaultResponse
    }
  }
} 