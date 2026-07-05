import { describe, expect, it } from 'vitest'

import { ARKIT_52, OCULUS_VISEMES, detectFacialTier, describeFacialTier } from './facialTiers'
import { inspectFacialRig } from './facialCapabilities'

describe('detectFacialTier', () => {
  it('full ARKit-52 morph set → arkit', () => {
    expect(detectFacialTier([...ARKIT_52])).toBe('arkit')
  })

  it('a partial ARKit set (>=60%) still resolves to arkit (HumGen/RPM heads)', () => {
    const partial = ARKIT_52.slice(0, 34) // ~65%
    expect(detectFacialTier([...partial])).toBe('arkit')
  })

  it('15 Oculus visemes (no ARKit) → oculus-viseme', () => {
    expect(detectFacialTier([...OCULUS_VISEMES])).toBe('oculus-viseme')
  })

  it('VRM standard mouth visemes + presets → vrm-basic', () => {
    expect(detectFacialTier(['aa', 'ih', 'ou', 'ee', 'oh', 'happy', 'blink'])).toBe('vrm-basic')
  })

  it('VRM head with only most mouth visemes still classifies as vrm-basic', () => {
    expect(detectFacialTier(['aa', 'ih', 'ou'], { isVRM: true })).toBe('vrm-basic')
  })

  it('a body-only mesh with no facial morphs → none', () => {
    expect(detectFacialTier(['Hips', 'Spine', 'Head'])).toBe('none')
  })

  it('case-insensitive matching', () => {
    expect(detectFacialTier(ARKIT_52.map((n) => n.toUpperCase()))).toBe('arkit')
  })

  it('ranks increase with detail', () => {
    expect(describeFacialTier('metahuman').rank).toBeGreaterThan(describeFacialTier('arkit').rank)
    expect(describeFacialTier('arkit').rank).toBeGreaterThan(describeFacialTier('vrm-basic').rank)
  })
})

describe('inspectFacialRig', () => {
  it('reads morph names from a GLB scene → arkit', () => {
    const dict = Object.fromEntries(ARKIT_52.map((n, i) => [n, i]))
    const scene = { traverse: (cb: (o: unknown) => void) => cb({ morphTargetDictionary: dict }) }
    const info = inspectFacialRig({ scene })
    expect(info.tier).toBe('arkit')
    expect(info.isVRM).toBe(false)
    expect(info.names.length).toBe(52)
  })

  it('reads expression names from a VRM → vrm-basic', () => {
    const vrm = { expressionManager: { expressionMap: { aa: {}, ih: {}, ou: {}, ee: {}, oh: {}, happy: {} } } }
    const info = inspectFacialRig({ vrm })
    expect(info.tier).toBe('vrm-basic')
    expect(info.isVRM).toBe(true)
  })

  it('empty head → none', () => {
    expect(inspectFacialRig({ scene: { traverse: () => {} } }).tier).toBe('none')
  })
})
