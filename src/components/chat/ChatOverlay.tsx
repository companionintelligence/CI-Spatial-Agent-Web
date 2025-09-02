import { useCallback, useState, memo } from 'react'

import { AppConfigState, type AppConfig } from '../../app/appConfig'
import { ToggleButton } from '../common/ToggleButton'
import { ChatInput } from './ChatInput'
import { ControlPanel } from '../ControlPanel'
import KeywordAnimationTester from '../KeywordAnimationTester'
import type { AgentService } from '../../services/useAgent'
import type { XRStore } from '@react-three/xr'
import { shouldTriggerBargeIn } from '../../services/integration/emotionIntegration'

interface ChatOverlayProps {
  config: AppConfig
  handleAppStateChange: (newAppState: AppConfig) => void
  agent: AgentService
  xrStore: XRStore
}

export const ChatOverlay = memo(({
  config,
  handleAppStateChange,
  agent,
  xrStore,
}: ChatOverlayProps) => {
  const [isButtonsVisible, setIsButtonsVisible] = useState(true)
  const [isKeywordTesterVisible, setIsKeywordTesterVisible] = useState(false)

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(agent.state.currentMessage)
    }
  }, [agent.actions, agent.state.currentMessage])

  const handleSubmit = useCallback((message: string) => {
    if(shouldTriggerBargeIn({text: message, isUser: true, id: '', timestamp: 0})) {
      agent.actions.triggerBargein()
    }
    agent.actions.submitMessage(message)
  }, [agent.actions])

  const handleEnterARMode = useCallback(() => {
    if (!xrStore) return
    xrStore.enterAR().then(() => {
      AppConfigState.set((prev) => ({ ...prev, microphone: true }))
      agent.actions.setSTTDesired(true)
    })
    console.log('AR + STT mode activated - click the AR button in the 3D view to enter AR')
  }, [xrStore, agent.actions])

  return (
    <>
      {/* Chat Input */}
      <ChatInput
        message={agent.state.currentMessage}
        onMessageChange={agent.actions.updateCurrentMessage}
        onSubmit={handleSubmit}
        onKeyPress={handleKeyPress}
        isRecording={config.microphone}
        vadDetecting={agent.state.vadIsDetecting}
        sttTranscript={agent.state.currentTranscript}
        sttListening={agent.state.sttIsListening}
      />

      {/* Keyword Animation Tester */}
      {isKeywordTesterVisible && (
        <div 
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            right: '1rem',
            maxWidth: '60rem',
            margin: '0 auto',
            zIndex: 900
          }}
        >
          <KeywordAnimationTester />
        </div>
      )}

      {/* Control Buttons */}
      <ControlPanel
        config={config} 
        isRecording={config.microphone}
        handleAppStateChange={handleAppStateChange}
        onEnterARMode={handleEnterARMode}
        vadDetecting={agent.state.vadIsDetecting}
        isVisible={isButtonsVisible}
      />

      {/* Controls Toggle Button */}
      <ToggleButton
        isVisible={isButtonsVisible}
        onToggle={() => setIsButtonsVisible(!isButtonsVisible)}
        label="Controls"
        position="bottom-left"
      />
      
      {/* Keyword Tester Toggle Button */}
      <ToggleButton
        isVisible={isKeywordTesterVisible}
        onToggle={() => setIsKeywordTesterVisible(!isKeywordTesterVisible)}
        label="Animation Tester"
        position="bottom-right"
      />
    </>
  )
})

ChatOverlay.displayName = 'ChatOverlay'
