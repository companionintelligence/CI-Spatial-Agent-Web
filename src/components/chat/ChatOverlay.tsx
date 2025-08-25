import { useCallback, useState, memo, useEffect } from 'react'

import { AppConfigState, type AppConfig, type AppState } from '../../app/appConfig'
import { ToggleButton } from '../common/ToggleButton'
import { ChatInput } from './ChatInput'
import { ControlPanel } from '../ControlPanel'
import type { AgentService } from '../../services/useAgent'
import type { XRStore } from '@react-three/xr'

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

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      agent.actions.submitMessage(agent.state.currentMessage)
    }
  }, [agent.actions, agent.state.currentMessage])

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
        onSubmit={agent.actions.submitMessage}
        onKeyPress={handleKeyPress}
        isRecording={config.microphone}
        vadDetecting={agent.state.vadIsDetecting}
        sttTranscript={agent.state.currentTranscript}
        sttListening={agent.state.sttIsListening}
      />

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
    </>
  )
})

ChatOverlay.displayName = 'ChatOverlay'
