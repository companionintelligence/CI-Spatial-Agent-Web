/**
 * Capability flags — finer-grained than Surface. Probed at boot and frozen for the
 * lifetime of the page (resize/orientation don't toggle these; XR session enter/leave
 * can). Drives feature gates: WebGPU MToon path, WebXR button visibility, mic/STT.
 */

export interface Capabilities {
  webgl2: boolean
  webgpu: boolean
  webxr: boolean
  immersiveVr: boolean
  immersiveAr: boolean
  handTracking: boolean
  webSpeech: boolean
}

function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

async function detectXR(): Promise<Pick<Capabilities, 'webxr' | 'immersiveVr' | 'immersiveAr' | 'handTracking'>> {
  const none = { webxr: false, immersiveVr: false, immersiveAr: false, handTracking: false }
  const xr = (typeof navigator !== 'undefined' ? (navigator as any).xr : undefined) as
    | { isSessionSupported?: (mode: string) => Promise<boolean> }
    | undefined
  if (!xr?.isSessionSupported) return none
  try {
    const [immersiveVr, immersiveAr] = await Promise.all([
      xr.isSessionSupported('immersive-vr').catch(() => false),
      xr.isSessionSupported('immersive-ar').catch(() => false)
    ])
    return {
      webxr: true,
      immersiveVr,
      immersiveAr,
      // Hand tracking can't be probed without a session; infer from VR support.
      handTracking: immersiveVr || immersiveAr
    }
  } catch {
    return none
  }
}

export async function detectCapabilities(): Promise<Capabilities> {
  const g = globalThis as any
  const xr = await detectXR()
  return {
    webgl2: detectWebGL2(),
    webgpu: !!g.navigator?.gpu,
    ...xr,
    webSpeech: typeof g.speechSynthesis !== 'undefined'
  }
}
