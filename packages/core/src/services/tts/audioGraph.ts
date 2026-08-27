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
let panner: PannerNode | null = null

export interface SharedAudioGraph {
  context: AudioContext
  /** Shared analyser; everything routed through here is visible to lip-sync. */
  analyser: AnalyserNode | null
  /**
   * HRTF panner at the avatar's head, when spatial audio is on.
   *
   * Absorbed from CI-Spatial-Agent-Web-2, which spatialised the voice from the
   * start. In XR especially, a voice that arrives from the middle of your skull
   * rather than from the person in front of you breaks presence more completely
   * than any visual flaw — the avatar stops being somewhere in the room.
   */
  panner: PannerNode | null
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

  return { context, analyser, panner }
}

/**
 * Route the voice through an HRTF panner at `position`, creating it on first use.
 *
 * Call with null to go back to non-spatial output — the right default on a flat
 * desktop viewport, where the avatar is a bust on screen rather than a body in
 * the room, and HRTF just makes it sound off-centre.
 */
export function setVoicePosition(position: [number, number, number] | null): void {
  const graph = getAudioGraph()
  if (!graph) return
  const { context: ctx, analyser: node } = graph

  if (!position) {
    if (panner) {
      try {
        panner.disconnect()
      } catch {
        // Already detached.
      }
      panner = null
      // Reconnect the analyser straight to the speakers.
      try {
        node?.disconnect()
        node?.connect(ctx.destination)
      } catch {
        // Ignore: the graph is torn down.
      }
    }
    return
  }

  if (!panner) {
    panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1
    // A conversational voice should not vanish across a room; a gentle rolloff
    // keeps it audible while still placing it.
    panner.rolloffFactor = 0.6
    panner.connect(ctx.destination)
    try {
      node?.disconnect()
      node?.connect(panner)
    } catch {
      // If the analyser is gone, the panner is still connected to destination.
    }
  }

  const [x, y, z] = position
  if (panner.positionX) {
    panner.positionX.value = x
    panner.positionY.value = y
    panner.positionZ.value = z
  } else {
    // Safari still ships the deprecated setter.
    ;(panner as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z)
  }
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
  panner = null
}
