import type { CSSProperties } from 'react'
import type { ActivationState } from '../../services/llm/config/llmConfig'
import {
  activationStateLabel,
  type ConnectionCheckState,
  type ConnectionHealth
} from '../../services/connection/connectionHealth'

export interface ConnectionStatusPanelProps {
  activationState: ActivationState
  healthState: ConnectionCheckState
  health: ConnectionHealth | null
  healthError: string | null
  textStyle: CSSProperties
}

export const ConnectionStatusPanel = ({
  activationState,
  healthState,
  health,
  healthError,
  textStyle
}: ConnectionStatusPanelProps) => (
  <div role="status" aria-live="polite" style={textStyle}>
    <div style={{ marginBottom: '0.35rem' }}>Session: {activationStateLabel(activationState)}</div>
    {healthState === 'idle' && 'Not checked yet.'}
    {healthState === 'checking' && 'Checking the configured services…'}
    {healthState === 'healthy' && 'Chat and voice are reachable.'}
    {healthState === 'degraded' && 'Chat is reachable, but voice is unavailable.'}
    {healthState === 'error' && (healthError || 'Chat is unreachable. Check the service and try again.')}
    {healthState === 'demo' && 'Demo mode — no live backend to check.'}
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
)
