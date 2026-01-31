import type { VRM } from '@pixiv/three-vrm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAnimationService } from './animation/useAnimationService'
import { useConversationService } from './conversation/useConversationService'
import type { ConversationId, ConversationMessage } from './conversation/conversationType'
import type { EmotionType, PerformanceData } from './emote/emoteTypes'
import { useEmoteService } from './emote/useEmoteService'
import { useLLMService } from './llm/llmService'
import type { LLMPerformRequest, LLMResponse, LLMStatusUpdate } from './llm/llmTypes'
import { createReactionFromMessage } from '../integration/reactionIntegration'
import { useSTTService } from './stt/sttService'
import { useVADService } from './vad/vadService'
import { useTTSService } from './tts/ttsService'
import { useVisemeService } from './visemes/useVisemeService'
import type { GazeOptions } from './emote/configs/emoteConfig'
import { defaultVadConfig, type VADConfig, type VADResult } from './vad/vadConfig'
import { defaultTTSConfig, type TTSConfig, type WhisperData } from './tts/ttsConfig'
import { defaultSTTConfig, type STTConfig } from './stt/sttConfig'
import { defaultLLMConfig, type LLMConfig } from './llm/config/llmConfig'
import { shouldTriggerBargeIn } from '../integration/emotionIntegration'

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
  vad?: Partial<VADConfig>
  // TTS configuration
  tts?:  Partial<TTSConfig>
  // STT configuration
  stt?:  Partial<STTConfig>
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
    messages: ConversationId[]
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
    getTTSQueueStatus: () => {
      queueLength: number
      isProcessing: boolean
      nextExpectedId: number
      messages: Array<{ id: number; status: string; text: string }>
    }

    // Chat actions
    addMessage: (text: string, isUser: boolean) => void
    streamMessage: (fragment: string, finished: boolean) => void
    clearAllMessages: () => void
    getMessagebyId: (id: ConversationId) => ConversationMessage

    // Convenience actions  
    submitMessage: (message: string) => void
    toggleMicrophone: (isRecording: boolean) => void
    triggerBargein: () => void

    // Viseme actions (for external avatar control)
    setupVisemesForVRM: (vrm: VRM) => void
    setupVisemesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    updateVisemes: (_delta: number) => void
    applyVisemesToRig: (_delta: number, amplify?: number) => void
    resetVisemes: () => void

    // Emote actions (for external avatar control)
    setupEmotesForVRM: (vrm: VRM) => void
    setupEmotesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    setEmotion: (emotion: EmotionType) => void
    performAction: (performanceData: PerformanceData) => void
    triggerGaze: (options?: GazeOptions) => void
    updateEmotes: (_delta: number) => void
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
  const vadConfig = { ...defaultVadConfig, ...config.vad }
  const ttsConfig = { ...defaultTTSConfig, ...config.tts }
  const sttConfig = { ...defaultSTTConfig, ...config.stt }
  const llmConfig = { ...defaultLLMConfig, ...config.llm }
  const appConfig = {
    autoSubmitEnabled: config.autoSubmitEnabled ?? defaultAppConfig.autoSubmitEnabled,
    bargeInEnabled: config.bargeInEnabled ?? defaultAppConfig.bargeInEnabled
  }

  // Internal state
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const interruptCounterRef = useRef(performance.now())

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
      console.log('LLM status:', status)
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

        const { performance, animation } = createReactionFromMessage(message, conversation.state.messages.length)

        // Trigger emote performance based on the response
        emotes.actions.performAction(performance)
        if (animation) animations.actions.performAction(animation)
      }

      conversation.actions.streamMessage(breath, response.final)
      callbacks.onLLMResponse?.(response)
    }
  })

  // Initialize TTS service
  const tts = useTTSService({
    config: ttsConfig,
    onSpeechStart: (text: string, whisperData: WhisperData) => {
      visemes.actions.generateSequence(whisperData)
      callbacks.onTTSSpeechStart?.(text, whisperData)
    },
    onSpeechEnd: () => {
      emotes.actions.reset()
      callbacks.onTTSSpeechEnd?.()
    }
  })

  // Initialize VAD service
  const vad = useVADService({
    config: vadConfig,
    onVADResult: (result) => {
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
        const interrupt = Date.now()
        // Handle barge-in if detected
        if (shouldTriggerBargeIn({ text: result.text, isUser: true, id: '', timestamp: interrupt })) {
          if(tts.state.isSpeaking){tts.actions.stopSpeaking()}
          emotes.actions.onBargeIn()
          console.log('STT: Stop command detected - barge-in activated')
        }

        // Auto-submit or set interim transcript
        if (appConfig.autoSubmitEnabled) {
          conversation.actions.addMessage(result.text, true)
          setCurrentInterimTranscript('')
        } else {
          setCurrentInterimTranscript(result.text)
        }

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

      console.log('STT: result:', result)
      callbacks.onSTTResult?.(result)
    },
    onInterimTranscript: (text) => {
      setCurrentInterimTranscript(text)
      callbacks.onInterimTranscript?.(text)
    }
  })

  // Service coordination effects
  useEffect(() => { 
    stt.actions.setDesired(vad.state.isDetecting)
  }, [vad.state.isDetecting, stt.actions])

  useEffect(() => {
    // Always allow STT if barge-in is enabled, otherwise only allow if not speaking
    if (appConfig.bargeInEnabled) {
      stt.actions.setAllowed(true)
    } else {
      stt.actions.setAllowed(!tts.state.isSpeaking)
    }
  }, [appConfig.bargeInEnabled, tts.state.isSpeaking, stt.actions])

  // Convenience action implementations
  const submitMessage = useCallback(
    (message: string) => {
      if (message.trim()) {
        const userMessage = message.trim()

        conversation.actions.addMessage(userMessage, true)

        const interrupt = Date.now()
        interruptCounterRef.current = interrupt

        llmService.actions.processUserInput({
          text: userMessage,
          human: true,
          final: true,
          bargein: appConfig.bargeInEnabled,
          interrupt
        })
      }
    },
    [appConfig.bargeInEnabled, conversation.actions, llmService.actions]
  )

  const toggleMicrophone = useCallback(
    (isRecording: boolean) => {
      stt.actions.setDesired(isRecording)
      setCurrentInterimTranscript('')
    },
    [stt.actions]
  )

  const triggerBargein = useCallback(() => {
    const interrupt = Date.now()
    interruptCounterRef.current = interrupt

    if (tts.state.isSpeaking) {
      tts.actions.stopSpeaking()
    }

    emotes.actions.onBargeIn()
  }, [tts.state.isSpeaking, tts.actions, emotes])

  // Memoize the services object to prevent unnecessary re-renders
  const services = useMemo(
    () => ({
      conversation,
      vad,
      stt,
      llm: llmService,
      tts,
      visemes,
      emotes,
      animations
    }),
    [conversation, vad, stt, llmService, tts, visemes, emotes, animations]
  )

  // Memoize the actions object to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
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
      streamMessage: conversation.actions.streamMessage,
      clearAllMessages: conversation.actions.clearAllMessages,
      getMessagebyId: conversation.actions.getMessagebyId,
      // Convenience actions
      submitMessage,
      toggleMicrophone,
      triggerBargein,

      // Viseme actions
      setupVisemesForVRM: visemes.actions.setupForVRM,
      setupVisemesForMorphTargets: visemes.actions.setupForMorphTargets,
      updateVisemes: visemes.actions.update,
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
    }),
    [
      vad.actions.startListening,
      vad.actions.stopListening,
      vad.actions.initializeVAD,
      stt.actions.startListening,
      stt.actions.stopListening,
      stt.actions.setDesired,
      llmService.actions.load,
      llmService.actions.processUserInput,
      llmService.actions.clearHistory,
      tts.actions.speak,
      tts.actions.stopSpeaking,
      tts.actions.playAudioBuffer,
      tts.actions.getQueueStatus,
      conversation.actions.addMessage,
      conversation.actions.streamMessage,
      conversation.actions.clearAllMessages,
      submitMessage,
      toggleMicrophone,
      triggerBargein,
      visemes.actions.setupForVRM,
      visemes.actions.setupForMorphTargets,
      visemes.actions.update,
      visemes.actions.applyToRig,
      visemes.actions.reset,
      emotes.actions.setupForVRM,
      emotes.actions.setupForMorphTargets,
      emotes.actions.setEmotion,
      emotes.actions.performAction,
      emotes.actions.triggerGaze,
      emotes.actions.update,
      emotes.actions.applyToVRM,
      emotes.actions.applyToMorphTargets,
      emotes.actions.reset,
      emotes.actions.onBargeIn
    ]
  )

  const state = useMemo(
    () => ({
      vadIsListening: vad.state.isListening,
      vadIsDetecting: vad.state.isDetecting,
      sttIsListening: stt.state.isListening,
      sttAllowed: stt.state.allowed,
      sttDesired: stt.state.desired,
      currentTranscript: currentInterimTranscript,
      llmReady: llmService.state.ready,
      llmLoading: llmService.state.loading,
      llmThinking: llmService.state.thinking,
      llmMessages: llmService.state.messages,
      ttsIsSpeaking: tts.state.isSpeaking,
      ttsAudioQueue: tts.state.audioQueue,
      messages: conversation.state.messages,
    }),
    [ 
      vad.state.isListening,
      vad.state.isDetecting,
      stt.state.isListening,
      stt.state.allowed,
      stt.state.desired,
      currentInterimTranscript,
      llmService.state.ready,
      llmService.state.loading,
      llmService.state.thinking,
      llmService.state.messages,
      tts.state.isSpeaking,
      tts.state.audioQueue,
      conversation.state.messages,  
    ]
  )

  // Return the unified service interface
  return {
    state,
    actions,
    services
  }
}
