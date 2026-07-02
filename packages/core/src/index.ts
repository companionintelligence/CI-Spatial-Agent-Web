// Services - LLM
export { useLLMService } from './services/llm/llmService'
export * from './services/llm/llmTypes'
export { defaultLLMConfig, SYSTEM_PROMPT, AVAILABLE_LOCAL_MODELS } from './services/llm/config/llmConfig'
export type { LLMConfig } from './services/llm/config/llmConfig'

// Services - TTS (WhisperData is also in visemes, use tts version as canonical)
export { useTTSService } from './services/tts/ttsService'
export { defaultTTSConfig } from './services/tts/ttsConfig'
export type { TTSConfig, WhisperData } from './services/tts/ttsConfig'

// Services - STT
export { useSTTService } from './services/stt/sttService'
export { defaultSTTConfig } from './services/stt/sttConfig'
export type { STTConfig } from './services/stt/sttConfig'

// Services - VAD
export { useVADService } from './services/vad/vadService'
export { defaultVadConfig } from './services/vad/vadConfig'
export type { VADConfig } from './services/vad/vadConfig'

// Services - Visemes (skip WhisperData to avoid duplicate)
export { visemesSequence, convertToVRMTarget } from './services/visemes/visemesService'
export { useVisemeService } from './services/visemes/useVisemeService'
export type { VisemeState, VisemeTarget, VRMVisemeTarget, VisemeSequenceItem } from './services/visemes/visemeTypes'

// Services - Emote
export {
  initializeEmoteState,
  resetEmoteState,
  applyEmotion,
  emoteUpdate,
  startPerformance,
  handleBargeIn,
  applyEmoteStateToVRM,
  setupEmoteStateForVRM
} from './services/emote/emoteService'
export { useEmoteService } from './services/emote/useEmoteService'
export type { EmoteState, EmotionType, PerformanceData, EmoteResult, FacialTarget } from './services/emote/emoteTypes'

// Services - Animation
export * from './services/animation/animationService'
export { useAnimationService } from './services/animation/useAnimationService'
export type { AnimationState, AnimationClip, AnimationPerformanceData } from './services/animation/animationTypes'

// Services - Conversation
export { useConversationService } from './services/conversation/useConversationService'
export type { ConversationMessage, ConversationState } from './services/conversation/conversationType'

// Services - Agent
export { useAgent } from './services/useAgent'
export type { AgentService, AgentConfig, AgentCallbacks } from './services/useAgent'

// Components - Scene
export { Scene3D } from './components/scene/Scene3D'
export { Viewport3D } from './components/scene/Viewport3D'
export { sceneConfig } from './components/scene/sceneTypes'
export type { SceneConfig } from './components/scene/sceneTypes'
export { AvatarModel } from './components/scene/avatar/AvatarModel'
export type { SceneActions } from './components/scene/Scene3D'

// Components - Chat
export { ChatOverlay } from './components/chat/ChatOverlay'
export { ChatPanel } from './components/chat/ChatPanel'
export { ChatInput } from './components/chat/ChatInput'
export { ChatBubble } from './components/chat/ChatBubble'

// Components - Common
export { LogoOverlay } from './components/common/LogoOverlay'
export { ControlButton } from './components/common/ControlButton'
export { ToggleButton } from './components/common/ToggleButton'
export { Tooltip } from './components/common/Tooltip'
export { OnboardingOverlay } from './components/common/OnboardingOverlay'

// Components - Control
export { ControlOverlay } from './components/control/ControlOverlay'
export { ControlPanel } from './components/control/ControlPanel'

// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider'
export type { Theme } from './theme/ThemeProvider'

// App utilities
export { AppConfigState, initialAppConfig } from './app/appConfig'
export type { AppConfig, AppState } from './app/appConfig'
export { useResponsiveLayout } from './app/layoutService'

// Utils
export { useHasWebGPU } from './utils/useHasWebGPU'
export { useXRLayout } from './utils/useXRLayout'

// Integration
export { 
  shouldTriggerBargeIn, 
  detectEmotionFromText,
  createPerformanceFromMessage,
  emotionIntegrationService 
} from './integration/emotionIntegration'
export { reactionIntegrationService } from './integration/reactionIntegration'
