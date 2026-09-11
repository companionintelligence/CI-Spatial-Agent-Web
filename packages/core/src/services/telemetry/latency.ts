/**
 * latency.ts — the conversational-latency instrument.
 *
 * A companion is judged on how long it takes to answer, and nothing in this
 * stack measured that. Every latency claim was an impression. These marks make
 * the pipeline legible end to end:
 *
 *   user stops speaking → STT final → LLM first token → TTS first byte
 *                       → first audio out → first viseme on the face
 *
 * The budgets below are asserted in a test rather than merely logged, because a
 * performance target nobody checks is a performance target that regresses.
 */

export type LatencyStage =
  | 'turn-start'
  | 'stt-final'
  | 'llm-first-token'
  | 'tts-first-byte'
  | 'first-audio'
  | 'first-viseme'

/** Milliseconds from `turn-start`, per stage. */
export type LatencyTrace = Partial<Record<LatencyStage, number>>

export const LATENCY_BUDGETS_MS: Readonly<Partial<Record<LatencyStage, number>>> = {
  'llm-first-token': 400,
  'first-audio': 900
}

let turnStart = 0
let current: LatencyTrace = {}
let last: LatencyTrace | null = null

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Begin a turn. Everything after is measured relative to it, so the numbers mean
 * "how long did the user wait", not "how long did this component take".
 */
export function beginTurn(): void {
  if (Object.keys(current).length > 0) last = current
  turnStart = now()
  // Zero by definition. Routing it through mark() measured the clock read
  // itself, so the origin of every other stage was offset by a few microseconds.
  current = { 'turn-start': 0 }
}

/**
 * Record a stage. First write wins: these are FIRST-token / FIRST-audio
 * measurements, and letting a later chunk overwrite them would quietly turn a
 * latency metric into a duration metric.
 */
export function mark(stage: LatencyStage): void {
  if (current[stage] !== undefined) return
  current[stage] = Math.max(0, now() - turnStart)
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(`ci-avatar:${stage}`)
    } catch {
      // The entry buffer can be full; the in-memory trace is the source of truth.
    }
  }
}

/** The turn in progress. */
export function getLatencyTrace(): LatencyTrace {
  return { ...current }
}

/** The last completed turn, so a HUD does not flicker mid-turn. */
export function getLastLatencyTrace(): LatencyTrace | null {
  return last ? { ...last } : null
}

/** Stages that exceeded their budget in the given trace. */
export function overBudget(trace: LatencyTrace): LatencyStage[] {
  return (Object.keys(LATENCY_BUDGETS_MS) as LatencyStage[]).filter((stage) => {
    const value = trace[stage]
    const budget = LATENCY_BUDGETS_MS[stage]
    return value !== undefined && budget !== undefined && value > budget
  })
}

/** Test hook. */
export function __resetLatency(): void {
  turnStart = 0
  current = {}
  last = null
}
