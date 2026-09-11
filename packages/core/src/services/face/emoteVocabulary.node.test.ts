import { describe, expect, it } from 'vitest'

import { translateEmoteTargets } from './emoteVocabulary'

describe('translateEmoteTargets', () => {
  it('passes canonical ARKit names straight through', () => {
    expect(translateEmoteTargets({ browDownLeft: 0.6 }).weights).toEqual({ browDownLeft: 0.6 })
  })

  it('expands symmetric shorthands to both sides', () => {
    // `mouthSmile: 0.6` is the entire "happy" baseline. Looking it up against a
    // rig dictionary found nothing, so happy never reached the mouth.
    expect(translateEmoteTargets({ mouthSmile: 0.6 }).weights).toEqual({
      mouthSmileLeft: 0.6,
      mouthSmileRight: 0.6
    })
  })

  it('maps the eyes shorthands used by every mood baseline', () => {
    expect(translateEmoteTargets({ eyesLookDown: 0.1, eyesClosed: 1 }).weights).toEqual({
      eyeLookDownLeft: 0.1,
      eyeLookDownRight: 0.1,
      eyeBlinkLeft: 1,
      eyeBlinkRight: 1
    })
  })

  it('drops bone and hand channels without reporting them as unmapped', () => {
    const result = translateEmoteTargets({ headRotateX: 0.4, handFistLeft: 1, eyesRotateX: 0.2 })
    expect(result.weights).toEqual({})
    expect(result.unmapped).toEqual([])
  })

  it('surfaces a genuinely unknown key instead of swallowing it', () => {
    expect(translateEmoteTargets({ someTypo: 0.5 }).unmapped).toEqual(['someTypo'])
  })

  it('keeps the strongest value when two inputs collide on one canonical key', () => {
    expect(translateEmoteTargets({ mouthSmile: 0.3, mouthSmileLeft: 0.9 }).weights.mouthSmileLeft).toBe(0.9)
  })

  it('ignores non-numeric and non-finite values', () => {
    const result = translateEmoteTargets({ jawOpen: Number.NaN, mouthFunnel: 'x' as unknown as number })
    expect(result.weights).toEqual({})
  })
})
