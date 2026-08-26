import { describe, expect, it } from 'vitest'

import { budgetHistory, estimateTokens, willTrim, type BudgetedMessage } from './historyBudget'

const msg = (role: BudgetedMessage['role'], content: string): BudgetedMessage => ({ role, content })
const long = (n: number) => 'x'.repeat(n * 4)

describe('estimateTokens', () => {
  it('approximates four characters per token', () => {
    expect(estimateTokens('x'.repeat(40))).toBe(10)
  })
})

describe('budgetHistory', () => {
  const options = { contextTokens: 100, reserveForReply: 20 }

  it('keeps everything when it fits', () => {
    const history = [msg('system', long(5)), msg('user', long(5)), msg('assistant', long(5))]
    expect(budgetHistory(history, options)).toHaveLength(3)
  })

  it('ALWAYS keeps the system prompt', () => {
    // The silent failure this exists to prevent: the server truncates from the
    // front, the persona vanishes, and the companion starts answering like a
    // generic assistant mid-conversation for no visible reason.
    const history = [msg('system', long(10)), ...Array.from({ length: 40 }, () => msg('user', long(10)))]
    const kept = budgetHistory(history, options)
    expect(kept[0].role).toBe('system')
    expect(kept.filter((m) => m.role === 'system')).toHaveLength(1)
  })

  it('drops the OLDEST turns, not the newest', () => {
    const history = [msg('user', 'oldest ' + long(20)), msg('user', 'newest ' + long(20))]
    const kept = budgetHistory(history, options)
    expect(kept.some((m) => m.content.startsWith('newest'))).toBe(true)
  })

  it('keeps at least the most recent message even if it alone exceeds the budget', () => {
    // Dropping it would send an empty conversation, which is worse than sending
    // one oversized turn and letting the provider complain.
    const kept = budgetHistory([msg('user', long(10_000))], options)
    expect(kept).toHaveLength(1)
  })

  it('never starts the trimmed history on a tool message', () => {
    // A tool result with no preceding assistant tool_calls turn is malformed for
    // most providers and gets rejected outright.
    const history = [
      msg('assistant', long(30)),
      msg('tool', long(30)),
      msg('user', long(10))
    ]
    const kept = budgetHistory(history, { contextTokens: 60, reserveForReply: 10 })
    expect(kept[0]?.role).not.toBe('tool')
  })

  it('reserves room for the reply by default', () => {
    const history = Array.from({ length: 20 }, () => msg('user', long(10)))
    const kept = budgetHistory(history, { contextTokens: 100 })
    const used = kept.reduce((n, m) => n + estimateTokens(m.content), 0)
    expect(used).toBeLessThanOrEqual(75)
  })

  it('reports whether a trim would happen', () => {
    expect(willTrim([msg('user', long(5))], options)).toBe(false)
    expect(willTrim(Array.from({ length: 50 }, () => msg('user', long(10))), options)).toBe(true)
  })
})
