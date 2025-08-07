import type { AppConfig } from '../../app/types'
import { ControlButton } from '../common/ControlButton'

interface ControlButtonsProps {
  config: AppConfig
  isRecording: boolean
  onToggleMicrophone: () => void
  onToggleCloudMode: () => void
  onToggleBargeIn: () => void
  onToggleAutoSubmit: () => void
  onToggleAgent: () => void
  onEnterARMode?: () => void
  vadDetecting?: boolean
  ttsActive?: boolean
  isVisible: boolean
}

export const ControlButtons = ({
  config,
  isRecording,
  onToggleMicrophone,
  onToggleCloudMode,
  onToggleBargeIn,
  onToggleAutoSubmit,
  onToggleAgent,
  onEnterARMode,
  vadDetecting = false,
  ttsActive = false,
  isVisible
}: ControlButtonsProps) => {
  const isMobile = window.innerWidth <= 768

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
          onClick={onToggleMicrophone}
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
          onClick={onToggleCloudMode}
          tooltipContent={config.cloudMode ? 'Switch to Local Mode' : 'Switch to Cloud Mode'}
        >
          ☁️
        </ControlButton>

        <ControlButton
          isActive={config.bargeInEnabled}
          onClick={onToggleBargeIn}
          tooltipContent={config.bargeInEnabled ? 'Disable Barge-in' : 'Enable Barge-in'}
        >
          ⚡
        </ControlButton>

        <ControlButton
          isActive={config.autoSubmitEnabled}
          onClick={onToggleAutoSubmit}
          tooltipContent={config.autoSubmitEnabled ? 'Disable Auto-submit' : 'Enable Auto-submit'}
        >
          🚀
        </ControlButton>

        <ControlButton
          isActive={config.agentEnabled}
          onClick={onToggleAgent}
          tooltipContent={config.agentEnabled ? 'Disable Agent Mode' : 'Enable Agent Mode'}
        >
          {ttsActive ? '🔊' : '🤖'}
        </ControlButton>

        {onEnterARMode && (
          <ControlButton isActive={false} onClick={onEnterARMode} tooltipContent="Enter AR Mode">
            🥽
          </ControlButton>
        )}
      </div>
    </div>
  )
}
