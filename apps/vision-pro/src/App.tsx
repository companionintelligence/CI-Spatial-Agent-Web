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
  sceneConfig,
  useHasWebGPU,
  detectSurfaceSync,
  presetFor,
  type SceneActions,
  type XRStore,
  type ActivationState
} from '@ci-avatar/core'

// Surface-aware render budget: on the WebSpatial Vision Pro container the UA matches
// `visionOS|WebSpatial`, so this resolves to the vision-pro preset (DPR 1, foveation,
// WebGPU MToon). The same build falls back to desktop/mobile presets elsewhere.
const surface = detectSurfaceSync()
const renderPreset = presetFor(surface)

// Module-local: only `App` is imported from this file (see main.tsx).
const config = {
  vad: defaultVadConfig,
  tts: defaultTTSConfig,
  stt: defaultSTTConfig,
  llm: defaultLLMConfig
}

export const App = () => {
  useResponsiveLayout()

  const xrStore = useRef<XRStore | null>(null)
  const [appState, setAppState] = useSimpleStore(AppConfigState) as [AppConfig, (value: AppConfig) => void]
  const [sceneActions, setSceneActions] = useState<SceneActions | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [activationState, setActivationState] = useState<ActivationState>('unverified')
  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const agentConfig = useMemo(
    () => ({
      ...config,
      llm: {
        ...config.llm,
        activation_state: activationState
      },
      autoSubmitEnabled: appState.autoSubmitEnabled,
      bargeInEnabled: appState.bargeInEnabled,
      vad: {
        ...config.vad,
        microphoneEnabled: appState.microphone
      }
    }),
    [activationState, appState.autoSubmitEnabled, appState.bargeInEnabled, appState.microphone]
  )

  const agent = useAgent(agentConfig)

  const handleAppStateChange = useCallback((newAppState: AppConfig) => {
    setAppState(newAppState)
  }, [setAppState])

  const hasWebGPU = useHasWebGPU()
  // Honor the platform preset: some surfaces (e.g. Quest browser) have immature WebGPU,
  // so preferWebGPU gates the user toggle rather than forcing it everywhere.
  const webGPUEnabled = appState.webGPUEnabled && hasWebGPU && renderPreset.preferWebGPU

  useEffect(() => {
    const hasOnboarded = window.localStorage.getItem('ci_avatar_onboarded')
    if (!hasOnboarded) {
      setShowOnboarding(true)
    }
  }, [])

  const handleEnableMic = useCallback(() => {
    AppConfigState.set((prev) => ({ ...prev, microphone: true }))
    agent.actions.initializeVAD()
    setShowOnboarding(false)
    window.localStorage.setItem('ci_avatar_onboarded', 'true')
  }, [agent.actions])

  const handleSkipOnboarding = useCallback(() => {
    setActivationState((current) => current === 'unverified' && config.llm.llm_provider === 'script' ? 'demo-only' : current)
    setShowOnboarding(false)
    window.localStorage.setItem('ci_avatar_onboarded', 'true')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="relative h-screen w-full">
        <Viewport3D
          sceneConfig={sceneConfig}
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
          activationState={activationState}
          onActivationStateChange={setActivationState}
        />
        <ChatPanel
          messages={agent.state.messages.map((id) => 
            agent.services.conversation.actions.getMessagebyId(id)
          )}
          activationState={activationState}
        />
        <OnboardingOverlay
          isOpen={showOnboarding && !appState.microphone}
          onEnableMic={handleEnableMic}
          onSkip={handleSkipOnboarding}
          activationState={activationState}
          llmProvider={config.llm.llm_provider}
          onActivationStateChange={setActivationState}
        />
      </div>
    </div>
  )
}
