import { useEffect, useState } from 'react'

const XR_DEVICE_REGEX = /(Oculus|Quest|XREAL|XRBrowser|Pico|Vive|VR)/i

export const useXRLayout = () => {
  const [isXR, setIsXR] = useState(false)

  useEffect(() => {
    let cancelled = false
    const ua = navigator.userAgent || ''
    const isXRDevice = XR_DEVICE_REGEX.test(ua)
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false

    async function checkSupport() {
      if (!('xr' in navigator) || !navigator.xr?.isSessionSupported) {
        if (!cancelled) setIsXR(isXRDevice && isCoarsePointer)
        return
      }
      try {
        const supportsImmersive = await navigator.xr.isSessionSupported('immersive-vr')
        if (!cancelled) setIsXR((supportsImmersive && isCoarsePointer) || isXRDevice)
      } catch {
        if (!cancelled) setIsXR(isXRDevice && isCoarsePointer)
      }
    }

    checkSupport()

    return () => {
      cancelled = true
    }
  }, [])

  return { isXR }
}
