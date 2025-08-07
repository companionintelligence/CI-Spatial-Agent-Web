export interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  audioData?: ArrayBuffer
  visemeData?: unknown[]
}

export interface AppConfig {
  microphone: boolean
  cloudMode: boolean
  bargeInEnabled: boolean
  autoSubmitEnabled: boolean
  agentEnabled: boolean
  llmLocal: boolean
  directedMode: boolean
}

export interface AppState {
  messages: ChatMessage[]
  currentMessage: string
  isRecording: boolean
  config: AppConfig
}

export const initialState: AppState = {
  messages: [],
  currentMessage: '',
  isRecording: false,
  config: {
    microphone: false,
    cloudMode: false,
    bargeInEnabled: true,
    autoSubmitEnabled: true,
    agentEnabled: true,
    llmLocal: false,
    directedMode : true
  }
}
