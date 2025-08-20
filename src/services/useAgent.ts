/**
 * Unified Agent Hook for CI-XR-Web
 *
 * This hook combines all conversational AI services (VAD, STT, LLM, TTS, Visemes, Emotes)
 * into a single, easy-to-use library API. It handles service coordination and state management
 * automatically while providing fine-grained control when needed.
 *
 * @example Basic Usage
 * ```typescript
 * const agent = useAgent({
 *   llm: { llm_provider: 'ollama', ollama_url: 'http://localhost:11434' },
 *   tts: { voice: 'en_US-hfc_female-medium', speed: 1.2 },
 *   stt: { language: 'en-US', continuous: true },
 *   audio: { vadThreshold: 0.8, microphoneEnabled: true },
 *   autoSubmitEnabled: true,
 *   bargeInEnabled: true
 * }, {
 *   onLLMResponse: (response) => console.log('AI says:', response.breath),
 *   onVADResult: (result) => setVadIndicator(result.isSpeech),
 *   onTTSSpeechStart: (text, whisperData) => startLipSync(whisperData)
 * })
 *
 * // Use the unified state and actions
 * const { state, actions } = agent
 *
 * // Submit a message to the AI
 * actions.submitMessage("Hello, how are you?")
 *
 * // Toggle microphone listening (now requires isRecording parameter)
 * actions.toggleMicrophone(isRecording)
 *
 * // Set up avatar integration
 * actions.setupVisemesForVRM(vrmAvatar)
 * actions.setupEmotesForVRM(vrmAvatar)
 *
 * // In your animation loop
 * useAnimationFrame((time) => {
 *   actions.updateVisemes(time)
 *   actions.updateEmotes(time)
 *   actions.applyVisemesToRig(time, 1.0)
 *   actions.applyEmotesToVRM(vrmAvatar)
 * })
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * const agent = useAgent({
 *   // OpenAI LLM with custom system prompt
 *   llm: {
 *     llm_provider: 'openai',
 *     openai_api_key: 'your-key',
 *     openai_model: 'gpt-4',
 *     system_prompt: 'You are a helpful assistant.'
 *   },
 *   // ElevenLabs TTS
 *   tts: {
 *     remote: true,
 *     apiKey: 'your-elevenlabs-key',
 *     voice: 'voice-id',
 *     voiceSettings: { stability: 0.5, similarity_boost: 0.8 }
 *   },
 *   // App behavior
 *   autoSubmitEnabled: true,
 *   bargeInEnabled: true
 * })
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AudioConfigPartial, STTConfigPartial, TTSConfigPartial, VADResult, WhisperData } from './audioTypes'
import { useConversationService } from './conversation/conversationService'
import type { ConversationMessage } from './conversation/conversationType'
import type { EmotionType, GazeOptions, PerformanceData } from './emote/emoteTypes'
import { useEmoteService } from './emote/useEmoteService'
import { emotionIntegrationService } from './emotionIntegration'
import { useLLMService } from './llm/llmService'
import type { LLMConfig, LLMPerformRequest, LLMResponse, LLMStatusUpdate } from './llm/llmTypes'
import { useSTTService } from './stt/sttService'
import { useVADService } from './stt/vadService'
import { useTTSService } from './tts/ttsService'
import { useVisemeService } from './visemes/useVisemeService'
import { useAnimationService } from './animation/useAnimationService'
import { createReactionFromMessage } from './reactionIntegration'
import type { VRM } from '@pixiv/three-vrm'

// STT service result interface (defined locally in sttService.ts)
interface STTPerformResult {
  text: string
  interrupt: number
  confidence: number
  spoken: boolean
  human: boolean
  comment: string
  rcounter: number
  bcounter: number
  final: boolean
  bargein: boolean
}

interface MorphTargetObject {
  morphTargetInfluences: number[]
}

// Configuration interfaces
export interface AgentConfig {
  // Audio/VAD configuration
  audio?: AudioConfigPartial
  // TTS configuration
  tts?: TTSConfigPartial
  // STT configuration
  stt?: STTConfigPartial
  // LLM configuration
  llm?: Partial<LLMConfig>
  // App behavior configuration
  autoSubmitEnabled?: boolean
  bargeInEnabled?: boolean
}

// Callback interfaces
export interface AgentCallbacks {
  // VAD callbacks
  onVADResult?: (result: VADResult) => void
  onSpeechStart?: () => void
  onSpeechEnd?: (audio: ArrayBuffer) => void

  // STT callbacks
  onSTTResult?: (result: STTPerformResult) => void
  onInterimTranscript?: (text: string) => void

  // LLM callbacks
  onLLMStatus?: (status: LLMStatusUpdate) => void
  onLLMResponse?: (response: LLMResponse) => void

  // TTS callbacks
  onTTSSpeechStart?: (text: string, whisperData: WhisperData) => void
  onTTSSpeechEnd?: () => void

  // Conversation callbacks
  onMessageAdded?: (message: ConversationMessage) => void
  onMessageUpdated?: (messages: ConversationMessage[]) => void

  // General callbacks
  onError?: (error: Error) => void
}

// Return type for the hook
export interface AgentService {
  // State
  state: {
    // VAD state
    vadIsListening: boolean
    vadIsDetecting: boolean

    // STT state
    sttIsListening: boolean
    sttAllowed: boolean
    sttDesired: boolean
    currentTranscript: string

    // LLM state
    llmReady: boolean
    llmLoading: boolean
    llmThinking: boolean
    llmMessages: Array<{ role: string; content: string }>

    // TTS state
    ttsIsSpeaking: boolean
    ttsAudioQueue: number

    // Conversation state
    messages: ConversationMessage[]
    currentMessage: string
  }

  // Actions
  actions: {
    // VAD actions
    startVADListening: () => void
    stopVADListening: () => void
    initializeVAD: () => void

    // STT actions
    startSTTListening: () => void
    stopSTTListening: () => void
    setSTTDesired: (desired: boolean) => void

    // LLM actions
    loadLLM: () => void
    processUserInput: (request: LLMPerformRequest) => void
    clearLLMHistory: () => void

    // TTS actions
    speak: (text: string) => Promise<number | null>
    stopSpeaking: () => void
    playAudioBuffer: (audioBuffer: ArrayBuffer) => Promise<void>
    getTTSQueueStatus: () => { queueLength: number; isProcessing: boolean; nextExpectedId: number; messages: Array<{ id: number; status: string; text: string }> }

    // Chat actions
    addMessage: (text: string, isUser: boolean) => void
    updateCurrentMessage: (message: string) => void
    clearCurrentMessage: () => void

    // Convenience actions
    submitMessage: (message: string) => void
    toggleMicrophone: (isRecording: boolean) => void
    triggerBargein: () => void

    // Viseme actions (for external avatar control)
    setupVisemesForVRM: (vrm: VRM) => void
    setupVisemesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    updateVisemes: (currentTime: number) => void
    applyVisemesToRig: (currentTime: number, amplify?: number) => void
    resetVisemes: () => void

    // Emote actions (for external avatar control)
    setupEmotesForVRM: (vrm: VRM) => void
    setupEmotesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    setEmotion: (emotion: EmotionType) => void
    performAction: (performanceData: PerformanceData) => void
    triggerGaze: (options?: GazeOptions) => void
    updateEmotes: (currentTime?: number) => void
    applyEmotesToVRM: (vrm: VRM) => void
    applyEmotesToMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    resetEmotes: () => void
    onEmoteBargein: () => void
  }

  // Service instances (for advanced usage)
  services: {
    conversation: ReturnType<typeof useConversationService>
    vad: ReturnType<typeof useVADService>
    stt: ReturnType<typeof useSTTService>
    llm: ReturnType<typeof useLLMService>
    tts: ReturnType<typeof useTTSService>
    visemes: ReturnType<typeof useVisemeService>
    emotes: ReturnType<typeof useEmoteService>
    animations: ReturnType<typeof useAnimationService>
  }
}

// Default configurations
const defaultAudioConfig: AudioConfigPartial = {
  microphoneEnabled: false,
  vadThreshold: 0.8,
  volume: 1.0,
  vadEnabled: true
}

const defaultTTSConfig: TTSConfigPartial = {
  voice: 'en_US-hfc_female-medium',
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  mode: 'browser'
}

const defaultSTTConfig: STTConfigPartial = {
  language: 'en-US',
  continuous: true,
  remote: false
}

const defaultLLMConfig: Partial<LLMConfig> = {
  llm_provider: 'mlc',
  mlc_model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
}

// Default app behavior configuration
const defaultAppConfig = {
  autoSubmitEnabled: true,
  bargeInEnabled: true
}

/**
 * Unified agent hook that combines all conversational AI services
 *
 * This hook integrates VAD, STT, LLM, TTS, Visemes, and Emotes services
 * with automatic service coordination and state management.
 *
 * @param config - Configuration object for all services
 * @param callbacks - Callback functions for service events
 * @returns AgentService object with state, actions, and service instances
 */
export const useAgent = (config: AgentConfig = {}, callbacks: AgentCallbacks = {}): AgentService => {
  // Merge configurations with defaults
  const audioConfig = { ...defaultAudioConfig, ...config.audio }
  const ttsConfig = { ...defaultTTSConfig, ...config.tts }
  const sttConfig = { ...defaultSTTConfig, ...config.stt }
  const llmConfig = { ...defaultLLMConfig, ...config.llm }
  const appConfig = {
    autoSubmitEnabled: config.autoSubmitEnabled ?? defaultAppConfig.autoSubmitEnabled,
    bargeInEnabled: config.bargeInEnabled ?? defaultAppConfig.bargeInEnabled
  }

  // Internal state
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  const interruptCounterRef = useRef(Date.now())

  // Initialize conversation service
  const conversation = useConversationService()

  // Initialize viseme and emote services
  const visemes = useVisemeService()
  const emotes = useEmoteService()
  const animations = useAnimationService()
  // Initialize LLM service
  const llmService = useLLMService({
    config: llmConfig,
    onStatus: (status: LLMStatusUpdate) => {
      callbacks.onLLMStatus?.(status)
    },
    onResponse: (response: LLMResponse) => {
      const breath = response.breath
      if (breath) {
        tts.actions.speak(breath)

        // Analyze the response for emotional content and trigger appropriate emote
        const message = {
          id: Date.now().toString(),
          text: breath,
          isUser: false,
          timestamp: Date.now()
        }

        const {performance, animation} = createReactionFromMessage(       
          message,
          conversation.state.messages.length)
  
        // Trigger emote performance based on the response
        emotes.actions.performAction(performance)
        if(animation) animations.actions.performAction(animation)
      }

      conversation.actions.streamMessage(breath, response.final)
      callbacks.onLLMResponse?.(response)
    }
  })

  // Initialize TTS service
  const tts = useTTSService({
    config: ttsConfig,
    onSpeechStart: (text: string, whisperData: WhisperData) => {
      const startTime = Date.now()
      visemes.actions.generateSequence(whisperData, startTime)
      callbacks.onTTSSpeechStart?.(text, whisperData)
    },
    onSpeechEnd: () => {
      emotes.actions.reset()
      callbacks.onTTSSpeechEnd?.()
    }
  })

  // Services that need to be responsive to app state changes
  const vadConfigWithState = {
    ...audioConfig
    // microphoneEnabled will be controlled externally
  }

  // Initialize VAD service
  const vad = useVADService({
    config: vadConfigWithState,
    onVADResult: (result) => {
      setVadDetecting(result.isSpeech)
      callbacks.onVADResult?.(result)
    },
    onSpeechStart: callbacks.onSpeechStart,
    onSpeechEnd: callbacks.onSpeechEnd
  })

  // Initialize STT service
  const stt = useSTTService({
    config: sttConfig,
    onPerform: (result) => {
      if (result.final) {
        if (result.text.trim() === 'stop') {
          const interrupt = Date.now()
          interruptCounterRef.current = interrupt

          if (tts.isSpeaking) {
            tts.actions.stopSpeaking()
          }

          // Trigger barge-in behavior in emote system
          emotes.actions.onBargeIn()

          console.log('STT: Stop command detected - barge-in activated')
          return
        }

        if (appConfig.autoSubmitEnabled) {
          conversation.actions.addMessage(result.text, true)
          setCurrentInterimTranscript('')
        } else {
          setCurrentInterimTranscript(result.text)
        }

        const interrupt = Date.now()
        interruptCounterRef.current = interrupt
        llmService.actions.processUserInput({
          text: result.text,
          human: true,
          final: true,
          bargein: appConfig.bargeInEnabled,
          interrupt
        })
      } else {
        setCurrentInterimTranscript(result.text)
      }
      callbacks.onSTTResult?.(result)
    },
    onInterimTranscript: (text) => {
      setCurrentInterimTranscript(text)
      callbacks.onInterimTranscript?.(text)
    }
  })

  // Service coordination effects
  useEffect(() => {
    stt.actions.setDesired(vad.isDetecting)
  }, [vad.isDetecting, stt.actions])

  useEffect(() => {
    stt.actions.setAllowed(!tts.isSpeaking)
  }, [tts.isSpeaking, stt.actions])

  // Convenience action implementations
  const submitMessage = useCallback(
    (message: string) => {
      if (message.trim()) {
        const userMessage = message.trim()

        conversation.actions.addMessage(userMessage, true)
        conversation.actions.clearCurrentMessage()

        const interrupt = Date.now()
        interruptCounterRef.current = interrupt

        llmService.actions.processUserInput({
          text: userMessage,
          human: true,
          final: true,
          bargein: appConfig.bargeInEnabled,
          interrupt
        })
        conversation.actions.clearCurrentMessage()
      }
    },
    [appConfig.bargeInEnabled, conversation.actions, llmService.actions]
  )

  const toggleMicrophone = useCallback(
    (isRecording: boolean) => {
      const newRecordingState = !isRecording

      stt.actions.setDesired(newRecordingState)
      setCurrentInterimTranscript('')
    },
    [stt.actions]
  )

  const triggerBargein = useCallback(() => {
    const interrupt = Date.now()
    interruptCounterRef.current = interrupt

    if (tts.isSpeaking) {
      tts.actions.stopSpeaking()
    }

    emotes.actions.onBargeIn()
  }, [tts.isSpeaking, tts.actions, emotes])

  // Memoize the services object to prevent unnecessary re-renders
  const services = useMemo(() => ({
    conversation,
    vad,
    stt,
    llm: llmService,
    tts,
    visemes,
    emotes,
    animations
  }), [conversation, vad, stt, llmService, tts, visemes, emotes, animations])

  // Memoize the actions object to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    // VAD actions
    startVADListening: vad.actions.startListening,
    stopVADListening: vad.actions.stopListening,
    initializeVAD: vad.actions.initializeVAD,

    // STT actions
    startSTTListening: stt.actions.startListening,
    stopSTTListening: stt.actions.stopListening,
    setSTTDesired: stt.actions.setDesired,

    // LLM actions
    loadLLM: llmService.actions.load,
    processUserInput: llmService.actions.processUserInput,
    clearLLMHistory: llmService.actions.clearHistory,

    // TTS actions
    speak: tts.actions.speak,
    stopSpeaking: tts.actions.stopSpeaking,
    playAudioBuffer: tts.actions.playAudioBuffer,
    getTTSQueueStatus: tts.actions.getQueueStatus,

    // Chat actions
    addMessage: conversation.actions.addMessage,
    updateCurrentMessage: conversation.actions.updateCurrentMessage,
    clearCurrentMessage: conversation.actions.clearCurrentMessage,

    // Convenience actions
    submitMessage,
    toggleMicrophone,
    triggerBargein,

    // Viseme actions
    setupVisemesForVRM: visemes.actions.setupForVRM,
    setupVisemesForMorphTargets: visemes.actions.setupForMorphTargets,
    updateVisemes: visemes.actions.updateVisemes,
    applyVisemesToRig: visemes.actions.applyToRig,
    resetVisemes: visemes.actions.reset,

    // Emote actions
    setupEmotesForVRM: emotes.actions.setupForVRM,
    setupEmotesForMorphTargets: emotes.actions.setupForMorphTargets,
    setEmotion: emotes.actions.setEmotion,
    performAction: emotes.actions.performAction,
    triggerGaze: emotes.actions.triggerGaze,
    updateEmotes: emotes.actions.update,
    applyEmotesToVRM: emotes.actions.applyToVRM,
    applyEmotesToMorphTargets: emotes.actions.applyToMorphTargets,
    resetEmotes: emotes.actions.reset,
    onEmoteBargein: emotes.actions.onBargeIn
  }), [
    vad.actions.startListening, vad.actions.stopListening, vad.actions.initializeVAD,
    stt.actions.startListening, stt.actions.stopListening, stt.actions.setDesired,
    llmService.actions.load, llmService.actions.processUserInput, llmService.actions.clearHistory,
    tts.actions.speak, tts.actions.stopSpeaking, tts.actions.playAudioBuffer, tts.actions.getQueueStatus,
    conversation.actions.addMessage, conversation.actions.updateCurrentMessage, conversation.actions.clearCurrentMessage,
    submitMessage, toggleMicrophone, triggerBargein,
    visemes.actions.setupForVRM, visemes.actions.setupForMorphTargets, visemes.actions.updateVisemes, visemes.actions.applyToRig, visemes.actions.reset,
    emotes.actions.setupForVRM, emotes.actions.setupForMorphTargets, emotes.actions.setEmotion, emotes.actions.performAction, emotes.actions.triggerGaze, emotes.actions.update, emotes.actions.applyToVRM, emotes.actions.applyToMorphTargets, emotes.actions.reset, emotes.actions.onBargeIn
  ])

  const state = useMemo(() => ({
    vadIsListening: vad.isListening,
    vadIsDetecting: vadDetecting,
    sttIsListening: stt.isListening,
    sttAllowed: stt.allowed,
    sttDesired: stt.desired,
    currentTranscript: currentInterimTranscript,
    llmReady: llmService.state.ready,
    llmLoading: llmService.state.loading,
    llmThinking: llmService.state.thinking,
    llmMessages: llmService.state.messages,
    ttsIsSpeaking: tts.isSpeaking.current,
    ttsAudioQueue: tts.audioQueue,
    messages: conversation.state.messages,    
    currentMessage: conversation.state.currentMessage
  }),[vad.isListening, vadDetecting, stt.isListening, stt.allowed, stt.desired, currentInterimTranscript, llmService.state.ready, llmService.state.loading, llmService.state.thinking, llmService.state.messages, tts.isSpeaking.current, tts.audioQueue, conversation.state.messages, conversation.state.currentMessage])

  // Return the unified service interface
  return {
    state,
    actions,
    services
  }
}
