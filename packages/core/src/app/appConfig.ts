import { createSimpleStore } from '@hexafield/simple-store'
import type { ConversationState } from '../services/conversation/conversationType'

export interface AppConfig {
  microphone: boolean
  bargeInEnabled: boolean
  autoSubmitEnabled: boolean
  webGPUEnabled: boolean
}

export interface AppState {
  conversation: ConversationState
  isRecording: boolean
  config: AppConfig
}

export const initialAppConfig: AppConfig = {
  microphone: false,
  bargeInEnabled: true,
  autoSubmitEnabled: true,
  webGPUEnabled: import.meta.env.VITE_WEBGPU_ENABLED || true
}

export const AppConfigState = createSimpleStore(
  initialAppConfig
)
