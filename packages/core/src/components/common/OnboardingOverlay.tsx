import { useMemo } from 'react'
import { useXRLayout } from '../../utils/useXRLayout'

interface OnboardingOverlayProps {
  isOpen: boolean
  onEnableMic: () => void
  onSkip: () => void
}

export const OnboardingOverlay = ({ isOpen, onEnableMic, onSkip }: OnboardingOverlayProps) => {
  const { isXR } = useXRLayout()

  const cardStyle = useMemo(
    () => ({
      width: isXR ? '28rem' : '22rem',
      maxWidth: '90vw',
      padding: isXR ? '1.5rem' : '1.25rem',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--xr-glass-bg)',
      border: '0.0625rem solid var(--xr-glass-border)',
      boxShadow: 'var(--xr-elevation)',
      color: 'var(--card-foreground)'
    }),
    [isXR]
  )

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,22,32,0.6)',
        backdropFilter: 'blur(6px)'
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            fontSize: isXR ? '1.4rem' : '1.2rem',
            fontWeight: 600,
            marginBottom: '0.5rem'
          }}
        >
          Enable Microphone
        </div>
        <div
          style={{
            fontSize: isXR ? '1.05rem' : '0.95rem',
            lineHeight: 1.5,
            opacity: 0.9,
            marginBottom: '1.25rem'
          }}
        >
          For voice interaction, we need permission to access your microphone. You can skip and use
          text chat instead.
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onSkip}
            style={{
              background: 'transparent',
              border: '0.0625rem solid var(--border)',
              color: 'var(--card-foreground)',
              padding: isXR ? '0.75rem 1.25rem' : '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: isXR ? '1rem' : '0.9rem',
              cursor: 'pointer'
            }}
          >
            Skip
          </button>
          <button
            onClick={onEnableMic}
            style={{
              background: 'var(--primary)',
              border: '0.0625rem solid var(--primary)',
              color: 'var(--primary-foreground)',
              padding: isXR ? '0.75rem 1.25rem' : '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: isXR ? '1rem' : '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
            }}
          >
            Enable Mic
          </button>
        </div>
      </div>
    </div>
  )
}
