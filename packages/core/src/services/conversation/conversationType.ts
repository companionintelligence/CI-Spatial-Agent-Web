export type ConversationId = string

export interface ConversationMessage {
  id: ConversationId
  text: string
  isUser: boolean
  timestamp: number
  audioData?: ArrayBuffer
  visemeData?: unknown[]
}

export interface ConversationState {
  messageMap: Record<ConversationId, ConversationMessage>
  messages: ConversationId[]
  lastAgentResponseId: ConversationId
  lastUserMessageId: ConversationId
}

export const initialConversationState: ConversationState = {
  messageMap: {},
  messages: [],
  lastAgentResponseId: '',
  lastUserMessageId: '',
}
