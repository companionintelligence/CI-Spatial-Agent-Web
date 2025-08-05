import type { AppConfig } from '../../services/types'

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
        <button
          style={{
            background: isRecording ? 'linear-gradient(135deg, rgba(255,107,53,0.8) 0%, rgba(247,147,30,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            border: isRecording ? '0.0625rem solid rgba(255,107,53,0.2)' : '0.0625rem solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backdropFilter: 'blur(1.25rem)',
            boxShadow: isRecording ? '0 0.125rem 0.5rem rgba(255,107,53,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            minWidth: '2.25rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onToggleMicrophone}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = isRecording ? '0 0.125rem 0.5rem rgba(255,107,53,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
          }}
        >
          {vadDetecting ? '🟢' : isRecording ? '🔴' : '🎤'}
        </button>

        <button
          style={{
            background: config.cloudMode ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            border: config.cloudMode ? '0.0625rem solid rgba(0,131,145,0.2)' : '0.0625rem solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backdropFilter: 'blur(1.25rem)',
            boxShadow: config.cloudMode ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            minWidth: '2.25rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onToggleCloudMode}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = config.cloudMode ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
          }}
        >
          ☁️
        </button>

        <button
          style={{
            background: config.bargeInEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            border: config.bargeInEnabled ? '0.0625rem solid rgba(0,131,145,0.2)' : '0.0625rem solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backdropFilter: 'blur(1.25rem)',
            boxShadow: config.bargeInEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            minWidth: '2.25rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onToggleBargeIn}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = config.bargeInEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
          }}
        >
          ⚡
        </button>

        <button
          style={{
            background: config.autoSubmitEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            border: config.autoSubmitEnabled ? '0.0625rem solid rgba(0,131,145,0.2)' : '0.0625rem solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backdropFilter: 'blur(1.25rem)',
            boxShadow: config.autoSubmitEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            minWidth: '2.25rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onToggleAutoSubmit}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = config.autoSubmitEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
          }}
        >
          🚀
        </button>

        <button
          style={{
            background: config.agentEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            border: config.agentEnabled ? '0.0625rem solid rgba(0,131,145,0.2)' : '0.0625rem solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backdropFilter: 'blur(1.25rem)',
            boxShadow: config.agentEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            minWidth: '2.25rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onToggleAgent}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = config.agentEnabled ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
          }}
        >
          {ttsActive ? '🔊' : '🤖'}
        </button>

        {onEnterARMode && (
          <button
            style={{
              background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: '0.0625rem solid rgba(255,255,255,0.08)',
              borderRadius: '0.5rem',
              padding: '0.375rem 0.625rem',
              cursor: 'pointer',
              color: 'white',
              fontSize: '0.8125rem',
              fontWeight: '500',
              backdropFilter: 'blur(1.25rem)',
              boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '2.25rem',
              height: '2.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onEnterARMode}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
            }}
          >
            🥽
          </button>
        )}
      </div>
    </div>
  )
} 