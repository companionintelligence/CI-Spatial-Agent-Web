import React, { useState } from 'react'
import { AvatarViewport } from '../components/AvatarViewport'
import { ChatHistory } from '../components/ChatHistory'
import { ChatInput } from '../components/ChatInput'
import { Header } from '../components/Header'
import {
  useChatService,
  useResponsiveLayout,
  useSceneService,
  useSTTService,
  useTTSService,
  useVADService
} from '../services'

export const App = () => {
  const { state, actions } = useChatService()
  const { isMobile } = useResponsiveLayout()
  const { sceneConfig, avatarConfig } = useSceneService()

  // State for audio integration
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)

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
        // This would be used for barge-in functionality
        // console.log('STT: Stop command detected')
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

  // TTS service
  const tts = useTTSService()

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

  // Handle chat responses with TTS
  React.useEffect(() => {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1]
      if (!lastMessage.isUser && state.config.agentEnabled) {
        // Speak the agent's response
        tts.actions.speak(lastMessage.text)
      }
    }
  }, [state.messages, state.config.agentEnabled, tts])

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
        overflow: 'hidden',
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: '#1A1A1A',
        color: '#095D72',
        fontFamily: "'Montserrat', 'Open Sans', sans-serif"
      }}
    >
      {/* Audio Debug Status (optional, can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontSize: '12px',
            zIndex: 1000
          }}
        >
          <div>🎤 Recording: {state.isRecording ? '✅' : '❌'}</div>
          <div>🟢 VAD Detecting: {vadDetecting ? '✅' : '❌'}</div>
          <div>🗣️ STT Listening: {stt.isListening ? '✅' : '❌'}</div>
          <div>
            � STT Allowed: {stt.allowed ? '✅' : '❌'} (noisy={!stt.allowed})
          </div>
          <div>🎯 STT Desired: {stt.desired ? '✅' : '❌'}</div>
          <div>�📝 Interim: "{currentInterimTranscript}"</div>
          <div>🔊 TTS Speaking: {tts.isSpeaking ? '✅' : '❌'}</div>
        </div>
      )}

      <Header />

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flex: 1,
          gap: '10px',
          overflow: 'hidden'
        }}
      >
        <ChatHistory messages={state.messages} />
        <AvatarViewport sceneConfig={sceneConfig} avatarConfig={avatarConfig} />
      </div>

      <ChatInput
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
  )
}
