/**
 * audioGraph.ts — one AudioContext for the life of the page.
 *
 * `playAudioBuffer` used to do `new AudioContext()` per utterance and never
 * close it. Browsers cap concurrent contexts — Chrome at around six — and a
 * single spoken reply is many "breath" chunks, so a normal conversation walks
 * straight into the cap and then fails to construct one at all. Every subsequent
 * utterance is silent, which reads as the companion simply having stopped
 * talking.
 *
 * Sharing one context also makes the lip-sync clock coherent: `currentTime` is
 * per-context, so scheduling a viseme against a different context than the one
 * playing the audio is a category error that happens to look like drift.
 */

let context: AudioContext | null = null
let analyser: AnalyserNode | null = null

export interface SharedAudioGraph {
  context: AudioContext
  /** Shared analyser; everything routed through here is visible to lip-sync. */
  analyser: AnalyserNode | null
}

/**
 * The shared graph, created on first use.
 *
 * Autoplay policy means a context created before a user gesture starts
 * `suspended`; callers should `resume()` when they have one. Returns null in a
 * non-browser environment rather than throwing, so node tests can import this.
 */
export function getAudioGraph(): SharedAudioGraph | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null

  if (!context || context.state === 'closed') {
    context = new AudioContext()
    analyser = null
  }

  if (!analyser && typeof context.createAnalyser === 'function') {
    try {
      analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyser.connect(context.destination)
    } catch {
      analyser = null
    }
  }

  return { context, analyser }
}

/** Resume a suspended context — call from a user-gesture handler. */
export async function resumeAudioGraph(): Promise<void> {
  const graph = getAudioGraph()
  if (graph && graph.context.state === 'suspended') {
    try {
      await graph.context.resume()
    } catch {
      // A resume outside a gesture is rejected; the next gesture will retry.
    }
  }
}

/** Test hook — drops the shared graph so a fresh one is created. */
export function __resetAudioGraph(): void {
  context = null
  analyser = null
}
