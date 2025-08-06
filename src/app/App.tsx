import type { XRStore } from '@react-three/xr'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AvatarViewport } from '../components/AvatarViewport'
import { ChatOverlay } from '../components/chat/ChatOverlay'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LogoOverlay } from '../components/common/LogoOverlay'
import type { WhisperData } from '../services/audioTypes'
import { useChatService } from '../services/chatService'
import { useResponsiveLayout } from '../services/layoutService'
import { useLLMService } from '../services/llm/llmService'
import type { LLMResponse, LLMStatusUpdate } from '../services/llm/llmTypes'
import { useSceneService } from '../services/sceneService'
import { useSTTService } from '../services/stt/sttService'
import { useVADService } from '../services/stt/vadService'
import { useTTSService } from '../services/tts/ttsService'
import { useVisemeService } from '../services/visemes/useVisemeService'
import { useEmoteService } from '../services/emote/useEmoteService'
import { emotionIntegrationService } from '../services/emotionIntegration'

export const App = () => {
  const chat = useChatService()
  useResponsiveLayout() // Layout service for responsive behavior
  const { sceneConfig } = useSceneService()

  const xrStore = useRef<XRStore | null>(null)
  const [isChatVisible, setIsChatVisible] = useState(true)

  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('')
  const [vadDetecting, setVadDetecting] = useState(false)
  // const [llmStatus, setLlmStatus] = useState<LLMStatusUpdate>({ color: 'loading', text: 'Initializing...' })

  const llmService = useLLMService()
  const interruptCounterRef = useRef(Date.now())

  const visemes = useVisemeService()
  const emotes = useEmoteService()

  const handleSpeechStart = useCallback(
    (_text: string, whisperData: WhisperData) => {
      const startTime = Date.now()
      visemes.actions.generateSequence(whisperData, startTime)
    },
    [visemes.actions]
  )

  const handleSpeechEnd = useCallback(() => {}, [])

  const tts = useTTSService({
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd
  })

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
    },
    onInterimTranscript: (text) => {
      setCurrentInterimTranscript(text)
    }
  })

  useEffect(() => {
    stt.actions.setDesired(vad.isDetecting)
  }, [vad.isDetecting, stt.actions])

  const responseCallbackRef = useCallback(
    (response: LLMResponse) => {
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
      console.log('Calling streamMessage with:', breath, response.final)
      chat.actions.streamMessage(breath, response.final)
    },
    [chat.state.config.agentEnabled, chat.state.messages.length, tts.actions, chat.actions, emotes]
  )

  const handleStatusUpdate = useCallback((status: LLMStatusUpdate) => {
    // setLlmStatus(status)
    console.log('LLM Status update:', status)
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

    stt.actions.setDesired(newRecordingState)
    setCurrentInterimTranscript('')
  }

  const handleEnterARMode = useCallback(() => {
    if (!xrStore.current) return
    xrStore.current.enterAR().then(() => {
      // Enable STT when entering AR mode
      chat.actions.setRecording(true)
      chat.actions.updateConfig({ microphone: true })
      vad.actions.updateConfig({ microphoneEnabled: true })
      stt.actions.setDesired(true)
      setCurrentInterimTranscript('')
    })
    console.log('AR + STT mode activated - click the AR button in the 3D view to enter AR')
  }, [chat.actions, vad.actions, stt.actions])

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
      {/* Main 3D Viewport - Full Screen */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          width: '100%'
        }}
      >
        <AvatarViewport sceneConfig={sceneConfig} visemeService={visemes} emoteService={emotes} setXRStore={setXRStore} />

        <LogoOverlay />

        <ChatOverlay
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
          onEnterARMode={handleEnterARMode}
          vadDetecting={vadDetecting}
          sttTranscript={currentInterimTranscript}
          ttsActive={tts.isSpeaking}
          sttListening={stt.isListening}
        />

        <ChatPanel
          messages={chat.state.messages}
          isVisible={isChatVisible}
          onToggleVisibility={() => setIsChatVisible(!isChatVisible)}
        />
      </div>
    </div>
  )
}
