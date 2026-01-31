import { DIRECTED_RESPONSES_URL } from '../config/llmConfig'
import type { LLMParams, LLMResult } from '../llmTypes'

export interface DirectedResponse {
  id: string
  response: string
  emotion?: string
}

export interface TriggerGroup {
  // Backward compatibility: support legacy single trigger as well as new multiple triggers
  trigger?: string
  triggers?: string[]
  responses: DirectedResponse[]
}

export interface DirectedConfig {
  triggers: TriggerGroup[]
}

let directedConfig: DirectedConfig | null = null

async function loadDirectedResponses(): Promise<DirectedConfig> {
  if (directedConfig) {
    return directedConfig
  }

  try {
    const response = await fetch(DIRECTED_RESPONSES_URL)
    if (!response.ok) {
      throw new Error(`Failed to load responses: ${response.statusText}`)
    }

    const config = await response.json()
    directedConfig = config
    return config
  } catch (error) {
    console.error('Directed LLM: Failed to load responses:', error)
    throw error
  }
}

function getTriggerList(group: TriggerGroup): string[] {
  if (Array.isArray(group.triggers) && group.triggers.length > 0) return group.triggers
  if (group.trigger) return [group.trigger]
  return []
}

function findResponse(userMessage: string, config: DirectedConfig): DirectedResponse | null {
  const lowerMessage = userMessage.toLowerCase().trim()

  // Find exact trigger match first (any trigger in the set)
  const exactMatch = config.triggers.find((group) => {
    const triggers = getTriggerList(group).map((t) => t.toLowerCase())
    return triggers.includes(lowerMessage)
  })
  if (exactMatch) {
    const randomIndex = Math.floor(Math.random() * exactMatch.responses.length)
    return exactMatch.responses[randomIndex]
  }

  // Find partial trigger match (message contains any trigger)
  const partialMatch = config.triggers.find((group) => {
    const triggers = getTriggerList(group).map((t) => t.toLowerCase())
    return triggers.some((t) => lowerMessage.includes(t))
  })
  if (partialMatch) {
    const randomIndex = Math.floor(Math.random() * partialMatch.responses.length)
    return partialMatch.responses[randomIndex]
  }

  return null
}

function getDefaultResponse(config: DirectedConfig): DirectedResponse | null {
  // Look for a group that includes a 'default' trigger (case-insensitive)
  const defaultGroup = config.triggers.find((group) => {
    const triggers = getTriggerList(group).map((t) => t.toLowerCase())
    return triggers.includes('default')
  })
  if (defaultGroup) {
    const randomIndex = Math.floor(Math.random() * defaultGroup.responses.length)
    return defaultGroup.responses[randomIndex]
  }
  return null
}

export async function llmDirected(params: LLMParams): Promise<LLMResult> {
  const { userMessage, interrupt, latestInterrupt, responseCallback, updateMessages, setThinking } = params

  if (interrupt < latestInterrupt) {
    console.log('LLM: Directed request outdated, stopping')
    return { success: false, error: new Error('Request outdated') }
  }

  setThinking?.(true)

  try {
    // Load responses
    const config = await loadDirectedResponses()

    // Find matching response
    const directedResponse = findResponse(userMessage, config) || getDefaultResponse(config)

    if (!directedResponse) {
      setThinking?.(false)
      return { success: false, error: new Error('No response found') }
    }

    // Simulate streaming response like LLM
    const sentences = directedResponse.response.match(/[^.!?]+[.!?]+/g) || []
    let fullResponse = ''
    let bcounter = 0

    for (let i = 0; i < sentences.length; i++) {
      if (interrupt < latestInterrupt) {
        console.log('LLM: Directed request interrupted')
        break
      }

      const sentence = sentences[i].trimEnd()
      fullResponse += (i > 0 ? '. ' : '') + sentence

      if (responseCallback) {
        responseCallback({
          text: fullResponse,
          breath: sentence,
          ready: true,
          final: i === sentences.length - 1,
          interrupt,
          rcounter: 1000,
          bcounter
        })
      }

      bcounter++

      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    updateMessages?.(userMessage, fullResponse)
    setThinking?.(false)

    return { success: true, fullResponse }
  } catch (error) {
    console.error('LLM: Directed reasoning error', error)
    setThinking?.(false)
    return { success: false, error: error as Error }
  }
}
