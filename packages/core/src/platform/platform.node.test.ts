import { afterEach, describe, expect, it, vi } from 'vitest'

import { detectSurfaceSync, isSpatial, SPATIAL_SURFACES, type Surface } from './surface'
import { presetFor } from './presets'

function stubUA(ua: string | undefined) {
  if (ua === undefined) {
    vi.stubGlobal('navigator', undefined)
  } else {
    vi.stubGlobal('navigator', { userAgent: ua } as Navigator)
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('detectSurfaceSync', () => {
  const cases: [string, string, Surface][] = [
    ['WebSpatial container', 'Mozilla/5.0 (visionOS) WebSpatial/1.0', 'vision-pro'],
    ['Apple Vision Pro UA', 'Mozilla/5.0 ... visionOS 2.0 Safari', 'vision-pro'],
    ['Quest browser', 'Mozilla/5.0 ... OculusBrowser/33 Quest 3', 'quest'],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'mobile-ios'],
    ['Android', 'Mozilla/5.0 (Linux; Android 14)', 'mobile-android'],
    ['plain desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'desktop']
  ]
  it.each(cases)('detects %s → %s', (_label, ua, expected) => {
    stubUA(ua)
    expect(detectSurfaceSync()).toBe(expected)
  })

  it('falls back to desktop when navigator is absent (SSR/node)', () => {
    stubUA(undefined)
    expect(detectSurfaceSync()).toBe('desktop')
  })
})

describe('presetFor', () => {
  it('vision-pro: DPR 1, foveated, WebGPU-preferred, 90fps', () => {
    const p = presetFor('vision-pro')
    expect(p.pixelRatio).toBe(1.0)
    expect(p.foveation).toBeGreaterThan(0)
    expect(p.preferWebGPU).toBe(true)
    expect(p.targetFps).toBe(90)
  })

  it('quest: foveated but NOT WebGPU-preferred (immature browser WebGPU)', () => {
    const p = presetFor('quest')
    expect(p.foveation).toBe(1.0)
    expect(p.preferWebGPU).toBe(false)
    expect(p.shadows).toBe('none')
  })

  it('mobile: no shadows, low post, 30fps', () => {
    const p = presetFor('mobile-android')
    expect(p.shadows).toBe('none')
    expect(p.postProcessing).toBe('low')
    expect(p.targetFps).toBe(30)
  })

  it('every surface resolves to a preset', () => {
    const surfaces: Surface[] = ['desktop', 'mobile-ios', 'mobile-android', 'quest', 'vision-pro']
    for (const s of surfaces) expect(presetFor(s)).toBeTruthy()
  })
})

describe('isSpatial', () => {
  it('only headset/spatial-OS surfaces are spatial', () => {
    expect(isSpatial('vision-pro')).toBe(true)
    expect(isSpatial('quest')).toBe(true)
    expect(isSpatial('desktop')).toBe(false)
    expect(isSpatial('mobile-ios')).toBe(false)
    expect(SPATIAL_SURFACES).toEqual(['quest', 'vision-pro'])
  })
})
