// Main agent service
export { useAgent } from './services/useAgent'
export type { 
  AgentService, 
  AgentConfig, 
  AgentCallbacks 
} from './services/useAgent'

// Individual service exports
export { useConversationService } from './services/conversation/UseConversationService'
export { useAnimationService } from './services/animation/useAnimationService'
export { useEmoteService } from './services/emote/useEmoteService'
export { useLLMService } from './services/llm/llmService'
export { useSTTService } from './services/stt/sttService'
export { useTTSService } from './services/tts/ttsService'
export { useVADService } from './services/vad/vadService'
export { useVisemeService } from './services/visemes/useVisemeService'

// Configuration types
export type { VADConfig, VADResult } from './services/vad/vadConfig'
export type { TTSConfig, WhisperData } from './services/tts/ttsConfig'
export type { STTConfig } from './services/stt/sttConfig'
export type { LLMConfig } from './services/llm/llmConfig'

// Service types
export type { ConversationMessage } from './services/conversation/conversationType'
export type { EmotionType, PerformanceData } from './services/emote/emoteTypes'
export type { LLMPerformRequest, LLMResponse, LLMStatusUpdate } from './services/llm/llmTypes'
export type { GazeOptions } from './services/emote/configs/emoteConfig'

// Integration utilities
export { createReactionFromMessage } from './services/integration/reactionIntegration'
export { shouldTriggerBargeIn } from './services/integration/emotionIntegration'