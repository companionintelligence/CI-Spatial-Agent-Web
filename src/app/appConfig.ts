import { createSimpleStore } from '@hexafield/simple-store'
import type { ConversationState } from '../services/conversation/conversationType'

export interface AppConfig {
  microphone: boolean
  cloudMode: boolean
  bargeInEnabled: boolean
  autoSubmitEnabled: boolean
  agentEnabled: boolean
  llmLocal: boolean
  directedMode: boolean
  cameraEnabled: boolean
  cameraBackendEnabled: boolean
}

export interface AppState {
  conversation: ConversationState
  isRecording: boolean
  config: AppConfig
}

export const initialAppConfig: AppConfig = {
  microphone: false,
  cloudMode: false,
  bargeInEnabled: true,
  autoSubmitEnabled: true,
  agentEnabled: true,
  llmLocal: false,
  directedMode: false,
  cameraEnabled: false,
  cameraBackendEnabled: false
}

export const AppConfigState = createSimpleStore(
  initialAppConfig
)
