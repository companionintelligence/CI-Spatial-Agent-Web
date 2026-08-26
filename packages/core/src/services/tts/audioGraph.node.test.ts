import { describe, expect, it } from 'vitest'

import { __resetAudioGraph, getAudioGraph } from './audioGraph'

describe('shared audio graph', () => {
  it('returns null outside a browser instead of throwing', () => {
    // Imported by node tests transitively; blowing up here would take out
    // unrelated suites.
    __resetAudioGraph()
    expect(getAudioGraph()).toBeNull()
  })
})
