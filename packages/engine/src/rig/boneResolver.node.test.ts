import { describe, expect, it } from 'vitest'

import { normalizeAvatarUrl, resolveBones, type NodeLike } from './boneResolver'

const bone = (name: string): NodeLike => ({ name, isBone: true })
const mesh = (name: string): NodeLike => ({ name, isMesh: true })

describe('resolveBones', () => {
  it('resolves a Ready Player Me skeleton', () => {
    const found = resolveBones([bone('Hips'), bone('Spine'), bone('Spine2'), bone('Neck'), bone('Head')])
    expect(found.head?.name).toBe('Head')
    expect(found.spine2?.name).toBe('Spine2')
  })

  it('resolves a Mixamo skeleton through its prefix', () => {
    const found = resolveBones([bone('mixamorigHead'), bone('mixamorigLeftForeArm')])
    expect(found.head?.name).toBe('mixamorigHead')
    expect(found.leftForeArm?.name).toBe('mixamorigLeftForeArm')
  })

  it('resolves underscore/side-suffix naming', () => {
    const found = resolveBones([bone('Hand_L'), bone('Hand_R'), bone('eye_L')])
    expect(found.leftHand?.name).toBe('Hand_L')
    expect(found.rightHand?.name).toBe('Hand_R')
    expect(found.leftEye?.name).toBe('eye_L')
  })

  it('does NOT bind head to an RPM Headphones prop', () => {
    // Anchoring the pattern is the whole point: gaze bound to a hat is a
    // memorable way to lose an afternoon.
    const found = resolveBones([mesh('Wolf3D_Headwear'), mesh('Headphones'), bone('Head')])
    expect(found.head?.name).toBe('Head')
  })

  it('prefers a real bone over a mesh node with the same name', () => {
    const found = resolveBones([mesh('Head'), bone('Head')])
    expect(found.head?.isBone).toBe(true)
  })

  it('falls back to a mesh node when no bone matches', () => {
    // Rigid-node robots have no skeleton; driving the mesh node is still better
    // than an inert head.
    const found = resolveBones([mesh('Head')])
    expect(found.head?.name).toBe('Head')
  })

  it('lets a VRM humanoid mapping win over name matching', () => {
    // The exporter declared it; guessing from names would be strictly worse.
    const declared = bone('J_Bip_C_Head')
    const found = resolveBones([bone('Head'), declared], {
      humanoid: (slot) => (slot === 'head' ? declared : null)
    })
    expect(found.head).toBe(declared)
  })

  it('still name-matches slots the humanoid mapping does not cover', () => {
    const found = resolveBones([bone('Head'), bone('LeftHand')], {
      humanoid: (slot) => (slot === 'head' ? bone('J_Bip_C_Head') : null)
    })
    expect(found.head?.name).toBe('J_Bip_C_Head')
    expect(found.leftHand?.name).toBe('LeftHand')
  })

  it('returns an empty map for a model with no recognizable rig', () => {
    expect(resolveBones([mesh('Cube'), mesh('Sphere')])).toEqual({})
  })

  it('ignores unnamed nodes', () => {
    expect(resolveBones([{ isBone: true }, bone('Head')]).head?.name).toBe('Head')
  })
})

describe('normalizeAvatarUrl', () => {
  it('requests the morph sets Ready Player Me strips by default', () => {
    // Without this an RPM avatar loads with no visemes and simply cannot lip-sync.
    const url = normalizeAvatarUrl('https://models.readyplayer.me/abc123.glb')
    expect(url).toContain('morphTargets=Oculus%20Visemes,ARKit')
  })

  it('appends with & when the URL already has a query', () => {
    const url = normalizeAvatarUrl('https://models.readyplayer.me/abc.glb?quality=high')
    expect(url).toContain('?quality=high&morphTargets=')
  })

  it('leaves an already-augmented URL alone', () => {
    const url = 'https://models.readyplayer.me/abc.glb?morphTargets=ARKit'
    expect(normalizeAvatarUrl(url)).toBe(url)
  })

  it('leaves non-RPM URLs untouched', () => {
    expect(normalizeAvatarUrl('/assets/avatars/greg.glb')).toBe('/assets/avatars/greg.glb')
  })
})
