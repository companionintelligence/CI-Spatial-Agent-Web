import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/server.js'

/**
 * The browser consults this endpoint before `Sentry.init` and fails closed, so
 * these cases are what actually make the `CI_TELEMETRY` / `CI_LOCAL_ONLY` kill
 * switches — and the marketplace "Share crash reports" toggle — reach a bundle
 * with a DSN already baked into it.
 */
describe('GET /api/config/telemetry', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('permits reporting when no kill switch is set', async () => {
    const res = await createApp().request('/api/config/telemetry')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ enabled: true })
  })

  it.each(['off', 'false', '0', 'no', 'disabled'])('refuses when CI_TELEMETRY=%s', async (value) => {
    vi.stubEnv('CI_TELEMETRY', value)

    const res = await createApp().request('/api/config/telemetry')

    await expect(res.json()).resolves.toEqual({ enabled: false, reason: 'opt-out' })
  })

  it.each(['true', '1', 'yes', 'on'])('refuses when CI_LOCAL_ONLY=%s', async (value) => {
    vi.stubEnv('CI_LOCAL_ONLY', value)

    const res = await createApp().request('/api/config/telemetry')

    await expect(res.json()).resolves.toEqual({ enabled: false, reason: 'local-only' })
  })

  it('reports local-only ahead of opt-out', async () => {
    vi.stubEnv('CI_LOCAL_ONLY', 'true')
    vi.stubEnv('CI_TELEMETRY', 'off')

    const res = await createApp().request('/api/config/telemetry')

    await expect(res.json()).resolves.toEqual({ enabled: false, reason: 'local-only' })
  })

  it('never exposes the DSN', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://publickey@o1.ingest.us.sentry.io/2')

    const res = await createApp().request('/api/config/telemetry')

    expect(await res.text()).not.toContain('ingest')
  })

  it('answers from env on every request, so a restart is not needed to revoke', async () => {
    const app = createApp()

    await expect((await app.request('/api/config/telemetry')).json()).resolves.toEqual({ enabled: true })

    vi.stubEnv('CI_TELEMETRY', 'off')

    await expect((await app.request('/api/config/telemetry')).json()).resolves.toEqual({
      enabled: false,
      reason: 'opt-out'
    })
  })

  it('is unauthenticated — the browser must be able to ask before anything else works', async () => {
    const res = await createApp().request('/api/config/telemetry', { headers: {} })

    expect(res.status).toBe(200)
  })
})
