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
 *   audio: { vadThreshold: 0.8, microphoneEnabled: true }
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
 * // Toggle microphone listening
 * actions.toggleMicrophone()
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
 *   app: {
 *     autoSubmitEnabled: true,
 *     bargeInEnabled: true,
 *     agentEnabled: true
 *   }
 * })
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhisperData, VADResult, AudioConfigPartial, TTSConfigPartial, STTConfigPartial } from './audioTypes'
import { useChatService } from './chatService'
import type { LLMConfig, LLMResponse, LLMStatusUpdate, LLMPerformRequest } from './llm/llmTypes'
import { useLLMService } from './llm/llmService'
import { useSTTService } from './stt/sttService'
import { useVADService } from './stt/vadService'
import { useTTSService } from './tts/ttsService'
import { useVisemeService } from './visemes/useVisemeService'
import { useEmoteService } from './emote/useEmoteService'
import type { PerformanceData, EmotionType, GazeOptions } from './emote/emoteTypes'
import { emotionIntegrationService } from './emotionIntegration'
import type { AppConfig, ChatMessage } from './types'

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

// VRM and morph target interfaces for avatar integration
interface VRMObject {
  expressionManager: {
    setValue: (expression: string, value: number) => void
  }
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
  // App-level configuration
  app?: Partial<AppConfig>
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
  
  // Chat callbacks
  onMessageAdded?: (message: ChatMessage) => void
  onMessageUpdated?: (messages: ChatMessage[]) => void
  
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
    llmMessages: Array<{role: string, content: string}>
    
    // TTS state
    ttsIsSpeaking: boolean
    ttsAudioQueue: number
    
    // Chat state
    messages: ChatMessage[]
    currentMessage: string
    isRecording: boolean
    config: AppConfig
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
    speak: (text: string) => void
    stopSpeaking: () => void
    addToTTSQueue: (audioBuffer: ArrayBuffer) => void
    processTTSQueue: () => void
    
    // Chat actions
    addMessage: (text: string, isUser: boolean) => void
    updateCurrentMessage: (message: string) => void
    clearCurrentMessage: () => void
    setRecording: (recording: boolean) => void
    updateConfig: (config: Partial<AppConfig>) => void
    
    // Convenience actions
    submitMessage: (message: string) => void
    toggleMicrophone: () => void
    triggerBargein: () => void
    
    // Viseme actions (for external avatar control)
    setupVisemesForVRM: (vrm: VRMObject) => void
    setupVisemesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    updateVisemes: (currentTime: number) => void
    applyVisemesToRig: (currentTime: number, amplify?: number) => void
    resetVisemes: () => void
    
    // Emote actions (for external avatar control)
    setupEmotesForVRM: (vrm: VRMObject) => void
    setupEmotesForMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    setEmotion: (emotion: EmotionType) => void
    performAction: (performanceData: PerformanceData) => void
    triggerGaze: (options?: GazeOptions) => void
    updateEmotes: (currentTime?: number) => void
    applyEmotesToVRM: (vrm: VRMObject) => void
    applyEmotesToMorphTargets: (morphs: MorphTargetObject[], dictionary: Record<string, number[]>) => void
    resetEmotes: () => void
    onEmoteBargein: () => void
  }
  
  // Service instances (for advanced usage)
  services: {
    chat: ReturnType<typeof useChatService>
    vad: ReturnType<typeof useVADService>
    stt: ReturnType<typeof useSTTService>
    llm: ReturnType<typeof useLLMService>
    tts: ReturnType<typeof useTTSService>
    visemes: ReturnType<typeof useVisemeService>
    emotes: ReturnType<typeof useEmoteService>
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
  remote: false
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
export const useAgent = (
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): AgentService => {
  // Merge configurations with defaults
  const audioConfig = { ...defaultAudioConfig, ...config.audio }
  const ttsConfig = { ...defaultTTSConfig, ...config.tts }
  const sttConfig = { ...defaultSTTConfig, ...config.stt }
  const llmConfig = { ...defaultLLMConfig, ...config.llm }

  // Internal state
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  const interruptCounterRef = useRef(Date.now())

  // Initialize chat service with app config if provided
  const chat = useChatService()
  
  // Apply app config overrides if provided
  useEffect(() => {
    if (config.app) {
      chat.actions.updateConfig(config.app)
    }
  }, [config.app, chat.actions])

  // Initialize viseme and emote services
  const visemes = useVisemeService()
  const emotes = useEmoteService()

  // Initialize LLM service
  const llmService = useLLMService({
    config: llmConfig,
    onStatus: (status: LLMStatusUpdate) => {
      callbacks.onLLMStatus?.(status)
    },
    onResponse: (response: LLMResponse) => {
      const breath = response.breath
      if (chat.state.config.agentEnabled && breath) {
        tts.actions.speak(breath)

        // Analyze the response for emotional content and trigger appropriate emote
        const message = {
          id: Date.now().toString(),
          text: breath,
          isUser: false,
          timestamp: Date.now()
        }
        const performanceData = emotionIntegrationService.createPerformanceFromMessage(
          message,
          chat.state.messages.length
        )

        // Trigger emote performance based on the response
        emotes.performAction(performanceData)
      }

      chat.actions.streamMessage(breath, response.final)
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
      emotes.reset()
      callbacks.onTTSSpeechEnd?.()
    }
  })

  // Services that need to be responsive to app state changes
  const vadConfigWithState = {
    ...audioConfig,
    microphoneEnabled: chat.state.isRecording
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
          emotes.onBargeIn()

          console.log('STT: Stop command detected - barge-in activated')
          return
        }

        if (chat.state.config.autoSubmitEnabled) {
          chat.actions.addMessage(result.text, true)
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
          bargein: chat.state.config.bargeInEnabled,
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

        chat.actions.addMessage(userMessage, true)
        chat.actions.clearCurrentMessage()

        const interrupt = Date.now()
        interruptCounterRef.current = interrupt

        llmService.actions.processUserInput({
          text: userMessage,
          human: true,
          final: true,
          bargein: chat.state.config.bargeInEnabled,
          interrupt
        })
        chat.actions.clearCurrentMessage()
      }
    },
    [chat.state.config.bargeInEnabled, chat.actions, llmService.actions]
  )

  const toggleMicrophone = useCallback(() => {
    const newRecordingState = !chat.state.isRecording
    chat.actions.setRecording(newRecordingState)
    chat.actions.updateConfig({ microphone: newRecordingState })

    stt.actions.setDesired(newRecordingState)
    setCurrentInterimTranscript('')
  }, [chat.state.isRecording, chat.actions, stt.actions])

  const triggerBargein = useCallback(() => {
    const interrupt = Date.now()
    interruptCounterRef.current = interrupt

    if (tts.isSpeaking) {
      tts.actions.stopSpeaking()
    }

    emotes.onBargeIn()
  }, [tts.isSpeaking, tts.actions, emotes])

  // Return the unified service interface
  return {
    state: {
      // VAD state
      vadIsListening: vad.isListening,
      vadIsDetecting: vadDetecting,

      // STT state
      sttIsListening: stt.isListening,
      sttAllowed: stt.allowed,
      sttDesired: stt.desired,
      currentTranscript: currentInterimTranscript,

      // LLM state
      llmReady: llmService.state.ready,
      llmLoading: llmService.state.loading,
      llmThinking: llmService.state.thinking,
      llmMessages: llmService.state.messages,

      // TTS state
      ttsIsSpeaking: tts.isSpeaking,
      ttsAudioQueue: tts.audioQueue,

      // Chat state
      messages: chat.state.messages,
      currentMessage: chat.state.currentMessage,
      isRecording: chat.state.isRecording,
      config: chat.state.config
    },

    actions: {
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
      addToTTSQueue: tts.actions.addToQueue,
      processTTSQueue: tts.actions.processQueue,

      // Chat actions
      addMessage: chat.actions.addMessage,
      updateCurrentMessage: chat.actions.updateCurrentMessage,
      clearCurrentMessage: chat.actions.clearCurrentMessage,
      setRecording: chat.actions.setRecording,
      updateConfig: chat.actions.updateConfig,

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
      setupEmotesForVRM: emotes.setupForVRM,
      setupEmotesForMorphTargets: emotes.setupForMorphTargets,
      setEmotion: emotes.setEmotion,
      performAction: emotes.performAction,
      triggerGaze: emotes.triggerGaze,
      updateEmotes: emotes.update,
      applyEmotesToVRM: emotes.applyToVRM,
      applyEmotesToMorphTargets: emotes.applyToMorphTargets,
      resetEmotes: emotes.reset,
      onEmoteBargein: emotes.onBargeIn
    },

    services: {
      chat,
      vad,
      stt,
      llm: llmService,
      tts,
      visemes,
      emotes
    }
  }
}
