import type { WhisperData } from './ttsConfig'

/**
 * Generate approximated whisper-like timings and rescale to the requested total duration.
 * `duration` is in seconds. `startTime` in ms.
 */
export function approximateWhisperDataFromText(
  text: string,
  duration: number = 999.0,   // seconds
  speechRate: number = 1.0,
  startTime: number = 0     // ms
): WhisperData {
  // Tokenize while preserving punctuation on tokens
  const tokens = (text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) {
    return { words: [], wtimes: [], wdurations: [] };
  }

  const baseWPM = 150;
  const adjustedWPM = baseWPM * speechRate;

  const wtimes: number[] = [];
  const wdurations: number[] = [];

  let t = startTime;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const word = token.toLowerCase().replace(/[^\w]/g, ""); // only for syllable calc

    const charCount = Math.max(1, word.length);
    const syllables = estimateSyllables(word);

    // Half a word-time per syllable; adjust with crude char modifier
    const syllableDuration = ((60 / adjustedWPM) * 1000) / 2; // ms
    const charModifier = Math.max(0.5, charCount / 5);

    const dur = syllables * syllableDuration * charModifier;

    wtimes.push(t);
    wdurations.push(dur);

    // Pause based on punctuation on the original token
    let pause = 50 + Math.random() * 50; // 50–100 ms base
    if (/[.!?]$/.test(token)) {
      pause += 200 + Math.random() * 200;
    } else if (/[,]$/.test(token)) {
      pause += 100 + Math.random() * 100;
    }

    t += dur + pause;
  }

  // === Rescale to requested total duration ===
  const targetSpanMs = duration * 1000;
  const firstStart = wtimes[0];
  const lastEnd = wtimes[wtimes.length - 1] + wdurations[wdurations.length - 1];
  const origSpanMs = Math.max(1, lastEnd - firstStart);
  const scale = targetSpanMs / origSpanMs;

  const scaledWtimes = wtimes.map((ms) => (ms - firstStart) * scale + startTime);
  const scaledWdurations = wdurations.map((ms) => ms * scale);

  return {
    words: tokens,
    wtimes: scaledWtimes,
    wdurations: scaledWdurations,
  };
}

/** Simple heuristic */
function estimateSyllables(word: string): number {
  if (!word) return 1;
  if (word.length <= 3) return 1;

  const vowels = "aeiouy";
  let count = 0;
  let prevV = false;

  for (let i = 0; i < word.length; i++) {
    const v = vowels.includes(word[i]);
    if (v && !prevV) count++;
    prevV = v;
  }
  if (word.endsWith("e") && count > 1) count--; // silent e
  return Math.max(1, count);
}
