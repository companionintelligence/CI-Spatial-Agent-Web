import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The browser half of the opt-in gate.
 *
 * `VITE_SENTRY_DSN` is read at module scope, so every case re-imports the module
 * after stubbing the env. The SDK is mocked: a real `Sentry.init` against a fake
 * DSN would open a session request to `ingest.sentry.io` from the test run, and
 * mocking it also lets us assert the privacy options it is called with.
 */
const DSN = 'https://abc123@o1.ingest.us.sentry.io/9999999'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  breadcrumbsIntegration: vi.fn((options?: Record<string, unknown>) => ({ name: 'Breadcrumbs', options })),
  withScope: vi.fn(),
  captureException: vi.fn()
}))

vi.mock('@sentry/react', () => sentry)

type Telemetry = typeof import('./telemetry')

async function loadTelemetry(dsn?: string): Promise<Telemetry> {
  if (dsn === undefined) {
    vi.stubEnv('VITE_SENTRY_DSN', '')
  } else {
    vi.stubEnv('VITE_SENTRY_DSN', dsn)
  }

  vi.resetModules()

  return import('./telemetry')
}

/** A consent endpoint that answers `body`, or throws when `body` is an Error. */
function stubConsent(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => {
    if (body instanceof Error) {
      throw body
    }

    return {
      ok,
      json: async () => {
        if (typeof body === 'string') {
          throw new SyntaxError('Unexpected token < in JSON')
        }

        return body
      }
    } as unknown as Response
  })

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

beforeEach(() => {
  // The module bails out before anything else when there is no window.
  vi.stubGlobal('window', {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('initTelemetry — the build-time DSN gate', () => {
  it('does nothing at all without a DSN: no consent call, no init', async () => {
    const fetchMock = stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(undefined)

    await telemetry.initTelemetry()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(telemetry.isTelemetryEnabled()).toBe(false)
  })

  it('treats a whitespace-only DSN as unset', async () => {
    const fetchMock = stubConsent({ enabled: true })
    const telemetry = await loadTelemetry('   ')

    await telemetry.initTelemetry()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('does nothing outside a browser', async () => {
    vi.stubGlobal('window', undefined)
    stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(sentry.init).not.toHaveBeenCalled()
  })
})

describe('initTelemetry — the runtime consent gate', () => {
  it('initialises when the appliance permits reporting', async () => {
    const fetchMock = stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(fetchMock).toHaveBeenCalledWith('/api/config/telemetry', expect.anything())
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(telemetry.isTelemetryEnabled()).toBe(true)
    expect(sentry.setTag).toHaveBeenCalledWith('component', 'ci-spatial-companion-webxr')
  })

  it.each([
    ['opt-out', { enabled: false, reason: 'opt-out' }],
    ['local-only', { enabled: false, reason: 'local-only' }]
  ])('respects a %s answer — this is what the marketplace toggle does', async (_name, body) => {
    stubConsent(body)
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(sentry.init).not.toHaveBeenCalled()
    expect(telemetry.isTelemetryEnabled()).toBe(false)
  })

  it('fails closed when the endpoint is unreachable', async () => {
    stubConsent(new TypeError('Failed to fetch'))
    const telemetry = await loadTelemetry(DSN)

    await expect(telemetry.initTelemetry()).resolves.toBeUndefined()
    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('fails closed on a non-2xx answer', async () => {
    stubConsent({ enabled: true }, false)
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('fails closed on a malformed answer', async () => {
    stubConsent('<!doctype html>')
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('fails closed when `enabled` is truthy but not exactly true', async () => {
    stubConsent({ enabled: 'yes' })
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('initialises at most once, even from concurrent callers', async () => {
    stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)

    await Promise.all([telemetry.initTelemetry(), telemetry.initTelemetry(), telemetry.initTelemetry()])
    await telemetry.initTelemetry()

    expect(sentry.init).toHaveBeenCalledTimes(1)
  })
})

describe('initTelemetry — privacy options', () => {
  it('sends no PII, no traces, no replay and no profiling', async () => {
    stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    const options = sentry.init.mock.calls[0]![0] as Record<string, unknown>

    expect(options.sendDefaultPii).toBe(false)
    expect(options.tracesSampleRate).toBe(0)
    expect(options.replaysSessionSampleRate).toBeUndefined()
    expect(options.replaysOnErrorSampleRate).toBeUndefined()
    expect(options.profilesSampleRate).toBeUndefined()
    expect(options.beforeSend).toBe(telemetry.scrubBrowserEvent)
  })

  it('disables console breadcrumbs — the app logs whole conversations', async () => {
    stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)

    await telemetry.initTelemetry()

    const options = sentry.init.mock.calls[0]![0] as {
      integrations: (defaults: { name: string }[]) => { name: string }[]
    }
    const resolved = options.integrations([{ name: 'Breadcrumbs' }, { name: 'HttpContext' }])

    expect(sentry.breadcrumbsIntegration).toHaveBeenCalledWith({ console: false })
    // Exactly one Breadcrumbs integration survives: ours, not the default.
    expect(resolved.filter((integration) => integration.name === 'Breadcrumbs')).toHaveLength(1)
    expect(resolved.map((integration) => integration.name)).toContain('HttpContext')
  })
})

describe('captureException', () => {
  it('is a no-op until telemetry has initialised', async () => {
    const telemetry = await loadTelemetry(undefined)

    telemetry.captureException(new Error('boom'), { note: 'x' })

    expect(sentry.withScope).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports through a scope once initialised, skipping undefined context', async () => {
    stubConsent({ enabled: true })
    const telemetry = await loadTelemetry(DSN)
    await telemetry.initTelemetry()

    const setExtra = vi.fn()
    sentry.withScope.mockImplementation((fn: unknown) => (fn as (s: unknown) => void)({ setExtra }))

    telemetry.captureException(new Error('boom'), { kept: 1, dropped: undefined })

    expect(setExtra).toHaveBeenCalledWith('kept', 1)
    expect(setExtra).not.toHaveBeenCalledWith('dropped', undefined)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
