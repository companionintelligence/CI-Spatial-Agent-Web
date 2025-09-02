import type { XRStore } from '@react-three/xr'
import { useCallback, useMemo, useRef } from 'react'

import { AvatarViewport } from '../components/AvatarViewport'
import { ChatOverlay } from '../components/chat/ChatOverlay'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LogoOverlay } from '../components/common/LogoOverlay'
import { useAgent } from '../services/useAgent'
import { useResponsiveLayout } from './layoutService'
import { sceneConfig } from './sceneTypes'
import { AppConfigState, type AppConfig } from './appConfig'
import { defaultVadConfig } from '../services/vad/vadConfig'
import { defaultTTSConfig } from '../services/tts/ttsConfig'
import { defaultSTTConfig } from '../services/stt/sttConfig'
import { defaultLLMConfig } from '../services/llm/llmConfig'
import { defaultCameraConfig } from '../services/camera/cameraConfig'
import { useSimpleStore } from '@hexafield/simple-store/react'

export const config = {
  vad: defaultVadConfig,
  tts: defaultTTSConfig,
  stt: defaultSTTConfig,
  llm: defaultLLMConfig,
  camera: defaultCameraConfig
}


export const App = () => {
  useResponsiveLayout() // Layout service for responsive behavior

  const xrStore = useRef<XRStore | null>(null)
  const [appState, setAppState] = useSimpleStore(AppConfigState)
  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])


  const agentConfig = useMemo(
    () => ({
      ...config,
      camera: {
        ...config.camera,
        enabled: appState.cameraEnabled,
        backend_enabled: appState.cameraBackendEnabled
      },
      autoSubmitEnabled: appState.autoSubmitEnabled,
      bargeInEnabled: appState.bargeInEnabled,
    }),
    [ appState.autoSubmitEnabled, appState.bargeInEnabled, appState.cameraEnabled, appState.cameraBackendEnabled]
  )

  const agent = useAgent(agentConfig)

  const handleAppStateChange = useCallback((newAppState: AppConfig) => {
    setAppState(newAppState)
    agentConfig.vad.microphoneEnabled = newAppState.microphone
    
    // Update camera configuration when settings change
    if (newAppState.cameraEnabled !== appState.cameraEnabled) {
      if (newAppState.cameraEnabled) {
        agent.actions.initializeCamera()
      } else {
        agent.actions.stopCameraStreaming()
      }
    }
    
    if (newAppState.cameraBackendEnabled !== appState.cameraBackendEnabled && newAppState.cameraEnabled) {
      if (newAppState.cameraBackendEnabled) {
        agent.actions.startCameraStreaming()
      } else {
        agent.actions.stopCameraStreaming()
      }
    }
  }, [agentConfig, appState.cameraEnabled, appState.cameraBackendEnabled, agent.actions])

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
          config={appState}
          handleAppStateChange={handleAppStateChange}
          agent={agent}
          xrStore={xrStore.current!}    
        />

        <ChatPanel messages={agent.state.messages} />
      </div>
    </div>
  )
}
