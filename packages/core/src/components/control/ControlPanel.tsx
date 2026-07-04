import { memo, type ReactNode } from 'react'
import {
  AudioLines,
  Crosshair,
  Headset,
  Mic,
  Minus,
  Plus,
  Settings,
  Smartphone,
  X
} from 'lucide-react'
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

/**
 * A control action rendered as a lucide icon plus an optional short text label.
 * Labels are the canon's answer to "emoji-only is cryptic": they show on the
 * flat desktop bar and hide in XR (where hit targets grow and text is noisy) and
 * on the compact mobile bar (where horizontal space is tight).
 */
function LabeledControl({
  icon,
  label,
  showLabel,
  size,
  onClick,
  tooltipContent,
  isActive = false,
  disabled = false
}: {
  icon: ReactNode
  label: string
  showLabel: boolean
  size: number
  onClick: () => void
  tooltipContent?: string
  isActive?: boolean
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem'
      }}
    >
      <ControlButton
        isActive={isActive}
        size={size}
        onClick={onClick}
        disabled={disabled}
        tooltipContent={tooltipContent}
        ariaLabel={label}
      >
        {icon}
      </ControlButton>
      {showLabel && (
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            lineHeight: 1,
            color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
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

  // Per-surface sizing: larger, glove-friendly hit targets in XR; compact on mobile.
  const controlButtonSize = isXR ? 56 : isMobile ? 44 : 48
  // Under-icon labels help on the roomy desktop bar; hidden where space or context
  // makes them noise (compact mobile bar, immersive XR).
  const showLabels = !isXR && !isMobile
  // Size the glyph to the button; lucide strokes read well around ~45% of the box.
  const iconSize = Math.round(controlButtonSize * 0.45)

  const micIcon = vadDetecting ? (
    <AudioLines size={iconSize} aria-hidden />
  ) : (
    <Mic size={iconSize} aria-hidden />
  )

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
          alignItems: 'flex-start',
          width: 'fit-content',
          margin: '0 auto',
          maxWidth: isXR ? '38rem' : isMobile ? '20rem' : '32rem'
        }}
      >
        <LabeledControl
          icon={micIcon}
          label={vadDetecting ? 'Listening' : isRecording ? 'Mic on' : 'Mic'}
          showLabel={showLabels}
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
        />

        {onEnterVRMode && (
          <LabeledControl
            icon={<Headset size={iconSize} aria-hidden />}
            label="Enter VR"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onEnterVRMode}
            disabled={!xrCanEnterVR}
            tooltipContent={xrCanEnterVR ? 'Enter VR Mode' : 'VR not supported'}
          />
        )}

        {onEnterARMode && (
          <LabeledControl
            icon={<Smartphone size={iconSize} aria-hidden />}
            label="Enter AR"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onEnterARMode}
            disabled={!xrCanEnterAR}
            tooltipContent={xrCanEnterAR ? 'Enter AR Mode' : 'AR not supported'}
          />
        )}

        {onExitXR && (
          <LabeledControl
            icon={<X size={iconSize} aria-hidden />}
            label="Exit XR"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onExitXR}
            tooltipContent="Exit XR Session"
          />
        )}

        {onRecenter && (
          <LabeledControl
            icon={<Crosshair size={iconSize} aria-hidden />}
            label="Recenter"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onRecenter}
            tooltipContent="Recenter View"
          />
        )}

        {onScaleDown && (
          <LabeledControl
            icon={<Minus size={iconSize} aria-hidden />}
            label="Smaller"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onScaleDown}
            tooltipContent="Scale Down"
          />
        )}

        {onScaleUp && (
          <LabeledControl
            icon={<Plus size={iconSize} aria-hidden />}
            label="Larger"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onScaleUp}
            tooltipContent="Scale Up"
          />
        )}

        {onOpenSettings && (
          <LabeledControl
            icon={<Settings size={iconSize} aria-hidden />}
            label="Settings"
            showLabel={showLabels}
            size={controlButtonSize}
            onClick={onOpenSettings}
            tooltipContent="Settings"
          />
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
