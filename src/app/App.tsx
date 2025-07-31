import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AvatarViewport } from '../components/AvatarViewport'
import { ChatHistory } from '../components/ChatHistory'
import { Header } from '../components/Header'
import { useChatService } from '../services/chatService'
import { useResponsiveLayout } from '../services/layoutService'
import { useLLMService } from '../services/llm/llmService'
import type { LLMResponse, LLMStatusUpdate } from '../services/llm/llmTypes'
import { useSceneService } from '../services/sceneService'
import { useSTTService } from '../services/stt/sttService'
import { useVADService } from '../services/stt/vadService'
import { useTTSService } from '../services/tts/ttsService'

export const App = () => {
  const chat = useChatService()
  const { isMobile } = useResponsiveLayout()
  const { sceneConfig } = useSceneService()

  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  const [llmStatus, setLlmStatus] = useState<LLMStatusUpdate>({ color: 'loading', text: 'Initializing...' })

  const llmService = useLLMService()
  const interruptCounterRef = useRef(Date.now())

  const submitMessage = React.useCallback(
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

  const tts = useTTSService()

  const vad = useVADService({
    onVADResult: (result) => {
      setVadDetecting(result.isSpeech)
    }
  })

  const stt = useSTTService({
    onPerform: (result) => {
      if (result.final) {
        if (result.text.trim() === 'stop') {
          const interrupt = Date.now()
          interruptCounterRef.current = interrupt

          if (tts.isSpeaking) {
            tts.actions.stopSpeaking()
          }

          console.log('STT: Stop command detected - barge-in activated')
          return
        }

        if (chat.state.config.autoSubmitEnabled) {
          chat.actions.updateCurrentMessage(result.text)
          setCurrentInterimTranscript('')
          /** @todo use proper state handling rather than timeout */
          submitMessage(result.text)
        } else {
          chat.actions.updateCurrentMessage(result.text)
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

  const responseCallbackRef = useCallback(
    (response: LLMResponse) => {
      const breath = response.breath
      if (chat.state.config.agentEnabled && breath) {
        tts.actions.speak(breath)
      }
      chat.actions.streamMessage(breath, response.final)
    },
    [chat.state.config.agentEnabled, tts.actions, chat.actions]
  )

  const handleStatusUpdate = useCallback((status: LLMStatusUpdate) => {
    setLlmStatus(status)
  }, [])

  useEffect(() => {
    llmService.actions.setStatusCallback(handleStatusUpdate)
    llmService.actions.setResponseCallback(responseCallbackRef)
  }, [llmService.actions, handleStatusUpdate, responseCallbackRef])

  useEffect(() => {
    if (llmService.config.llm_local === !chat.state.config.cloudMode) return
    llmService.actions.updateConfig({
      llm_local: !chat.state.config.cloudMode
    })
  }, [llmService.actions, llmService.config.llm_local, chat.state.config.cloudMode])

  React.useEffect(() => {
    stt.actions.setAllowed(!tts.isSpeaking)
  }, [tts.isSpeaking, stt.actions])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage(chat.state.currentMessage)
    }
  }

  const handleToggleMicrophone = () => {
    const newRecordingState = !chat.state.isRecording

    chat.actions.setRecording(newRecordingState)
    chat.actions.updateConfig({ microphone: newRecordingState })

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
            messages={chat.state.messages}
            message={chat.state.currentMessage}
            onMessageChange={chat.actions.updateCurrentMessage}
            onSubmit={submitMessage}
            onKeyPress={handleKeyPress}
            config={chat.state.config}
            isRecording={chat.state.isRecording}
            onToggleMicrophone={handleToggleMicrophone}
            onToggleCloudMode={() => chat.actions.updateConfig({ cloudMode: !chat.state.config.cloudMode })}
            onToggleBargeIn={() => chat.actions.updateConfig({ bargeInEnabled: !chat.state.config.bargeInEnabled })}
            onToggleAutoSubmit={() =>
              chat.actions.updateConfig({ autoSubmitEnabled: !chat.state.config.autoSubmitEnabled })
            }
            onToggleAgent={() => chat.actions.updateConfig({ agentEnabled: !chat.state.config.agentEnabled })}
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
          <AvatarViewport sceneConfig={sceneConfig}/>
        </div>
      </div>
    </div>
  )
}
