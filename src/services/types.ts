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

export interface ChatState {
  messages: ChatMessage[]
  currentMessage: string
}

export interface AppState {
  chat: ChatState
  isRecording: boolean
  config: AppConfig
}

export const initialChatState: ChatState = {
  messages: [],
  currentMessage: ''
}

export const initialAppConfig: AppConfig = {
  microphone: false,
  cloudMode: false,
  bargeInEnabled: true,
  autoSubmitEnabled: true,
  agentEnabled: true,
  llmLocal: false,
  directedMode: false
}
