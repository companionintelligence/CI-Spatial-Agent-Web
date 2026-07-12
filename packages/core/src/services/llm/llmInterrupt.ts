/**
 * A "latest interrupt" marker threaded into every LLM adapter's stale-work guard.
 *
 * It is either a fixed timestamp (legacy/tests) OR a live getter that always reports
 * the newest user turn. The getter form is what makes cross-turn cancellation work:
 * an adapter streaming an old turn re-reads the getter on every fragment, sees a newer
 * interrupt than its own, and stops calling tts.speak(). Passing the request's own
 * interrupt by value (as the code used to) made the guard compare a number to itself,
 * so it never fired and a new turn couldn't stop the previous turn's in-flight stream.
 */
export type LatestInterrupt = number | (() => number)

/** Resolve a {@link LatestInterrupt} to its current numeric value. */
export function readLatestInterrupt(latest: LatestInterrupt): number {
  return typeof latest === 'function' ? latest() : latest
}
