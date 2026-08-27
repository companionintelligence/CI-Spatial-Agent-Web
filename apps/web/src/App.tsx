import type { XRStore } from '@react-three/xr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSimpleStore } from '@hexafield/simple-store/react'

import {
  Viewport3D,
  AvatarCaptionOverlay,
  AvatarStatusPill,
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
  defaultSTTConfig,
  defaultLLMConfig,
  LLMSettingsState,
  TTSSettingsState,
  sceneConfig,
  useHasWebGPU,
  type SceneActions,
  type EnvironmentPreset,
  type ActivationState,
  type AvatarConversationStatus
} from '@ci-avatar/core'

// Module-local: only `App` is imported from this file (see main.tsx).
const config = {
  vad: defaultVadConfig,
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
  const [ttsSettings] = useSimpleStore(TTSSettingsState)
  const [sceneActions, setSceneActions] = useState<SceneActions | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [activationState, setActivationState] = useState<ActivationState>('unverified')
  const setXRStore = useCallback((store: XRStore) => {
    xrStore.current = store
  }, [])

  const agentConfig = useMemo(
    () => ({
      ...config,
      // Live LLM config resolved from runtime /config.json + user overrides.
      llm: {
        ...llmSettings,
        activation_state: activationState
      },
      // Live voice config, same precedence as the LLM: an appliance pointed at
      // its HeadTTS sidecar gets phoneme-accurate lip-sync with no rebuild.
      tts: ttsSettings,
      autoSubmitEnabled: appState.autoSubmitEnabled,
      bargeInEnabled: appState.bargeInEnabled,
      vad: {
        ...config.vad,
        microphoneEnabled: appState.microphone
      }
    }),
    [activationState, appState.autoSubmitEnabled, appState.bargeInEnabled, appState.microphone, llmSettings, ttsSettings]
  )

  const agent = useAgent(agentConfig)

  const handleAppStateChange = useCallback((newAppState: AppConfig) => {
    setAppState(newAppState)
  }, [setAppState])

  const hasWebGPU = useHasWebGPU()
  const webGPUEnabled = appState.webGPUEnabled && hasWebGPU
  const [voiceStatus, setVoiceStatus] = useState<AvatarConversationStatus>('idle')
  const [voiceCaption, setVoiceCaption] = useState('')
  const [voiceAnalyser, setVoiceAnalyser] = useState<AnalyserNode | undefined>(undefined)

  // TTS uses refs for frame-rate-sensitive state, so poll the small presentation
  // surface instead of forcing the render loop to become React stateful.
  useEffect(() => {
    const updateVoiceSurface = () => {
      const speechInfo = agent.services.tts.actions.getCurrentSpeechInfo()
      const isSpeaking = Boolean(speechInfo.text)
      const nextStatus: AvatarConversationStatus = isSpeaking
        ? 'speaking'
        : agent.state.llmLoading
          ? 'loading'
          : agent.state.llmThinking
            ? 'thinking'
            : agent.state.vadIsListening || agent.state.sttIsListening
              ? 'listening'
              : 'idle'
      setVoiceStatus(nextStatus)
      setVoiceAnalyser(agent.services.tts.actions.getAnalyser())
      setVoiceCaption(isSpeaking ? speechInfo.text : agent.state.currentTranscript)
    }
    updateVoiceSurface()
    const timer = window.setInterval(updateVoiceSurface, 100)
    return () => window.clearInterval(timer)
  }, [
    agent.services.tts.actions,
    agent.state.currentTranscript,
    agent.state.llmLoading,
    agent.state.llmThinking,
    agent.state.sttIsListening,
    agent.state.vadIsListening
  ])

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
    setActivationState(llmSettings.llm_provider === 'script' ? 'demo-only' : 'unverified')
    window.localStorage.setItem('ci_avatar_onboarded', 'true')
  }, [llmSettings.llm_provider])

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
        <AvatarStatusPill
          status={voiceStatus}
          analyser={voiceAnalyser}
          micError={!agent.state.sttAllowed ? 'Microphone access is unavailable' : null}
          onPillClick={() => {
            agent.actions.toggleMicrophone(true)
            agent.actions.startVADListening()
          }}
          onStopClick={() => {
            agent.actions.stopSpeaking()
            agent.actions.stopVADListening()
            agent.actions.toggleMicrophone(false)
          }}
        />
        <AvatarCaptionOverlay
          visible={voiceStatus === 'listening' || voiceStatus === 'speaking'}
          text={voiceCaption}
          speaker={voiceStatus === 'listening' ? 'user' : 'avatar'}
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
          llmProvider={llmSettings.llm_provider}
          onActivationStateChange={setActivationState}
        />
      </div>
    </div>
  )
}
