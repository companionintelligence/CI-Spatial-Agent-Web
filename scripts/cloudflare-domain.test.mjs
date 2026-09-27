import { describe, expect, it } from 'vitest'

import { parseArgs, zoneNameFor } from './cloudflare-domain.mjs'

describe('zoneNameFor', () => {
  it('derives the zone from a subdomain', () => {
    expect(zoneNameFor('avatar.ci.computer')).toBe('ci.computer')
  })

  it('handles a deeper subdomain', () => {
    expect(zoneNameFor('spatial-companion.living-room.ci.computer')).toBe('ci.computer')
  })

  it('returns the hostname itself at the zone apex', () => {
    expect(zoneNameFor('ci.computer')).toBe('ci.computer')
  })
})

describe('parseArgs', () => {
  const argv = (...rest) => ['node', 'cloudflare-domain.mjs', ...rest]

  it('reads space-separated flags', () => {
    expect(parseArgs(argv('--project', 'avatars', '--domain', 'avatar.ci.computer'))).toEqual({
      dryRun: false,
      project: 'avatars',
      domain: 'avatar.ci.computer'
    })
  })

  it('reads --flag=value form', () => {
    expect(parseArgs(argv('--project=avatars', '--domain=avatar.ci.computer'))).toEqual({
      dryRun: false,
      project: 'avatars',
      domain: 'avatar.ci.computer'
    })
  })

  it('recognises --dry-run', () => {
    expect(parseArgs(argv('--dry-run')).dryRun).toBe(true)
  })

  it('rejects an unknown argument rather than ignoring it', () => {
    // A silently dropped typo would mean provisioning the wrong hostname.
    expect(() => parseArgs(argv('--projekt', 'avatars'))).toThrow(/Unknown argument/)
  })
})
