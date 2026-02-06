import { memo } from 'react'
import { type AppConfig } from '../../app/appConfig'
import { ControlButton } from '../common/ControlButton'
import { useHasWebGPU } from '../../utils/useHasWebGPU' 

interface ControlPanelProps {
  config: AppConfig
  isRecording: boolean
  handleAppStateChange: (newAppState: AppConfig) => void
  onEnterARMode?: () => void
  onEnterVRMode?: () => void
  onExitXR?: () => void
  onRecenter?: () => void
  onScaleUp?: () => void
  onScaleDown?: () => void
  xrStatusText?: string
  xrCanEnterAR?: boolean
  xrCanEnterVR?: boolean
  vadDetecting?: boolean
  ttsActive?: boolean
  isVisible: boolean
}

export const ControlPanel = memo(({
  config,
  handleAppStateChange,
  isRecording,
  onEnterARMode,
  onEnterVRMode,
  onExitXR,
  onRecenter,
  onScaleUp,
  onScaleDown,
  xrStatusText,
  xrCanEnterAR = false,
  xrCanEnterVR = false,
  vadDetecting = false,
  isVisible
}: ControlPanelProps) => {
  const isMobile = window.innerWidth <= 768
  const hasWebGPU = useHasWebGPU()

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1.25rem',
        left: '50%',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
          backdropFilter: 'blur(1.25rem)',
          border: '0.0625rem solid rgba(255,255,255,0.08)',
          color: '#FFFFFF',
          borderRadius: '1rem',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'center',
          padding: '0.75rem 1.25rem',
          gap: '0.75rem',
          flexWrap: 'wrap',
          minHeight: '3.5rem',
          alignItems: 'center',
          width: 'fit-content',
          margin: '0 auto',
          maxWidth: isMobile ? '17.5rem' : '25rem'
        }}
      >
        <ControlButton
          isActive={isRecording}
          onClick={() => handleAppStateChange({ ...config, microphone: !config.microphone })}
          tooltipContent={
            isRecording
              ? vadDetecting
                ? 'Voice Detected - STT Active'
                : 'VAD Listening - Speak to Start STT'
              : 'Enable Voice Detection'
          }
        >
          {vadDetecting ? '🟢' : isRecording ? '🔴' : '🎤'}
        </ControlButton>

        <ControlButton
          isActive={config.cloudMode}
          onClick={() => handleAppStateChange({ ...config, cloudMode: !config.cloudMode })}
          tooltipContent={config.cloudMode ? 'Switch to Local Mode' : 'Switch to Cloud Mode'}
        >
          ☁️
        </ControlButton>

        <ControlButton
          isActive={config.bargeInEnabled}
          onClick={() => handleAppStateChange({ ...config, bargeInEnabled: !config.bargeInEnabled })}
          tooltipContent={config.bargeInEnabled ? 'Disable Barge-in' : 'Enable Barge-in'}
        >
          ⚡
        </ControlButton>

        <ControlButton
          isActive={config.autoSubmitEnabled}
          onClick={() => handleAppStateChange({ ...config, autoSubmitEnabled: !config.autoSubmitEnabled })}
          tooltipContent={config.autoSubmitEnabled ? 'Disable Auto-submit' : 'Enable Auto-submit'}
        >
          🚀
        </ControlButton>

        <ControlButton
          isActive={config.agentEnabled}
          onClick={() => handleAppStateChange({ ...config, agentEnabled: !config.agentEnabled })}
          tooltipContent={config.agentEnabled ? 'Disable Agent Mode' : 'Enable Agent Mode'}
        >
          {config.agentEnabled ? '🔊' : '🤖'}
        </ControlButton>

        <ControlButton
          isActive={config.webGPUEnabled}
          onClick={() => handleAppStateChange({ ...config, webGPUEnabled: !config.webGPUEnabled })}
          disabled={!hasWebGPU}
          tooltipContent={!hasWebGPU ? 'WebGPU not supported' : config.webGPUEnabled ? 'Disable WebGPU (Use WebGL)' : 'Enable WebGPU'}
        >
          {config.webGPUEnabled ? '🎮' : '🕸️'}
        </ControlButton>

        {onEnterVRMode && (
          <ControlButton
            isActive={false}
            onClick={onEnterVRMode}
            disabled={!xrCanEnterVR}
            tooltipContent={xrCanEnterVR ? 'Enter VR Mode' : 'VR not supported'}
          >
            🥽
          </ControlButton>
        )}

        {onEnterARMode && (
          <ControlButton
            isActive={false}
            onClick={onEnterARMode}
            disabled={!xrCanEnterAR}
            tooltipContent={xrCanEnterAR ? 'Enter AR Mode' : 'AR not supported'}
          >
            📱
          </ControlButton>
        )}

        {onExitXR && (
          <ControlButton isActive={false} onClick={onExitXR} tooltipContent="Exit XR Session">
            ⏹️
          </ControlButton>
        )}

        {onRecenter && (
          <ControlButton isActive={false} onClick={onRecenter} tooltipContent="Recenter View">
            🎯
          </ControlButton>
        )}

        {onScaleDown && (
          <ControlButton isActive={false} onClick={onScaleDown} tooltipContent="Scale Down">
            ➖
          </ControlButton>
        )}

        {onScaleUp && (
          <ControlButton isActive={false} onClick={onScaleUp} tooltipContent="Scale Up">
            ➕
          </ControlButton>
        )}
      </div>
      {xrStatusText && (
        <div
          style={{
            marginTop: '0.5rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.7)'
          }}
        >
          {xrStatusText}
        </div>
      )}
    </div>
  )
})

ControlPanel.displayName = 'ControlPanel'
