import type { CompositorTrace, FaceCompositor } from '@ci-avatar/engine'

/**
 * Per-frame explanation of the SPEECH layer's decision.
 *
 * Lip-sync failures are almost always upstream of the compositor — no analyser,
 * no audio energy, a sequence that never went live — and every one of those looks
 * identical from the outside: a closed mouth. Recording the decision makes the
 * cause readable instead of inferable.
 */
export interface FaceSpeechDebug {
  /** Which producer supplied the mouth, if any. */
  kind: 'scheduled' | 'sequence' | 'acoustic' | 'none'
  hasAnalyser: boolean
  /** Smoothed FFT energy, 0..1. */
  energy: number
  /** True when the compositor was told speech owns the mouth this frame. */
  claimed: boolean
  /** Text the TTS service reports as currently playing. */
  text: string
  /** Number of canonical keys the speech layer published. */
  keys: number
  /** Monotonic render-loop frame count — a frozen value means the loop stalled. */
  frame: number
}

let speechDebug: FaceSpeechDebug | null = null

export function setFaceSpeechDebug(debug: FaceSpeechDebug): void {
  speechDebug = debug
}

export function getFaceSpeechDebug(): FaceSpeechDebug | null {
  return speechDebug
}

/**
 * Registry for the mounted avatar's face compositor.
 *
 * Lives outside the component file so `AvatarModel.tsx` can stay a
 * components-only module (React Fast Refresh requires it), and so the capture
 * harness has a stable import that does not drag the whole avatar in.
 */
let active: FaceCompositor | null = null

export function setActiveFaceCompositor(compositor: FaceCompositor | null): void {
  active = compositor
}

/**
 * Last frame's face arbitration — which layer won each region, what was written,
 * what is releasing — or null when no avatar is mounted.
 *
 * This is the regression surface for the compositor: a test asserts that speech
 * owned the jaw during an utterance rather than inspecting pixels.
 */
export function getFaceCompositorTrace(): CompositorTrace | null {
  return active?.trace() ?? null
}

/**
 * Close the face NOW — barge-in, or any other hard stop.
 *
 * Distinct from simply ceasing to contribute, which lets the release ramp take
 * ~200 ms. When a user talks over the avatar, the mouth stopping a fifth of a
 * second late is exactly the tell that makes an interruption feel unheard.
 */
export function resetActiveFace(rig?: Parameters<FaceCompositor['reset']>[0]): void {
  active?.reset(rig)
}

/**
 * Scripted face weights from the capture harness, or null when nothing is
 * overriding.
 *
 * The harness used to write `morphTargetInfluences` directly, which worked only
 * because nothing else owned those keys. Now that the compositor writes every
 * frame, a direct poke would be erased before it was ever photographed. Routing
 * through the OVERRIDE layer instead means the deterministic capture exercises
 * the SAME write path the product uses — a stronger test, not a weaker one.
 */
let override: Record<string, number> | null = null

export function setFaceOverride(entries: Record<string, number> | null): void {
  override = entries && Object.keys(entries).length > 0 ? { ...entries } : null
}

export function getFaceOverride(): Readonly<Record<string, number>> | null {
  return override
}

/**
 * The mounted avatar's facial capability tier, or null when nothing is mounted.
 *
 * Surfaced so the UI can be honest about what a given head can do. Several
 * avatars in the shipped roster are body-animation-only — a realistic VRM import
 * with empty expression binds looks broken rather than limited, and "this avatar
 * has no facial rig" is a far better answer than silence.
 */
let facialRig: import('./facialCapabilities').FacialRigInfo | null = null

export function setActiveFacialRig(info: import('./facialCapabilities').FacialRigInfo | null): void {
  facialRig = info
}

export function getActiveFacialRig(): import('./facialCapabilities').FacialRigInfo | null {
  return facialRig
}
