import type { XRStore } from '@react-three/xr'
import { useCallback, useMemo, useRef } from 'react'
import { useSimpleStore } from '@hexafield/simple-store/react'

import {
  Viewport3D,
  ChatOverlay,
  ChatPanel,
  LogoOverlay,
  ControlOverlay,
  useAgent,
  useResponsiveLayout,
  AppConfigState,
  type AppConfig,
  defaultVadConfig,
  defaultTTSConfig,
  defaultSTTConfig,
  defaultLLMConfig,
  sceneConfig,
  useHasWebGPU
} from '@ci-avatar/core'

// Vision Pro specific: WebSpatial integration would go here
// import { ... } from '@webspatial/react-sdk'

export const config = {
  vad: defaultVadConfig,
  tts: defaultTTSConfig,
  stt: defaultSTTConfig,
  llm: defaultLLMConfig
}

export const App = () => {
  useResponsiveLayout()

  const xrStore = useRef<XRStore | null>(null)
  const [appState, setAppState] = useSimpleStore(AppConfigState)
  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const agentConfig = useMemo(
    () => ({
      ...config,
      autoSubmitEnabled: appState.autoSubmitEnabled,
      bargeInEnabled: appState.bargeInEnabled,
    }),
    [appState.autoSubmitEnabled, appState.bargeInEnabled]
  )

  const agent = useAgent(agentConfig)

  const handleAppStateChange = useCallback((newAppState: AppConfig) => {
    setAppState(newAppState)
    agentConfig.vad.microphoneEnabled = newAppState.microphone
  }, [agentConfig, setAppState])

  const hasWebGPU = useHasWebGPU()
  const webGPUEnabled = appState.webGPUEnabled && hasWebGPU

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="relative h-screen w-full">
        <Viewport3D
          sceneConfig={sceneConfig}
          visemeService={agent.services.visemes}
          emoteService={agent.services.emotes}
          animationService={agent.services.animations}
          setXRStore={setXRStore}
          webGPUEnabled={webGPUEnabled}
        />
        <LogoOverlay />
        <ChatOverlay config={appState} agent={agent} />
        <ControlOverlay
          config={appState}
          handleAppStateChange={handleAppStateChange}
          agent={agent}
          xrStore={xrStore.current!}
        />
        <ChatPanel
          messages={agent.state.messages.map((id) => 
            agent.services.conversation.actions.getMessagebyId(id)
          )}
        />
      </div>
    </div>
  )
}
