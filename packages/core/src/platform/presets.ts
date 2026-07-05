/**
 * Per-surface render presets for the embodied companion. Pulled in once at boot so the
 * scene/avatar renderer doesn't redo this calculus per component. Tuned for a single
 * animated avatar (visemes + emotes + body anim) rather than a globe/splat scene, so
 * the knobs are avatar-relevant: DPR, AA, shadows, post-processing, WebXR foveation,
 * WebGPU preference, and a target FPS hint.
 */

import type { Surface } from './surface'

export interface RenderPreset {
  /** devicePixelRatio cap. */
  pixelRatio: number
  /** MSAA / SMAA on the canvas. */
  antialias: boolean
  /** Shadow mapping quality. */
  shadows: 'soft' | 'hard' | 'none'
  /** Post-processing budget (maps to PostProcessing `quality`). */
  postProcessing: 'high' | 'medium' | 'low' | 'off'
  /** WebXR foveation [0..1], higher = more aggressive. 0 disables. */
  foveation: number
  /** Prefer the WebGPU MToon path when the capability is present. */
  preferWebGPU: boolean
  /** Target frame-rate hint. */
  targetFps: number
}

const DESKTOP: RenderPreset = {
  pixelRatio: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2),
  antialias: true,
  shadows: 'soft',
  postProcessing: 'high',
  foveation: 0,
  preferWebGPU: true,
  targetFps: 60
}

const MOBILE: RenderPreset = {
  pixelRatio: 1.5,
  antialias: true,
  shadows: 'none',
  postProcessing: 'low',
  foveation: 0,
  preferWebGPU: false,
  targetFps: 30
}

const QUEST: RenderPreset = {
  pixelRatio: 1.2,
  antialias: false,
  shadows: 'none',
  postProcessing: 'off',
  foveation: 1.0,
  preferWebGPU: false,
  targetFps: 72
}

// Vision Pro composits the WebGL layer itself; keep DPR at 1, lean on foveation, and
// enable the WebGPU MToon path (Apple Silicon handles it) with a modest post budget.
const VISION_PRO: RenderPreset = {
  pixelRatio: 1.0,
  antialias: true,
  shadows: 'none',
  postProcessing: 'medium',
  foveation: 0.5,
  preferWebGPU: true,
  targetFps: 90
}

export function presetFor(surface: Surface): RenderPreset {
  switch (surface) {
    case 'desktop':
      return DESKTOP
    case 'mobile-ios':
    case 'mobile-android':
      return MOBILE
    case 'quest':
      return QUEST
    case 'vision-pro':
      return VISION_PRO
  }
}
