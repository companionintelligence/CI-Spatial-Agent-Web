import { VISEME_KEY_PREFIX } from '../face/regions'

/**
 * VisemeSchedule — a timed sequence of mouth shapes, queried per frame.
 *
 * WHY THIS REPLACES THE PER-CHARACTER GUESS
 * -----------------------------------------
 * The previous timing engine walked the utterance's CHARACTERS and gave each one
 * a share of the estimated duration. That is wrong twice over: orthography is not
 * phonetics ("though" is two visemes, not six), and the duration was itself a
 * guess. This takes real per-viseme timings from the TTS engine — HeadTTS/Kokoro
 * returns them outright — and interpolates between them.
 *
 * COARTICULATION
 * --------------
 * Speech is not a sequence of held poses. The mouth is already moving toward the
 * next shape before the current phoneme ends, and closures overshoot. Two rules
 * carry most of the realism:
 *
 *  1. **Lead-in / lead-out.** Each viseme ramps up before its nominal start and
 *     decays after its end, so neighbours overlap rather than switching.
 *  2. **Bilabial priority.** /p/ /b/ /m/ REQUIRE the lips to meet. At conversational
 *     speed a closure can be shorter than one frame at 60 fps, and if it is missed
 *     the avatar visibly says "aa-aa" where a human says "mama". Closures are given
 *     a floor duration and win ties against the vowels either side of them.
 */

/** Oculus viseme ids, the vocabulary HeadTTS and the LipsyncEn rules both emit. */
export type VisemeId =
  | 'sil' | 'PP' | 'FF' | 'TH' | 'DD' | 'kk' | 'CH'
  | 'SS' | 'nn' | 'RR' | 'aa' | 'E' | 'I' | 'O' | 'U'

export interface TimedViseme {
  viseme: VisemeId
  /** Seconds from the start of the utterance. */
  start: number
  /** Seconds. */
  duration: number
}

/** Lips-together closures. Missing one is far more visible than blurring a vowel. */
const BILABIAL: ReadonlySet<VisemeId> = new Set<VisemeId>(['PP'])

/** Minimum on-screen time for a closure, in seconds (~2 frames at 60 fps). */
const MIN_CLOSURE_SECONDS = 0.035

/** How long a viseme ramps in before its nominal start / out after its end. */
const LEAD_SECONDS = 0.03

export interface VisemeScheduleOptions {
  leadSeconds?: number
  minClosureSeconds?: number
}

export class VisemeSchedule {
  private timeline: TimedViseme[] = []
  private total = 0
  private readonly lead: number
  private readonly minClosure: number

  constructor(options: VisemeScheduleOptions = {}) {
    this.lead = options.leadSeconds ?? LEAD_SECONDS
    this.minClosure = options.minClosureSeconds ?? MIN_CLOSURE_SECONDS
  }

  /**
   * Load a schedule from parallel arrays in MILLISECONDS — the shape HeadTTS and
   * the LipsyncEn rules both produce. Entries are sorted and closures widened.
   */
  setFromArrays(visemes: readonly string[], times: readonly number[], durations: readonly number[]): void {
    const entries: TimedViseme[] = []
    const n = Math.min(visemes.length, times.length, durations.length)
    for (let i = 0; i < n; i++) {
      const id = visemes[i] as VisemeId
      const start = times[i] / 1000
      let duration = durations[i] / 1000
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue
      // Widen closures so a sub-frame /p/ still reaches the screen.
      if (BILABIAL.has(id) && duration < this.minClosure) duration = this.minClosure
      entries.push({ viseme: id, start, duration })
    }
    entries.sort((a, b) => a.start - b.start)
    this.timeline = entries
    this.total = entries.length > 0 ? Math.max(...entries.map((e) => e.start + e.duration)) : 0
  }

  clear(): void {
    this.timeline = []
    this.total = 0
  }

  get duration(): number {
    return this.total
  }

  get length(): number {
    return this.timeline.length
  }

  /**
   * Canonical `viseme:` contributions active at `time` (seconds from utterance
   * start), already coarticulated. Returns an empty object outside the utterance.
   *
   * Overlapping entries are kept rather than collapsed to a single winner: the
   * overlap IS the coarticulation, and the compositor's `max` blend resolves it
   * on the rig.
   */
  weightsAt(time: number): Record<string, number> {
    const out: Record<string, number> = {}
    if (this.timeline.length === 0 || time < -this.lead || time > this.total + this.lead) return out

    for (const entry of this.timeline) {
      const weight = this.envelope(entry, time)
      if (weight <= 0.001) continue
      if (entry.viseme === 'sil') continue
      const key = `${VISEME_KEY_PREFIX}${entry.viseme}`
      const previous = out[key] ?? 0
      if (weight > previous) out[key] = weight
    }
    return out
  }

  /**
   * Trapezoidal envelope: ramp in over `lead` before the nominal start, hold, ramp
   * out over `lead` after the nominal end. A closure gets a squarer envelope so it
   * reaches full contact instead of being averaged away by its neighbours.
   */
  private envelope(entry: TimedViseme, time: number): number {
    const attack = BILABIAL.has(entry.viseme) ? this.lead * 0.5 : this.lead
    const release = BILABIAL.has(entry.viseme) ? this.lead * 0.5 : this.lead

    const rampStart = entry.start - attack
    const end = entry.start + entry.duration
    const rampEnd = end + release

    if (time <= rampStart || time >= rampEnd) return 0
    if (time < entry.start) return (time - rampStart) / attack
    if (time <= end) return 1
    return 1 - (time - end) / release
  }
}

/**
 * Build a viseme schedule from WORD timings by distributing each word's visemes
 * across its measured span.
 *
 * This is the Tier B/C path: the engine gave us when each WORD is spoken (real
 * information) but not the phonemes within it, so the letter-to-sound rules supply
 * the shapes and the real word span supplies the clock. Strictly better than
 * estimating both, which is what the old generator did.
 */
export function scheduleFromWordTimings(
  words: readonly string[],
  wtimes: readonly number[],
  wdurations: readonly number[],
  wordToVisemes: (word: string) => { visemes: string[]; times: number[]; durations: number[] } | null
): { visemes: string[]; times: number[]; durations: number[] } {
  const outVisemes: string[] = []
  const outTimes: number[] = []
  const outDurations: number[] = []

  const n = Math.min(words.length, wtimes.length, wdurations.length)
  for (let i = 0; i < n; i++) {
    const word = words[i]
    if (!word) continue
    const parsed = wordToVisemes(word)
    if (!parsed || parsed.visemes.length === 0) continue

    // Scale the rules' notional timings onto the word's real span.
    const notionalTotal =
      parsed.times[parsed.times.length - 1] + parsed.durations[parsed.durations.length - 1]
    const scale = notionalTotal > 0 ? wdurations[i] / notionalTotal : 0
    if (scale <= 0) continue

    for (let j = 0; j < parsed.visemes.length; j++) {
      outVisemes.push(parsed.visemes[j])
      outTimes.push(wtimes[i] + parsed.times[j] * scale)
      outDurations.push(parsed.durations[j] * scale)
    }
  }

  return { visemes: outVisemes, times: outTimes, durations: outDurations }
}
