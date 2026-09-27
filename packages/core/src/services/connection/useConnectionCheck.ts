import { useCallback, useState } from 'react'
import type { ActivationState, LLMProvider } from '../llm/config/llmConfig'
import {
  deriveActivationState,
  fetchConnectionHealth,
  type ConnectionCheckState,
  type ConnectionHealth
} from './connectionHealth'

export interface UseConnectionCheckResult {
  healthState: ConnectionCheckState
  health: ConnectionHealth | null
  healthError: string | null
  checkConnection: () => Promise<void>
}

export function useConnectionCheck(
  provider: LLMProvider,
  onActivationStateChange?: (state: ActivationState) => void
): UseConnectionCheckResult {
  const [healthState, setHealthState] = useState<ConnectionCheckState>('idle')
  const [health, setHealth] = useState<ConnectionHealth | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    // Demo mode has no live backend by design — hitting /api/health here would
    // only ever 404 into the SPA fallback and surface a confusing raw
    // JSON-parse error.
    if (provider === 'script') {
      setHealth(null)
      setHealthError(null)
      setHealthState('demo')
      onActivationStateChange?.('demo-only')
      return
    }

    setHealthState('checking')
    setHealthError(null)

    try {
      const payload = await fetchConnectionHealth()
      setHealth(payload)
      onActivationStateChange?.(deriveActivationState(payload, provider))
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
  }, [provider, onActivationStateChange])

  return { healthState, health, healthError, checkConnection }
}
