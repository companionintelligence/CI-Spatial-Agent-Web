/**
 * historyBudget.ts — keep the conversation inside the model's context window.
 *
 * The full history was resent on every turn, unbounded. On a small local model
 * — a `gemma3:1b`, which is the appliance default — that walks into the context
 * limit within a few minutes of talking, and the failure is not a clean error:
 * the server silently truncates from the FRONT, which drops the system prompt.
 * The companion abruptly forgets its own persona and starts answering like a
 * generic assistant, mid-conversation, for no visible reason.
 */

export interface BudgetedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

/**
 * Rough token count.
 *
 * ~4 characters per token is the usual English approximation and is close
 * enough for a budget: being 15% out costs a little headroom, whereas running a
 * real tokenizer in the browser costs a megabyte of WASM to answer a question we
 * only need approximately right.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface BudgetOptions {
  /** Total context window of the model, in tokens. */
  contextTokens: number
  /** Tokens to leave free for the reply. */
  reserveForReply?: number
}

/**
 * Trim history to fit, keeping the system prompt and the most recent exchange.
 *
 * Drops from the OLDEST end, never the newest: the recent turns are what the
 * next reply has to be coherent with. System messages are always kept — they are
 * the persona and the recalled memory, and losing them is precisely the failure
 * this exists to prevent.
 */
export function budgetHistory(
  messages: readonly BudgetedMessage[],
  options: BudgetOptions
): BudgetedMessage[] {
  const reserve = options.reserveForReply ?? Math.floor(options.contextTokens * 0.25)
  const available = Math.max(0, options.contextTokens - reserve)

  const system = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')

  let used = system.reduce((sum, m) => sum + estimateTokens(m.content), 0)

  // Walk backwards from the newest, keeping what fits.
  const kept: BudgetedMessage[] = []
  for (let i = rest.length - 1; i >= 0; i--) {
    const cost = estimateTokens(rest[i].content)
    if (used + cost > available && kept.length > 0) break
    used += cost
    kept.unshift(rest[i])
  }

  // A `tool` message with no preceding assistant turn is malformed for most
  // providers and gets rejected outright, so never let the trim start on one.
  while (kept.length > 0 && kept[0].role === 'tool') kept.shift()

  return [...system, ...kept]
}

/** Would this history be trimmed? Useful for surfacing "older messages dropped". */
export function willTrim(messages: readonly BudgetedMessage[], options: BudgetOptions): boolean {
  return budgetHistory(messages, options).length < messages.length
}
