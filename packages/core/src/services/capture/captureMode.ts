/**
 * Still-frame capture mode, for the product-video pipeline.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * video/ photographs this app and COMMITS the PNGs, so a rerun against
 * unchanged UI has to produce identical bytes — otherwise a shot diff in a PR
 * is indistinguishable from a real UI change and carries no information.
 *
 * The scene defeats that by design. Scene3D keeps `frameloop` at "always"
 * because the avatar is meant to look alive, so the mixer, blink, gaze,
 * lip-sync and spring bones tick every frame, and DatacenterDiorama's indicator
 * lamps pulse off a sine of elapsed time. Measured across four captures on one
 * machine and one pinned kit, that produced three distinct drifts:
 *
 *   - the eyes: every high-amplitude difference between two runs was an eyelid,
 *     scheduled off performance.now() + Math.random() in emoteService;
 *   - the lamps: a fraction of a stop across a whole room moves every 8-bit
 *     quantisation boundary at once — 7-16% of pixels differing, almost none of
 *     it above 8/255, invisible to a viewer and total to a byte comparison;
 *   - the pose: sub-visible drift (~120 px differing by exactly 1) on shots
 *     that catch the avatar mid-motion.
 *
 * The capture layer cannot fix any of them from outside. It was tried: pausing
 * Playwright's fake clock and paying out virtual time through clock.runFor
 * makes rAF deterministic, but the app streams ~243 MB of avatar assets on real
 * time, so the virtual budget gets spent at a random point in the LOAD instead
 * of the animation. Measured, that was strictly worse — all 18 shots drifting,
 * against 8 before, and one shot with no avatar in it at all.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 *
 * Pins the scene to a still frame that is a pure function of `poseTime`, rather
 * than of when the assets happened to finish loading:
 *
 *   - the avatar plays the looping idle only, with the mixer's timeScale at 0
 *     and the action's time written every frame, so the pose is a constant;
 *   - the greet, blink, gaze, facial ticks and visemes do not run;
 *   - the indicator lamps hold a fixed phase.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * Not a product feature and not a performance mode. It is off unless the page
 * sets the global below BEFORE app code runs, which only video/capture.config.mjs
 * does (via Playwright's addInitScript). Off, it costs one property read per
 * frame and changes nothing — every branch that consults it falls through to the
 * existing path.
 *
 * Deliberately a window global rather than a store flag or a query parameter:
 * the capture harness has to set it before first render, from outside the app,
 * without a URL that would also reach a real user.
 */

export interface CaptureMode {
  /**
   * Seconds into the looping idle clip to hold. Any constant gives a stable
   * frame; this one is far enough in that the clip is past its opening and
   * reads as a settled, weight-bearing stance rather than a transition.
   */
  poseTime: number
}

declare global {
  interface Window {
    __CI_CAPTURE_MODE__?: boolean | { poseTime?: number }
  }
}

const DEFAULT_POSE_TIME = 6

/**
 * The capture-mode settings, or null when the app is running normally.
 *
 * Cheap enough to call per frame, but callers in a render path should still
 * memoise it — the value cannot change after first render, because the harness
 * sets it in an init script.
 */
export function getCaptureMode(): CaptureMode | null {
  if (typeof window === 'undefined') return null

  const raw = window.__CI_CAPTURE_MODE__
  if (!raw) return null

  const poseTime =
    typeof raw === 'object' && typeof raw.poseTime === 'number' && Number.isFinite(raw.poseTime)
      ? raw.poseTime
      : DEFAULT_POSE_TIME

  return { poseTime }
}

/** True when the app is being photographed rather than used. */
export function isCaptureMode(): boolean {
  return getCaptureMode() !== null
}
