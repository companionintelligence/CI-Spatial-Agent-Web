import type { XRStore } from '@react-three/xr'
import React, { useCallback, useRef } from 'react'
import { AvatarViewport } from '../components/AvatarViewport'
import { ChatOverlay } from '../components/chat/ChatOverlay'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LogoOverlay } from '../components/common/LogoOverlay'
import { config } from '../services/config'
import { useResponsiveLayout } from '../services/layoutService'
import { sceneConfig } from '../services/sceneTypes'
import { useAgent } from '../services/useAgent'

export const App = () => {
  useResponsiveLayout() // Layout service for responsive behavior

  const xrStore = useRef<XRStore | null>(null)

  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const agent = useAgent(config)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      agent.actions.submitMessage(agent.state.currentMessage)
    }
  }

  const handleToggleMicrophone = () => {
    agent.actions.toggleMicrophone()
  }

  const handleEnterARMode = useCallback(() => {
    if (!xrStore.current) return
    xrStore.current.enterAR().then(() => {
      // Enable STT when entering AR mode
      agent.actions.setRecording(true)
      agent.actions.updateConfig({ microphone: true })
      agent.actions.setSTTDesired(true)
    })
    console.log('AR + STT mode activated - click the AR button in the 3D view to enter AR')
  }, [agent.actions])

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
        <AvatarViewport
          sceneConfig={sceneConfig}
          visemeService={agent.services.visemes}
          emoteService={agent.services.emotes}
          setXRStore={setXRStore}
        />

        <LogoOverlay />

        <ChatOverlay
          message={agent.state.currentMessage}
          onMessageChange={agent.actions.updateCurrentMessage}
          onSubmit={agent.actions.submitMessage}
          onKeyPress={handleKeyPress}
          config={agent.state.config}
          isRecording={agent.state.isRecording}
          onToggleMicrophone={handleToggleMicrophone}
          onToggleCloudMode={() => agent.actions.updateConfig({ cloudMode: !agent.state.config.cloudMode })}
          onToggleBargeIn={() => agent.actions.updateConfig({ bargeInEnabled: !agent.state.config.bargeInEnabled })}
          onToggleAutoSubmit={() =>
            agent.actions.updateConfig({ autoSubmitEnabled: !agent.state.config.autoSubmitEnabled })
          }
          onToggleAgent={() => agent.actions.updateConfig({ agentEnabled: !agent.state.config.agentEnabled })}
          onEnterARMode={handleEnterARMode}
          vadDetecting={agent.state.vadIsDetecting}
          sttTranscript={agent.state.currentTranscript}
          ttsActive={agent.state.ttsIsSpeaking}
          sttListening={agent.state.sttIsListening}
        />

        <ChatPanel messages={agent.state.messages} />
      </div>
    </div>
  )
}
