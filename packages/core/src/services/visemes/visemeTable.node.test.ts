import { describe, expect, it } from 'vitest'
import {
  ARKIT_LIP_SYNC_TARGETS,
  VISEME_WEIGHTS,
  getVisemeForChar,
  textToVisemeSequence
} from './visemeTable'

describe('visemeTable', () => {
  it('maps standard Latin vowels to correct visemes', () => {
    expect(getVisemeForChar('a')).toBe('AA')
    expect(getVisemeForChar('e')).toBe('EE')
    expect(getVisemeForChar('i')).toBe('IH')
    expect(getVisemeForChar('o')).toBe('OH')
    expect(getVisemeForChar('u')).toBe('OO')
  })

  it('maps consonants to articulatory visemes', () => {
    expect(getVisemeForChar('p')).toBe('PP')
    expect(getVisemeForChar('b')).toBe('PP')
    expect(getVisemeForChar('m')).toBe('PP')
    expect(getVisemeForChar('f')).toBe('FF')
    expect(getVisemeForChar('s')).toBe('SS')
  })

  it('provides all 52 ARKit target weights for each viseme', () => {
    for (const key of ARKIT_LIP_SYNC_TARGETS) {
      expect(VISEME_WEIGHTS.AA[key]).toBeDefined()
      expect(VISEME_WEIGHTS.PP[key]).toBeDefined()
    }
    expect(VISEME_WEIGHTS.AA.jawOpen).toBeGreaterThan(0.4)
    expect(VISEME_WEIGHTS.PP.mouthClose).toBeGreaterThan(0.5)
  })

  it('converts full text strings to viseme sequences', () => {
    const seq = textToVisemeSequence('Hello')
    expect(seq.length).toBe(5)
    expect(seq).toEqual(['ASPIRATE', 'EE', 'DD', 'DD', 'OH'])
  })
})
