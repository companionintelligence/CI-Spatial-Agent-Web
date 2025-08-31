// Core conversation service (no external deps)
export { useConversationService } from './services/conversation/UseConversationService'
export type { ConversationMessage } from './services/conversation/conversationType'

// Core integration utilities 
export { createReactionFromMessage } from './services/integration/reactionIntegration'
export { shouldTriggerBargeIn } from './services/integration/emotionIntegration'

// Note: Heavy dependencies (LLM, STT, TTS, VAD, 3D services) will be added once 
// dependency installation issues are resolved. The full agent service will be 
// available in the complete version.

// Placeholder for full agent service (commented out until deps are available)
// export { useAgent } from './services/useAgent'
// export type { AgentService, AgentConfig, AgentCallbacks } from './services/useAgent'