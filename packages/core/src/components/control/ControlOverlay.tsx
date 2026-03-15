import { memo, useCallback, useState } from 'react'

import { ToggleButton } from '../common/ToggleButton'
import type { XRStore } from '@react-three/xr'
import { AppConfigState, type AppConfig } from '../../app/appConfig'
import type { AgentService } from '../../services/useAgent'
import { ControlPanel } from './ControlPanel'
import { useXRLayout } from '../../utils/useXRLayout'

interface ControlOverlayProps {
  config: AppConfig
  handleAppStateChange: (newAppState: AppConfig) => void
  agent: AgentService
  xrStore: XRStore
}


export const ControlOverlay = memo(({
  config,
  handleAppStateChange,
  agent,
  xrStore,
}: ControlOverlayProps) => {
  const [isButtonsVisible, setIsButtonsVisible] = useState(true)
  const { isXR } = useXRLayout()
  
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
      {/* Control Buttons */}
      <ControlPanel
        config={config} 
        isRecording={config.microphone}
        handleAppStateChange={handleAppStateChange}
        onEnterARMode={handleEnterARMode}
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
    </>
  )
})
