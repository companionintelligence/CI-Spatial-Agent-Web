import { describe, expect, it } from 'vitest'

import { cleanText, fixDollars } from './textUtils'

describe('fixDollars', () => {
  it('spells out a whole-dollar amount', () => {
    expect(fixDollars('It costs $5.')).toBe('It costs five dollars.')
  })

  it('spells out dollars and cents', () => {
    expect(fixDollars('$1.50')).toBe('one dollars and fifty cents')
  })

  it('handles thousands with a hyphenated tens word', () => {
    expect(fixDollars('$1234.56')).toBe(
      'one thousand two hundred and thirty-four dollars and fifty-six cents'
    )
  })

  it('leaves non-currency text untouched', () => {
    expect(fixDollars('no money here')).toBe('no money here')
  })
})

describe('cleanText', () => {
  it('strips markdown/markup punctuation', () => {
    expect(cleanText('**bold** <tag> 50%-off')).toBe('bold tag 50off')
  })

  it('applies dollar conversion before stripping (hyphen removed too)', () => {
    // fixDollars produces "thirty-four"; cleanText then strips the hyphen.
    expect(cleanText('$34')).toBe('thirtyfour dollars')
  })
})
