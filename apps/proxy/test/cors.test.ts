import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseAllowedOrigins, resolveAllowedOrigin } from '../src/config.js'
import { createApp } from '../src/server.js'

const PAGES_ORIGIN = 'https://avatar.ci.computer'

/**
 * These cases are what make the split deployment work: the static Cloudflare
 * Pages build at avatar.ci.computer calling this BFF on a different origin
 * (self-hosted, exposed over a Cloudflare tunnel). Without the allowlist the
 * browser discards every /api/* response.
 *
 * The first block is the one that must never regress — the container and
 * dev-server deployments are same-origin and must keep sending no CORS headers
 * at all, because an unconditional `Access-Control-Allow-Origin` on a proxy
 * reachable over a tunnel is exactly the mistake this guards against.
 */
describe('CORS — default (no APP_ALLOWED_ORIGINS)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends no Access-Control-Allow-Origin', async () => {
    const res = await createApp().request('/api/health', {
      headers: { Origin: PAGES_ORIGIN }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('does not turn a preflight into an approval', async () => {
    const res = await createApp().request('/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: PAGES_ORIGIN,
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('CORS — with an allowlist', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('echoes an allowlisted origin', async () => {
    vi.stubEnv('APP_ALLOWED_ORIGINS', PAGES_ORIGIN)

    const res = await createApp().request('/api/health', {
      headers: { Origin: PAGES_ORIGIN }
    })

    expect(res.headers.get('access-control-allow-origin')).toBe(PAGES_ORIGIN)
  })

  it('refuses an origin that is not listed', async () => {
    vi.stubEnv('APP_ALLOWED_ORIGINS', PAGES_ORIGIN)

    const res = await createApp().request('/api/health', {
      headers: { Origin: 'https://attacker.example' }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers a chat preflight so the real POST is allowed to follow', async () => {
    vi.stubEnv('APP_ALLOWED_ORIGINS', PAGES_ORIGIN)

    const res = await createApp().request('/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: PAGES_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    })

    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('access-control-allow-origin')).toBe(PAGES_ORIGIN)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
  })

  it('honours several origins, so a preview URL can be allowed beside production', async () => {
    const preview = 'https://avatars-zbe.pages.dev'
    vi.stubEnv('APP_ALLOWED_ORIGINS', `${PAGES_ORIGIN},${preview}`)

    for (const origin of [PAGES_ORIGIN, preview]) {
      const res = await createApp().request('/api/health', { headers: { Origin: origin } })
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    }
  })

  it('never allows credentials, so a permissive list cannot ride browser cookies', async () => {
    vi.stubEnv('APP_ALLOWED_ORIGINS', '*')

    const res = await createApp().request('/api/health', {
      headers: { Origin: PAGES_ORIGIN }
    })

    expect(res.headers.get('access-control-allow-origin')).toBe(PAGES_ORIGIN)
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })
})

describe('parseAllowedOrigins', () => {
  it('is empty for unset and blank values', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([])
    expect(parseAllowedOrigins('')).toEqual([])
    expect(parseAllowedOrigins(' , ,')).toEqual([])
  })

  it('trims, lowercases, drops a trailing slash and deduplicates', () => {
    expect(parseAllowedOrigins(' https://Avatar.CI.Computer/ , https://avatar.ci.computer ')).toEqual([
      'https://avatar.ci.computer'
    ])
  })
})

describe('resolveAllowedOrigin', () => {
  it('declines everything when the allowlist is empty', () => {
    expect(resolveAllowedOrigin(PAGES_ORIGIN, [])).toBeNull()
  })

  it('matches case-insensitively and ignores a trailing slash in the env value', () => {
    const allowed = parseAllowedOrigins('https://Avatar.CI.Computer/')
    expect(resolveAllowedOrigin(PAGES_ORIGIN, allowed)).toBe(PAGES_ORIGIN)
  })

  it('does not match a different port or scheme', () => {
    const allowed = parseAllowedOrigins('https://avatar.ci.computer')
    expect(resolveAllowedOrigin('http://avatar.ci.computer', allowed)).toBeNull()
    expect(resolveAllowedOrigin('https://avatar.ci.computer:8443', allowed)).toBeNull()
  })

  it('does not treat the allowlist entry as a suffix match', () => {
    const allowed = parseAllowedOrigins('https://avatar.ci.computer')
    expect(resolveAllowedOrigin('https://evil-avatar.ci.computer', allowed)).toBeNull()
    expect(resolveAllowedOrigin('https://avatar.ci.computer.evil.test', allowed)).toBeNull()
  })

  it('echoes the caller origin for a wildcard rather than returning "*"', () => {
    expect(resolveAllowedOrigin(PAGES_ORIGIN, ['*'])).toBe(PAGES_ORIGIN)
  })
})
