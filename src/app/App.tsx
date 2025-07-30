import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AvatarViewport } from '../components/AvatarViewport'
import { ChatHistory } from '../components/ChatHistory'
import { Header } from '../components/Header'
import {
  useChatService,
  useLLMService,
  useResponsiveLayout,
  useSceneService,
  useSTTService,
  useTTSService,
  useVADService,
  type LLMResponse,
  type LLMStatusUpdate
} from '../services'

export const App = () => {
  const { state, actions } = useChatService()
  const { isMobile } = useResponsiveLayout()
  const { sceneConfig, avatarConfig } = useSceneService()

  // State for audio integration
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  const [llmStatus, setLlmStatus] = useState<LLMStatusUpdate>({ color: 'loading', text: 'Initializing...' })

  // LLM service integration
  const llmService = useLLMService()
  const interruptCounterRef = useRef(Date.now())

  // Initialize services first
  // TTS service
  const tts = useTTSService()

  // VAD service with callbacks
  const vad = useVADService({
    onVADResult: (result) => {
      setVadDetecting(result.isSpeech)
    }
  })

  // STT service with callbacks (archived system style)
  const stt = useSTTService({
    onPerform: (result) => {
      //   console.log('STT: Perform result:', result)

      // Handle typing interference like the archive
      if (state.currentMessage.trim().length > 0) {
        // console.log('STT: Blocking spoken utterance while typing:', result.text)
        return
      }

      // Handle special 'stop' command like the archive
      if (result.text.startsWith('stop')) {
        // Implement barge-in by interrupting LLM generation
        const interrupt = Date.now()
        interruptCounterRef.current = interrupt

        // Stop TTS if speaking
        if (tts.isSpeaking) {
          tts.actions.stopSpeaking()
        }

        console.log('STT: Stop command detected - barge-in activated')
        return
      }

      // Handle interim vs final results like the archive
      if (result.final) {
        // Final result
        if (state.config.autoSubmitEnabled) {
          // Auto-submit like the archive
          actions.updateCurrentMessage(result.text)
          setTimeout(() => {
            actions.submitMessage()
            setCurrentInterimTranscript('')
          }, 100)
        } else {
          // Just update the input without submitting
          actions.updateCurrentMessage(result.text)
          setCurrentInterimTranscript('')
        }
      } else {
        // Interim result - show in input field but don't submit
        setCurrentInterimTranscript(result.text)
      }
    },
    onInterimTranscript: (text) => {
      setCurrentInterimTranscript(text)
    }
  })

  // Create stable callback refs to avoid useEffect loops
  const responseCallbackRef = useRef<(response: LLMResponse) => void>(() => {})

  // Update callback ref when dependencies change
  useEffect(() => {
    responseCallbackRef.current = (response) => {
      if (response.text.trim()) {
        // For streaming responses, speak each breath immediately like archive
        if (state.config.agentEnabled && response.breath.trim()) {
          tts.actions.speak(response.breath.trim())
        }

        // Only add complete responses to chat history
        if (response.final) {
          actions.addMessage(response.text.trim(), false)
        }
      }
    }
  }, [state.config.agentEnabled, tts.actions, actions])

  // Setup LLM callbacks (stable refs to avoid recursion)
  const handleStatusUpdate = useCallback((status: LLMStatusUpdate) => {
    setLlmStatus(status)
    console.log('LLM Status:', status)
  }, [])

  useEffect(() => {
    llmService.actions.setStatusCallback(handleStatusUpdate)
    llmService.actions.setResponseCallback(responseCallbackRef.current)
  }, [llmService.actions, handleStatusUpdate])

  // Update LLM config when app config changes
  useEffect(() => {
    if (llmService.config.llm_local === !state.config.cloudMode) return
    llmService.actions.updateConfig({
      llm_local: !state.config.cloudMode
    })
  }, [llmService.actions, llmService.config.llm_local, state.config.cloudMode])

  // Handle message submission to LLM
  const submitMessage = React.useCallback(() => {
    if (state.currentMessage.trim()) {
      const userMessage = state.currentMessage.trim()

      // Add user message to chat
      actions.addMessage(userMessage, true)
      actions.clearCurrentMessage()

      // Send to LLM with proper interrupt handling like the archive
      const interrupt = Date.now()
      interruptCounterRef.current = interrupt

      llmService.actions.processUserInput({
        text: userMessage,
        human: true,
        final: true,
        bargein: state.config.bargeInEnabled,
        interrupt
      })
    }
  }, [state.currentMessage, state.config.bargeInEnabled, actions, llmService.actions])

  // Override the chat service submit with LLM integration
  React.useEffect(() => {
    actions.submitMessage = submitMessage
  }, [submitMessage, actions])

  // Handle noisy config (archived system pattern) - disable STT when TTS is speaking
  React.useEffect(() => {
    // setAllowed(false) when TTS is speaking, setAllowed(true) when not
    stt.actions.setAllowed(!tts.isSpeaking)
  }, [tts.isSpeaking, stt.actions])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      actions.submitMessage()
    }
  }

  const handleToggleMicrophone = () => {
    const newRecordingState = !state.isRecording
    // console.log('Toggling microphone:', { from: state.isRecording, to: newRecordingState })

    actions.setRecording(newRecordingState)
    actions.updateConfig({ microphone: newRecordingState })

    // Update VAD service
    vad.actions.updateConfig({ microphoneEnabled: newRecordingState })

    // Update STT service using archived system pattern (setDesired)
    stt.actions.setDesired(true)
    setCurrentInterimTranscript('')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'radial-gradient(circle at top, #0F1113 0%, #1B1E20 100%)',
        color: '#FFFFFF',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontWeight: 400,
        lineHeight: 1.5
      }}
    >
      {/* Audio Debug Status (optional, can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#FFFFFF',
            padding: '16px',
            borderRadius: '16px',
            fontSize: '0.75rem',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontWeight: 400,
            lineHeight: 1.5,
            zIndex: 1000,
            boxShadow: '0 8px 40px rgba(0,0,0,0.32)',
            transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div style={{ marginBottom: '4px' }}>🎤 Recording: {state.isRecording ? '✅' : '❌'}</div>
          <div style={{ marginBottom: '4px' }}>🟢 VAD Detecting: {vadDetecting ? '✅' : '❌'}</div>
          <div style={{ marginBottom: '4px' }}>🗣️ STT Listening: {stt.isListening ? '✅' : '❌'}</div>
          <div style={{ marginBottom: '4px' }}>
            🔇 STT Allowed: {stt.allowed ? '✅' : '❌'} (noisy={!stt.allowed})
          </div>
          <div style={{ marginBottom: '4px' }}>🎯 STT Desired: {stt.desired ? '✅' : '❌'}</div>
          <div style={{ marginBottom: '4px' }}>📝 Interim: "{currentInterimTranscript}"</div>
          <div style={{ marginBottom: '4px' }}>🔊 TTS Speaking: {tts.isSpeaking ? '✅' : '❌'}</div>
          <div style={{ marginBottom: '4px' }}>🤖 LLM Mode: {state.config.cloudMode ? 'Cloud' : 'Local'}</div>
          <div
            style={{
              marginBottom: '4px',
              color: llmStatus.color === 'ready' ? '#4ade80' : llmStatus.color === 'loading' ? '#fbbf24' : '#ef4444'
            }}
          >
            🧠 LLM: {llmStatus.text}
          </div>
          <div>💭 LLM Thinking: {llmService.state.thinking ? '✅' : '❌'}</div>
        </div>
      )}

      <Header />

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column-reverse' : 'row',
          flex: 1,
          height: '100%',
          gap: '24px',
          padding: '0 24px 24px 24px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: isMobile ? '100%' : '36%',
            minWidth: isMobile ? 'auto' : '300px'
          }}
        >
          <ChatHistory
            messages={state.messages}
            message={state.currentMessage}
            onMessageChange={actions.updateCurrentMessage}
            onSubmit={actions.submitMessage}
            onKeyPress={handleKeyPress}
            config={state.config}
            isRecording={state.isRecording}
            onToggleMicrophone={handleToggleMicrophone}
            onToggleCloudMode={() => actions.updateConfig({ cloudMode: !state.config.cloudMode })}
            onToggleBargeIn={() => actions.updateConfig({ bargeInEnabled: !state.config.bargeInEnabled })}
            onToggleAutoSubmit={() => actions.updateConfig({ autoSubmitEnabled: !state.config.autoSubmitEnabled })}
            onToggleAgent={() => actions.updateConfig({ agentEnabled: !state.config.agentEnabled })}
            vadDetecting={vadDetecting}
            sttTranscript={currentInterimTranscript}
            ttsActive={tts.isSpeaking}
            sttListening={stt.isListening}
          />
        </div>
        <div
          style={{
            height: '100%',
            width: isMobile ? '100%' : '64%',
            minWidth: isMobile ? 'auto' : '400px'
          }}
        >
          <AvatarViewport sceneConfig={sceneConfig} avatarConfig={avatarConfig} />
        </div>
      </div>
    </div>
  )
}
