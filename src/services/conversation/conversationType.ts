export interface ConversationMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  audioData?: ArrayBuffer
  visemeData?: unknown[]
}

export interface ConversationState {
  messages: ConversationMessage[]
  currentMessage: string
}

export const initialConversationState: ConversationState = {
  messages: [],
  currentMessage: ''
}
