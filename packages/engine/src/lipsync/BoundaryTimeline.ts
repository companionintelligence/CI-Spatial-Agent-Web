/**
 * BoundaryTimeline — real word timings from `SpeechSynthesisUtterance.onboundary`.
 *
 * WHY
 * ---
 * The browser's own speech engine exposes no audio graph, so there is no FFT to
 * read and the default install had nothing driving the mouth at all. It does,
 * however, fire a `boundary` event as each word begins, carrying `charIndex` and
 * `elapsedTime`. That is REAL timing information from the engine actually
 * producing the sound — strictly better than the estimate it replaces, which
 * guessed 150 WPM and added `Math.random()` pauses that drifted over a second
 * across a long sentence.
 *
 * THE INCREMENTAL PROBLEM
 * -----------------------
 * A boundary tells you when a word STARTS. Its duration is only knowable when the
 * next boundary arrives (or the utterance ends). So each word is appended with a
 * provisional duration and then corrected the moment the next boundary lands.
 * Lip-sync therefore runs slightly ahead of certainty and self-corrects, which is
 * the right trade: a viseme 40 ms early is invisible, a mouth that waits for
 * certainty is a mouth that never moves.
 */

export interface WordTiming {
  word: string
  /** Milliseconds from utterance start. */
  time: number
  /** Milliseconds. Provisional until the next boundary corrects it. */
  duration: number
}

/**
 * `SpeechSynthesisEvent.elapsedTime` is specified in SECONDS, and Chromium has
 * reported it in MILLISECONDS for years. Both are in the wild, and guessing per
 * event is unsafe: 1.7 is a plausible second-count AND a plausible (if tiny)
 * millisecond-count.
 *
 * So infer the unit for the utterance as a whole, by comparing the largest value
 * seen against a duration the text itself implies. Measured against macOS
 * Chromium: "hello there my good friend" reported boundaries at 870…1701 with a
 * 2352 end — unambiguously milliseconds under this test, and a Firefox-style
 * 0.87…1.70 is unambiguously seconds.
 */
function inferMillisecondScale(text: string, maxElapsed: number): number {
  const impliedMs = Math.max(400, text.length * 60)
  return maxElapsed > 0 && maxElapsed <= impliedMs / 100 ? 1000 : 1
}

/** Fallback per-character duration used for a word that has no successor yet. */
const PROVISIONAL_MS_PER_CHAR = 62

/** Floor for a provisional duration, so a one-letter word still gets a shape. */
const MIN_PROVISIONAL_MS = 90

export class BoundaryTimeline {
  private text = ''
  /** Raw entries in whatever unit the engine used; normalized on read. */
  private entries: WordTiming[] = []
  private maxElapsed = 0

  /** Start a new utterance. */
  reset(text: string): void {
    this.text = text
    this.entries = []
    this.maxElapsed = 0
  }

  /**
   * Record a boundary. `charIndex` is the offset into the utterance text and
   * `elapsedTimeMs` is milliseconds since the utterance began.
   *
   * `charLength` is optional because Safari and Firefox omit it; the word is
   * recovered from the text when it is missing.
   */
  addBoundary(charIndex: number, elapsedTime: number, charLength?: number): void {
    if (!Number.isFinite(charIndex) || !Number.isFinite(elapsedTime)) return

    const word = this.wordAt(charIndex, charLength)
    if (!word) return

    this.maxElapsed = Math.max(this.maxElapsed, elapsedTime)

    // Correct the previous word to end exactly where this one starts.
    const previous = this.entries[this.entries.length - 1]
    if (previous) {
      const corrected = elapsedTime - previous.time
      if (corrected > 0) previous.duration = corrected
    }

    this.entries.push({
      word,
      time: elapsedTime,
      // Provisional, in the engine's own unit — scaled with everything else on read.
      duration: Math.max(MIN_PROVISIONAL_MS, word.length * PROVISIONAL_MS_PER_CHAR) /
        inferMillisecondScale(this.text, this.maxElapsed)
    })
  }

  /**
   * Close the final word against the utterance's real end time, so the last
   * shape does not hang past the audio.
   */
  finish(totalElapsed: number): void {
    const last = this.entries[this.entries.length - 1]
    if (!last) return
    if (Number.isFinite(totalElapsed)) this.maxElapsed = Math.max(this.maxElapsed, totalElapsed)
    const corrected = totalElapsed - last.time
    if (corrected > 0) last.duration = corrected
  }

  /** Word timings in the `{words, wtimes, wdurations}` shape the rest of the stack speaks. */
  toWordTimings(): { words: string[]; wtimes: number[]; wdurations: number[] } {
    const scale = inferMillisecondScale(this.text, this.maxElapsed)
    return {
      words: this.entries.map((e) => e.word),
      wtimes: this.entries.map((e) => e.time * scale),
      wdurations: this.entries.map((e) => e.duration * scale)
    }
  }

  get length(): number {
    return this.entries.length
  }

  /**
   * The word beginning at `charIndex`.
   *
   * Engines disagree about what `charIndex` points at — some give the first
   * character of the word, some the whitespace before it — so scan forward to the
   * next word character before reading. Without that, every word comes back
   * shifted by one and the shapes are consistently wrong.
   */
  private wordAt(charIndex: number, charLength?: number): string {
    if (charIndex < 0 || charIndex >= this.text.length) return ''
    if (charLength && charLength > 0) {
      return this.text.slice(charIndex, charIndex + charLength).trim()
    }
    let start = charIndex
    while (start < this.text.length && /\s/.test(this.text[start])) start++
    let end = start
    while (end < this.text.length && !/\s/.test(this.text[end])) end++
    return this.text.slice(start, end).trim()
  }
}
