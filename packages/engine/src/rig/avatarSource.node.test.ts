import { describe, expect, it } from 'vitest'

import { resolveAvatarSource } from './avatarSource'

const CATALOG = { Greg: '/assets/avatars/greg.glb' }

describe('resolveAvatarSource', () => {
  it('resolves a catalog name', () => {
    expect(resolveAvatarSource('Greg', CATALOG)).toEqual({ ok: true, url: '/assets/avatars/greg.glb' })
  })

  it('accepts a bundled asset path', () => {
    expect(resolveAvatarSource('/assets/avatars/other.vrm').url).toBe('/assets/avatars/other.vrm')
  })

  it('accepts an https glb and augments Ready Player Me morph targets', () => {
    const r = resolveAvatarSource('https://models.readyplayer.me/64bf.glb')
    expect(r.ok).toBe(true)
    expect(r.url).toContain('morphTargets=')
  })

  it('coerces an RPM viewer link into the loadable model URL', () => {
    // The share links a user actually copies are viewer pages; loading one
    // returns HTML and fails deep inside the glTF parser with a useless message.
    const r = resolveAvatarSource('https://readyplayer.me/avatar?id=64bf1234567890abcdef1234')
    expect(r.url).toContain('models.readyplayer.me/64bf1234567890abcdef1234.glb')
  })

  it('rejects an empty input with a reason', () => {
    expect(resolveAvatarSource('  ')).toMatchObject({ ok: false, error: 'empty' })
  })

  it('rejects a non-model URL rather than blanking the viewport', () => {
    expect(resolveAvatarSource('https://example.com/page.html')).toMatchObject({
      ok: false,
      error: 'unsupported-extension'
    })
  })

  it('rejects a non-http protocol', () => {
    expect(resolveAvatarSource('file:///etc/passwd.glb')).toMatchObject({
      ok: false,
      error: 'unsupported-protocol'
    })
  })

  it('tolerates a query string on the extension check', () => {
    expect(resolveAvatarSource('https://cdn.example.com/a.vrm?v=2').ok).toBe(true)
  })

  it('always returns a message when it rejects', () => {
    for (const input of ['', 'https://example.com/x.png', 'ftp://h/a.glb']) {
      const r = resolveAvatarSource(input)
      expect(r.ok).toBe(false)
      expect(r.message).toBeTruthy()
    }
  })
})
