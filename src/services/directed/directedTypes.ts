export interface DirectedResponse {
  id: string
  trigger: string
  response: string
  emotion?: string
}

export interface DirectedConfig {
  responses: DirectedResponse[]
}

export interface DirectedState {
  config: DirectedConfig | null
  loading: boolean
  error: string | null
}

export interface DirectedActions {
  loadResponses: () => Promise<void>
  findResponse: (userMessage: string) => DirectedResponse | null
  getDefaultResponse: () => DirectedResponse | null
}
