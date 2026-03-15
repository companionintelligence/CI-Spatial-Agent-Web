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
      borderRadius: '1rem',
      background: 'linear-gradient(180deg, rgba(16,25,30,0.85) 0%, rgba(17,43,48,0.85) 100%)',
      border: '0.0625rem solid rgba(255,255,255,0.12)',
      boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.3)',
      color: '#FFFFFF'
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
        background: 'rgba(5,10,12,0.6)',
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
              border: '0.0625rem solid rgba(255,255,255,0.2)',
              color: '#FFFFFF',
              padding: isXR ? '0.75rem 1.25rem' : '0.6rem 1rem',
              borderRadius: '0.75rem',
              fontSize: isXR ? '1rem' : '0.9rem',
              cursor: 'pointer'
            }}
          >
            Skip
          </button>
          <button
            onClick={onEnableMic}
            style={{
              background: 'linear-gradient(135deg, rgba(0,131,145,0.6) 0%, rgba(19,196,209,0.6) 100%)',
              border: '0.0625rem solid rgba(0,131,145,0.4)',
              color: '#FFFFFF',
              padding: isXR ? '0.75rem 1.25rem' : '0.6rem 1rem',
              borderRadius: '0.75rem',
              fontSize: isXR ? '1rem' : '0.9rem',
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
