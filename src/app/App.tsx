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

  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  const [llmStatus, setLlmStatus] = useState<LLMStatusUpdate>({ color: 'loading', text: 'Initializing...' })

  const llmService = useLLMService()
  const interruptCounterRef = useRef(Date.now())

  const tts = useTTSService()

  const vad = useVADService({
    onVADResult: (result) => {
      setVadDetecting(result.isSpeech)
    }
  })

  const stt = useSTTService({
    onPerform: (result) => {
      if (state.currentMessage.trim().length > 0) {
        return
      }

      if (result.text.startsWith('stop')) {
        const interrupt = Date.now()
        interruptCounterRef.current = interrupt

        if (tts.isSpeaking) {
          tts.actions.stopSpeaking()
        }

        console.log('STT: Stop command detected - barge-in activated')
        return
      }

      if (result.final) {
        if (state.config.autoSubmitEnabled) {
          actions.updateCurrentMessage(result.text)
          setTimeout(() => {
            actions.submitMessage()
            setCurrentInterimTranscript('')
          }, 100)
        } else {
          actions.updateCurrentMessage(result.text)
          setCurrentInterimTranscript('')
        }
      } else {
        setCurrentInterimTranscript(result.text)
      }
    },
    onInterimTranscript: (text) => {
      setCurrentInterimTranscript(text)
    }
  })

  const responseCallbackRef = useRef<(response: LLMResponse) => void>(() => {})

  useEffect(() => {
    responseCallbackRef.current = (response) => {
      const trimmedText = response.text.trim()
      if (trimmedText) {
        const breath = response.breath.trim()
        if (state.config.agentEnabled && breath) {
          tts.actions.speak(breath)
        }
        if (response.final) {
          actions.addMessage(trimmedText, false)
        }
      }
    }
  }, [state.config.agentEnabled, tts.actions, actions])

  const handleStatusUpdate = useCallback((status: LLMStatusUpdate) => {
    setLlmStatus(status)
  }, [])

  useEffect(() => {
    llmService.actions.setStatusCallback(handleStatusUpdate)
    llmService.actions.setResponseCallback(responseCallbackRef.current)
  }, [llmService.actions, handleStatusUpdate])

  useEffect(() => {
    if (llmService.config.llm_local === !state.config.cloudMode) return
    llmService.actions.updateConfig({
      llm_local: !state.config.cloudMode
    })
  }, [llmService.actions, llmService.config.llm_local, state.config.cloudMode])

  const submitMessage = React.useCallback(() => {
    if (state.currentMessage.trim()) {
      const userMessage = state.currentMessage.trim()

      actions.addMessage(userMessage, true)
      actions.clearCurrentMessage()

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

  React.useEffect(() => {
    actions.submitMessage = submitMessage
  }, [submitMessage, actions])

  React.useEffect(() => {
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

    actions.setRecording(newRecordingState)
    actions.updateConfig({ microphone: newRecordingState })

    vad.actions.updateConfig({ microphoneEnabled: newRecordingState })

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
          <div style={{ marginBottom: '4px' }}>
            🤖 LLM Mode: {state.config.cloudMode ? 'Cloud' : 'Local'}
            {!state.config.cloudMode && (
              <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                ({import.meta.env.VITE_OLLAMA_API_URL ? 'Ollama→WebLLM' : 'WebLLM'})
              </span>
            )}
          </div>
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
