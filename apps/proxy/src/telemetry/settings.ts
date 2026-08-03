/**
 * Telemetry (Sentry) settings resolution for the BFF.
 *
 * Error reporting is **opt-out** — on wherever a `SENTRY_DSN` is configured, and
 * the user turns it off. With no `SENTRY_DSN` nothing is initialised and the
 * process makes no outbound call; that is the absence of configuration, not a
 * privacy setting. Two kill switches disable reporting even when a DSN has been
 * baked into the published image (which is how a Hub-installed sidecar would
 * receive one), so an operator can always turn telemetry off without rebuilding:
 *
 *   - `CI_TELEMETRY=off`   — explicit opt-out; this is what the app-store
 *     "Share crash reports" toggle sets on both containers. Leaving it *unset*
 *     is not "off": it leaves the DSN in charge.
 *   - `CI_LOCAL_ONLY=true` — local-only mode must mean zero phone-home
 *
 * Ported verbatim (env names aside) from CI-Server's
 * `backend/apps/api/src/common/telemetry/settings.ts` so the whole first-party
 * fleet answers to the same two switches.
 */

export type TelemetryDisabledReason = 'no-dsn' | 'opt-out' | 'local-only'

export interface TelemetrySettings {
  enabled: boolean
  disabledReason: TelemetryDisabledReason | null
  dsn: string | null
  environment: string
  release: string | undefined
  component: string
  deploymentVersion: string | null
}

const FALSEY = new Set(['off', 'false', '0', 'no', 'disabled'])
const TRUTHY = new Set(['on', 'true', '1', 'yes', 'enabled'])

function read(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim()

  return value ? value : null
}

/** `CI_TELEMETRY=off` (any falsey spelling) opts out; anything else leaves the DSN in charge. */
export function isTelemetryOptedOut(env: NodeJS.ProcessEnv): boolean {
  const value = read(env, 'CI_TELEMETRY')?.toLowerCase()

  return value !== null && value !== undefined && FALSEY.has(value)
}

/** Local-only mode forbids all egress, telemetry included. */
export function isLocalOnly(env: NodeJS.ProcessEnv): boolean {
  const value = read(env, 'CI_LOCAL_ONLY')?.toLowerCase()

  return value !== null && value !== undefined && TRUTHY.has(value)
}

export function resolveTelemetrySettings(env: NodeJS.ProcessEnv, component: string): TelemetrySettings {
  const dsn = read(env, 'SENTRY_DSN')
  const deploymentVersion = read(env, 'APP_VERSION')

  const base = {
    dsn,
    component,
    deploymentVersion,
    environment: read(env, 'SENTRY_ENV') ?? read(env, 'APP_ENVIRONMENT') ?? read(env, 'NODE_ENV') ?? 'development',
    release: read(env, 'SENTRY_RELEASE') ?? (deploymentVersion ? `${component}@${deploymentVersion}` : undefined)
  }

  // Order matters: report the *operator's* explicit choice ahead of "no DSN" so
  // the startup log tells them why reporting is off.
  if (isLocalOnly(env)) {
    return { ...base, enabled: false, disabledReason: 'local-only' }
  }

  if (isTelemetryOptedOut(env)) {
    return { ...base, enabled: false, disabledReason: 'opt-out' }
  }

  if (!dsn) {
    return { ...base, enabled: false, disabledReason: 'no-dsn' }
  }

  return { ...base, enabled: true, disabledReason: null }
}
