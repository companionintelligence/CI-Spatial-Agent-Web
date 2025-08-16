import type { XRStore } from '@react-three/xr'
import React, { useCallback, useRef, useState } from 'react'

import { AvatarViewport } from '../components/AvatarViewport'
import { ChatOverlay } from '../components/chat/ChatOverlay'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LogoOverlay } from '../components/common/LogoOverlay'
import { config } from './config'
import { useResponsiveLayout } from './layoutService'
import { sceneConfig } from './sceneTypes'
import type { AppConfig } from './types'
import { initialAppConfig } from './types'
import { useAgent } from '../services/useAgent'

export const App = () => {
  useResponsiveLayout() // Layout service for responsive behavior

  const xrStore = useRef<XRStore | null>(null)

  // Manage app state locally
  const [appConfig, setAppConfig] = useState<AppConfig>(initialAppConfig)
  const [isRecording, setIsRecording] = useState(false)

  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const updateConfig = useCallback((configUpdate: Partial<AppConfig>) => {
    setAppConfig((prev) => ({ ...prev, ...configUpdate }))
  }, [])

  // Combine service config with app config
  const agentConfig = {
    ...config,
    autoSubmitEnabled: appConfig.autoSubmitEnabled,
    bargeInEnabled: appConfig.bargeInEnabled
  }

  const agent = useAgent(agentConfig)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      agent.actions.submitMessage(agent.state.currentMessage)
    }
  }

  const handleToggleMicrophone = () => {
    const newRecordingState = !isRecording
    setIsRecording(newRecordingState)
    updateConfig({ microphone: newRecordingState })
    agent.actions.toggleMicrophone(isRecording)
  }

  const handleEnterARMode = useCallback(() => {
    if (!xrStore.current) return
    xrStore.current.enterAR().then(() => {
      // Enable STT when entering AR mode
      setIsRecording(true)
      updateConfig({ microphone: true })
      agent.actions.setSTTDesired(true)
    })
    console.log('AR + STT mode activated - click the AR button in the 3D view to enter AR')
  }, [updateConfig, agent.actions])

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
          animationService={agent.services.animations}
          setXRStore={setXRStore}
        />

        <LogoOverlay />

        <ChatOverlay
          message={agent.state.currentMessage}
          onMessageChange={agent.actions.updateCurrentMessage}
          onSubmit={agent.actions.submitMessage}
          onKeyPress={handleKeyPress}
          config={appConfig}
          isRecording={isRecording}
          onToggleMicrophone={handleToggleMicrophone}
          onToggleCloudMode={() => updateConfig({ cloudMode: !appConfig.cloudMode })}
          onToggleBargeIn={() => updateConfig({ bargeInEnabled: !appConfig.bargeInEnabled })}
          onToggleAutoSubmit={() => updateConfig({ autoSubmitEnabled: !appConfig.autoSubmitEnabled })}
          onToggleAgent={() => updateConfig({ agentEnabled: !appConfig.agentEnabled })}
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
