import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { useXRLayout } from '../../utils/useXRLayout'
import { type ActivationState, type LLMProvider } from '../../services/llm/config/llmConfig'
import {
  activationStateLabel,
  deriveActivationState,
  fetchConnectionHealth,
  type ConnectionCheckState,
  type ConnectionHealth
} from '../../services/connection/connectionHealth'

interface OnboardingOverlayProps {
  isOpen: boolean
  onEnableMic: () => void
  onSkip: () => void
  activationState?: ActivationState
  llmProvider?: LLMProvider
  onActivationStateChange?: (state: ActivationState) => void
}

export const OnboardingOverlay = ({
  isOpen,
  onEnableMic,
  onSkip,
  activationState = 'unverified',
  llmProvider = 'proxy',
  onActivationStateChange
}: OnboardingOverlayProps) => {
  const { isXR } = useXRLayout()
  const [healthState, setHealthState] = useState<ConnectionCheckState>('idle')
  const [health, setHealth] = useState<ConnectionHealth | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    setHealthState('checking')
    setHealthError(null)

    try {
      const payload = await fetchConnectionHealth()
      setHealth(payload)
      onActivationStateChange?.(deriveActivationState(payload, llmProvider))
      if (!payload.reachable) {
        setHealthState('error')
      } else if (payload.tts && !payload.tts.reachable) {
        setHealthState('degraded')
      } else {
        setHealthState('healthy')
      }
    } catch (error) {
      setHealth(null)
      setHealthState('error')
      setHealthError(error instanceof Error ? error.message : 'Unable to check the connection')
      onActivationStateChange?.('unverified')
    }
  }, [llmProvider, onActivationStateChange])

  const cardStyle = useMemo<CSSProperties>(
    () => ({
      width: isXR ? '28rem' : '22rem',
      maxWidth: '90vw',
      maxHeight: '90vh',
      overflowY: 'auto',
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
          Start your companion
        </div>
        <div
          style={{
            fontSize: isXR ? '1.05rem' : '0.95rem',
            lineHeight: 1.5,
            opacity: 0.9,
            marginBottom: '1.25rem'
          }}
        >
          Microphone permission and service connection are separate. Check the connection before
          your first answer; you can skip the mic and use text chat.
        </div>

        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            border: '0.0625rem solid rgba(255,255,255,0.14)',
            background: 'rgba(0,0,0,0.16)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '0.45rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Connection truth</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>Know what kind of session you are starting.</div>
            </div>
            <button
              type="button"
              onClick={() => void checkConnection()}
              disabled={healthState === 'checking'}
              style={{
                flexShrink: 0,
                background: 'transparent',
                border: '0.0625rem solid rgba(255,255,255,0.25)',
                color: '#FFFFFF',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.55rem',
                fontSize: '0.75rem',
                cursor: healthState === 'checking' ? 'wait' : 'pointer',
                opacity: healthState === 'checking' ? 0.65 : 1
              }}
            >
              {healthState === 'checking' ? 'Checking…' : 'Check connection'}
            </button>
          </div>

          <div role="status" aria-live="polite" style={{ fontSize: '0.78rem', opacity: 0.85 }}>
            <div style={{ marginBottom: '0.35rem' }}>Session: {activationStateLabel(activationState)}</div>
            {healthState === 'idle' && 'Not checked yet.'}
            {healthState === 'checking' && 'Checking the configured services…'}
            {healthState === 'healthy' && 'Chat and voice are reachable.'}
            {healthState === 'degraded' && 'Chat is reachable, but voice is unavailable.'}
            {healthState === 'error' && (healthError || 'Chat is unreachable. Check the service and try again.')}
            {health && (
              <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.45rem' }}>
                <div>Chat: {health.reachable ? 'reachable' : 'unreachable'}</div>
                <div>
                  Memory:{' '}
                  {health.memory
                    ? health.memory.configured
                      ? health.memory.reachable
                        ? 'connected'
                        : 'configured but unreachable'
                      : 'not configured'
                    : 'not reported'}
                </div>
                <div>TTS: {health.tts ? (health.tts.reachable ? 'reachable' : 'unreachable') : 'not reported'}</div>
              </div>
            )}
          </div>
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
              background: 'linear-gradient(135deg, rgba(0,131,145,0.6) 0%, rgba(15,113,122,0.6) 100%)',
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
