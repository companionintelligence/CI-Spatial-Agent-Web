import { memo } from 'react'
import { type AppConfig } from '../../app/appConfig'
import { ControlButton } from '../common/ControlButton'
import { useXRLayout } from '../../utils/useXRLayout'

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
  onOpenSettings?: () => void
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
  onOpenSettings,
  xrStatusText,
  xrCanEnterAR = false,
  xrCanEnterVR = false,
  vadDetecting = false,
  isVisible
}: ControlPanelProps) => {
  const isMobile = window.innerWidth <= 768
  const { isXR } = useXRLayout()
  const controlButtonSize = isXR ? 56 : 40

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isXR ? '2rem' : '1.25rem',
        left: '50%',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      <div
        style={{
          background: 'var(--xr-glass-bg)',
          backdropFilter: 'blur(var(--xr-glass-blur))',
          border: '0.0625rem solid var(--xr-glass-border)',
          color: 'var(--card-foreground)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--xr-elevation)',
          display: 'flex',
          justifyContent: 'center',
          padding: isXR ? '1rem 1.5rem' : '0.75rem 1.25rem',
          gap: isXR ? '1rem' : '0.75rem',
          flexWrap: 'wrap',
          minHeight: isXR ? '4.5rem' : '3.5rem',
          alignItems: 'center',
          width: 'fit-content',
          margin: '0 auto',
          maxWidth: isXR ? '32rem' : isMobile ? '17.5rem' : '25rem'
        }}
      >
        <ControlButton
          isActive={isRecording}
          size={controlButtonSize}
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

        {onOpenSettings && (
          <ControlButton
            isActive={false}
            size={controlButtonSize}
            onClick={onOpenSettings}
            tooltipContent="Connection Settings"
          >
            ⚙️
          </ControlButton>
        )}
      </div>
      {xrStatusText && (
        <div
          style={{
            marginTop: '0.5rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)'
          }}
        >
          {xrStatusText}
        </div>
      )}
    </div>
  )
})

ControlPanel.displayName = 'ControlPanel'
