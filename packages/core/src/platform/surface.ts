/**
 * Surface = which physical target the embodied companion is running on.
 *
 * Detected once at boot; all platform-specific code gates on this enum rather than
 * forking the component tree. Adapted from the ci-time-machine engine pattern so the
 * one WebXR/WebSpatial build can serve desktop, mobile, Quest, and Vision Pro (and,
 * via WebSpatial, the wider spatial-platform roadmap: Android XR, Pico, Horizon OS).
 */

export type Surface = 'desktop' | 'mobile-ios' | 'mobile-android' | 'quest' | 'vision-pro'

/** True spatial (headset / spatial-OS) surfaces — get the XR render budget + spatial UI. */
export const SPATIAL_SURFACES: readonly Surface[] = ['quest', 'vision-pro']

export function isSpatial(surface: Surface): boolean {
  return SPATIAL_SURFACES.includes(surface)
}

/**
 * Synchronous best-effort surface detection from the user agent. WebSpatial injects
 * `WebSpatial` / `visionOS` into the UA, so the same build detects the native Vision Pro
 * container immediately and switches to the vision-pro render preset + spatial layout.
 */
export function detectSurfaceSync(): Surface {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/visionOS|WebSpatial/i.test(ua)) return 'vision-pro'
  if (/OculusBrowser|Quest/i.test(ua)) return 'quest'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'mobile-ios'
  // iPadOS 13+ reports as desktop Safari; treat touch-Macs conservatively as desktop.
  if (/Android/i.test(ua)) return 'mobile-android'
  return 'desktop'
}
