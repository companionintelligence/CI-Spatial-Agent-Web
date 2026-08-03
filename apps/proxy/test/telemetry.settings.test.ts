import { describe, expect, it } from 'vitest'

import { isLocalOnly, isTelemetryOptedOut, resolveTelemetrySettings } from '../src/telemetry/index.js'

const DSN = 'https://publickey@o1.ingest.us.sentry.io/2'
const COMPONENT = 'ci-spatial-companion-proxy'

describe('resolveTelemetrySettings', () => {
  it('is disabled when no DSN is configured', () => {
    const settings = resolveTelemetrySettings({}, COMPONENT)

    expect(settings.enabled).toBe(false)
    expect(settings.disabledReason).toBe('no-dsn')
    expect(settings.dsn).toBeNull()
  })

  it('is enabled once a DSN is present', () => {
    const settings = resolveTelemetrySettings({ SENTRY_DSN: DSN }, COMPONENT)

    expect(settings.enabled).toBe(true)
    expect(settings.disabledReason).toBeNull()
    expect(settings.dsn).toBe(DSN)
  })

  it.each(['off', 'OFF', 'false', '0', 'no', 'disabled'])('CI_TELEMETRY=%s overrides a configured DSN', (value) => {
    const settings = resolveTelemetrySettings({ SENTRY_DSN: DSN, CI_TELEMETRY: value }, COMPONENT)

    expect(settings.enabled).toBe(false)
    expect(settings.disabledReason).toBe('opt-out')
  })

  it.each(['on', 'true', '1', 'enabled', ''])('CI_TELEMETRY=%s leaves the DSN in charge', (value) => {
    expect(resolveTelemetrySettings({ SENTRY_DSN: DSN, CI_TELEMETRY: value }, COMPONENT).enabled).toBe(true)
  })

  it.each(['true', 'TRUE', '1', 'yes', 'on'])('CI_LOCAL_ONLY=%s forbids all reporting', (value) => {
    const settings = resolveTelemetrySettings({ SENTRY_DSN: DSN, CI_LOCAL_ONLY: value }, COMPONENT)

    expect(settings.enabled).toBe(false)
    expect(settings.disabledReason).toBe('local-only')
  })

  it('reports local-only ahead of opt-out and missing DSN', () => {
    expect(resolveTelemetrySettings({ CI_LOCAL_ONLY: 'true', CI_TELEMETRY: 'off' }, 'x').disabledReason).toBe(
      'local-only'
    )
    expect(resolveTelemetrySettings({ CI_TELEMETRY: 'off' }, 'x').disabledReason).toBe('opt-out')
    expect(resolveTelemetrySettings({}, 'x').disabledReason).toBe('no-dsn')
  })

  it('treats blank environment values as unset', () => {
    const settings = resolveTelemetrySettings({ SENTRY_DSN: '   ' }, COMPONENT)

    expect(settings.enabled).toBe(false)
    expect(settings.dsn).toBeNull()
  })

  it('derives the release from the deployment version when not set explicitly', () => {
    const settings = resolveTelemetrySettings({ SENTRY_DSN: DSN, APP_VERSION: '0.1.0' }, COMPONENT)

    expect(settings.release).toBe('ci-spatial-companion-proxy@0.1.0')
    expect(settings.deploymentVersion).toBe('0.1.0')
  })

  it('leaves the release unset when there is no version to derive it from', () => {
    expect(resolveTelemetrySettings({ SENTRY_DSN: DSN }, COMPONENT).release).toBeUndefined()
  })

  it('prefers an explicit SENTRY_RELEASE', () => {
    const settings = resolveTelemetrySettings(
      { SENTRY_DSN: DSN, APP_VERSION: '0.1.0', SENTRY_RELEASE: 'ci-spatial-companion-proxy@abc123' },
      COMPONENT
    )

    expect(settings.release).toBe('ci-spatial-companion-proxy@abc123')
  })

  it('falls back through SENTRY_ENV, APP_ENVIRONMENT then NODE_ENV', () => {
    expect(resolveTelemetrySettings({ SENTRY_DSN: DSN, NODE_ENV: 'test' }, 'x').environment).toBe('test')
    expect(
      resolveTelemetrySettings({ SENTRY_DSN: DSN, NODE_ENV: 'test', APP_ENVIRONMENT: 'appliance' }, 'x').environment
    ).toBe('appliance')
    expect(
      resolveTelemetrySettings(
        { SENTRY_DSN: DSN, NODE_ENV: 'test', APP_ENVIRONMENT: 'appliance', SENTRY_ENV: 'staging' },
        'x'
      ).environment
    ).toBe('staging')
    expect(resolveTelemetrySettings({ SENTRY_DSN: DSN }, 'x').environment).toBe('development')
  })

  it('carries the component through to the settings', () => {
    expect(resolveTelemetrySettings({ SENTRY_DSN: DSN }, COMPONENT).component).toBe(COMPONENT)
  })
})

describe('kill switches, standalone', () => {
  it('recognises every falsey spelling of CI_TELEMETRY', () => {
    for (const value of ['off', 'false', '0', 'no', 'disabled', 'DISABLED']) {
      expect(isTelemetryOptedOut({ CI_TELEMETRY: value })).toBe(true)
    }
  })

  it('does not treat an unset or truthy CI_TELEMETRY as an opt-out', () => {
    expect(isTelemetryOptedOut({})).toBe(false)
    expect(isTelemetryOptedOut({ CI_TELEMETRY: 'on' })).toBe(false)
    expect(isTelemetryOptedOut({ CI_TELEMETRY: '  ' })).toBe(false)
  })

  it('recognises every truthy spelling of CI_LOCAL_ONLY', () => {
    for (const value of ['on', 'true', '1', 'yes', 'enabled', 'YES']) {
      expect(isLocalOnly({ CI_LOCAL_ONLY: value })).toBe(true)
    }
  })

  it('does not treat an unset or falsey CI_LOCAL_ONLY as local-only', () => {
    expect(isLocalOnly({})).toBe(false)
    expect(isLocalOnly({ CI_LOCAL_ONLY: 'false' })).toBe(false)
  })
})
