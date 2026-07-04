import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { ToggleButton } from '../common/ToggleButton'
import type { XRStore } from '@react-three/xr'
import { AppConfigState, type AppConfig } from '../../app/appConfig'
import type { AgentService } from '../../services/useAgent'
import { ControlPanel } from './ControlPanel'
import { SettingsPanel } from './SettingsPanel'
import type { SceneActions } from '../scene/Scene3D'
import { useXRLayout } from '../../utils/useXRLayout'

interface ControlOverlayProps {
  config: AppConfig
  handleAppStateChange: (newAppState: AppConfig) => void
  agent: AgentService
  xrStore: XRStore | null
  sceneActions?: SceneActions | null
}


export const ControlOverlay = memo(({
  config,
  handleAppStateChange,
  agent,
  xrStore,
  sceneActions
}: ControlOverlayProps) => {
  const [isButtonsVisible, setIsButtonsVisible] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [xrMode, setXrMode] = useState<XRSessionMode | null>(null)
  const [xrSessionActive, setXrSessionActive] = useState(false)
  const [xrSupport, setXrSupport] = useState({ ar: false, vr: false })
  const { isXR } = useXRLayout()
  
  const handleEnterARMode = useCallback(() => {
    if (!xrStore) return
    xrStore.enterAR().then(() => {
      AppConfigState.set((prev) => ({ ...prev, microphone: true }))
      agent.actions.setSTTDesired(true)
    })
    console.log('AR + STT mode activated - click the AR button in the 3D view to enter AR')
  }, [xrStore, agent.actions])

  const handleEnterVRMode = useCallback(() => {
    if (!xrStore) return
    xrStore.enterVR().then(() => {
      AppConfigState.set((prev) => ({ ...prev, microphone: true }))
      agent.actions.setSTTDesired(true)
    })
    console.log('VR + STT mode activated - click the VR button in the 3D view to enter VR')
  }, [xrStore, agent.actions])

  const handleExitXR = useCallback(() => {
    const session = xrStore?.getState().session
    session?.end()
  }, [xrStore])

  const handleRecenter = useCallback(() => {
    sceneActions?.recenter()
  }, [sceneActions])

  const handleScaleUp = useCallback(() => {
    sceneActions?.scaleBy(0.1)
  }, [sceneActions])

  const handleScaleDown = useCallback(() => {
    sceneActions?.scaleBy(-0.1)
  }, [sceneActions])

  useEffect(() => {
    if (!xrStore) return
    const unsub = xrStore.subscribe((state) => {
      setXrMode(state.mode)
      setXrSessionActive(!!state.session)
    })
    return () => {
      unsub()
    }
  }, [xrStore])

  useEffect(() => {
    let cancelled = false
    async function checkSupport() {
      if (!('xr' in navigator) || !navigator.xr?.isSessionSupported) {
        if (!cancelled) setXrSupport({ ar: false, vr: false })
        return
      }
      try {
        const [ar, vr] = await Promise.all([
          navigator.xr.isSessionSupported('immersive-ar'),
          navigator.xr.isSessionSupported('immersive-vr')
        ])
        if (!cancelled) setXrSupport({ ar, vr })
      } catch {
        if (!cancelled) setXrSupport({ ar: false, vr: false })
      }
    }
    checkSupport()
    return () => {
      cancelled = true
    }
  }, [])

  const xrStatusText = useMemo(() => {
    if (xrSessionActive) return `XR: active (${xrMode || 'unknown'})`
    if (xrSupport.ar || xrSupport.vr) return 'XR: ready'
    return 'XR: unavailable'
  }, [xrSessionActive, xrMode, xrSupport])
  return (
    <>
      {/* Control Buttons */}
      <ControlPanel
        config={config} 
        isRecording={config.microphone}
        handleAppStateChange={handleAppStateChange}
        onEnterARMode={handleEnterARMode}
        onEnterVRMode={handleEnterVRMode}
        onExitXR={handleExitXR}
        onRecenter={handleRecenter}
        onScaleUp={handleScaleUp}
        onScaleDown={handleScaleDown}
        onOpenSettings={() => setShowSettings(true)}
        xrStatusText={xrStatusText}
        xrCanEnterAR={xrSupport.ar}
        xrCanEnterVR={xrSupport.vr}
        vadDetecting={agent.state.vadIsDetecting}
        ttsActive={agent.state.ttsIsSpeaking}
        isVisible={isButtonsVisible}
      />

      {/* Controls Toggle Button */}
      <ToggleButton
        isVisible={isButtonsVisible}
        onToggle={() => setIsButtonsVisible(!isButtonsVisible)}
        label={"Controls"}
        position="bottom-left"
        size={isXR ? 44 : 32}
      />

      {/* Connection settings */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
})
