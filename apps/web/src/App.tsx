import type { XRStore } from '@react-three/xr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSimpleStore } from '@hexafield/simple-store/react'

import {
  Viewport3D,
  ChatOverlay,
  ChatPanel,
  LogoOverlay,
  ControlOverlay,
  OnboardingOverlay,
  useAgent,
  useResponsiveLayout,
  AppConfigState,
  type AppConfig,
  defaultVadConfig,
  defaultTTSConfig,
  defaultSTTConfig,
  defaultLLMConfig,
  LLMSettingsState,
  sceneConfig,
  useHasWebGPU,
  type SceneActions,
  type EnvironmentPreset
} from '@ci-avatar/core'

// Module-local: only `App` is imported from this file (see main.tsx).
const config = {
  vad: defaultVadConfig,
  tts: defaultTTSConfig,
  stt: defaultSTTConfig,
  llm: defaultLLMConfig
}

// ?env=datacenter-1970s opts into the 1970s research-datacenter environment around the
// avatar (see @ci-avatar/core's DatacenterDiorama). Default stays the plain studio view.
function resolveEnvironmentOverride(): EnvironmentPreset | undefined {
  const raw = new URLSearchParams(location.search).get('env')
  if (raw === 'datacenter-1970s' || raw === 'datacenter1970s') return 'datacenter-1970s'
  if (raw === 'none') return 'none'
  return undefined
}

export const App = () => {
  useResponsiveLayout()

  const activeSceneConfig = useMemo(() => {
    const environment = resolveEnvironmentOverride()
    return environment ? { ...sceneConfig, environment } : sceneConfig
  }, [])

  const xrStore = useRef<XRStore | null>(null)
  const [appState, setAppState] = useSimpleStore(AppConfigState)
  const [llmSettings] = useSimpleStore(LLMSettingsState)
  const [sceneActions, setSceneActions] = useState<SceneActions | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const agentConfig = useMemo(
    () => ({
      ...config,
      // Live LLM config resolved from runtime /config.json + user overrides.
      llm: llmSettings,
      autoSubmitEnabled: appState.autoSubmitEnabled,
      bargeInEnabled: appState.bargeInEnabled,
      vad: {
        ...config.vad,
        microphoneEnabled: appState.microphone
      }
    }),
    [appState.autoSubmitEnabled, appState.bargeInEnabled, appState.microphone, llmSettings]
  )

  const agent = useAgent(agentConfig)

  const handleAppStateChange = useCallback((newAppState: AppConfig) => {
    setAppState(newAppState)
  }, [setAppState])

  const hasWebGPU = useHasWebGPU()
  const webGPUEnabled = appState.webGPUEnabled && hasWebGPU

  useEffect(() => {
    const hasOnboarded = window.localStorage.getItem('ci_avatar_onboarded')
    if (!hasOnboarded) {
      setShowOnboarding(true)
    }
  }, [])

  const handleEnableMic = useCallback(() => {
    AppConfigState.set((prev) => ({ ...prev, microphone: true }))
    setShowOnboarding(false)
    window.localStorage.setItem('ci_avatar_onboarded', 'true')
  }, [])

  const handleSkipOnboarding = useCallback(() => {
    setShowOnboarding(false)
    window.localStorage.setItem('ci_avatar_onboarded', 'true')
  }, [])

  return (
    <div className="app-container">
      <div className="viewport-container">
        <Viewport3D
          sceneConfig={activeSceneConfig}
          visemeService={agent.services.visemes}
          emoteService={agent.services.emotes}
          animationService={agent.services.animations}
          ttsService={agent.services.tts}
          setXRStore={setXRStore}
          onSceneActionsReady={setSceneActions}
          webGPUEnabled={webGPUEnabled}
        />
        <LogoOverlay />
        <ChatOverlay config={appState} agent={agent} />
        <ControlOverlay
          config={appState}
          handleAppStateChange={handleAppStateChange}
          agent={agent}
          xrStore={xrStore.current}
          sceneActions={sceneActions}
        />
        <ChatPanel
          messages={agent.state.messages.map((id) => 
            agent.services.conversation.actions.getMessagebyId(id)
          )}
        />
        <OnboardingOverlay
          isOpen={showOnboarding && !appState.microphone}
          onEnableMic={handleEnableMic}
          onSkip={handleSkipOnboarding}
        />
      </div>
    </div>
  )
}
