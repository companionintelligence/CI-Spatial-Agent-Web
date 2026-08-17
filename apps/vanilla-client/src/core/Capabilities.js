/**
 * Runtime capability detection — decides which rendering backend and which
 * XR session modes the engine can offer on this device/browser.
 */
export async function detectCapabilities() {
  const caps = {
    webgl2: false,
    webgpu: false,
    xr: false,
    immersiveAR: false,
    immersiveVR: false,
    // XRGPUBinding = WebXR rendered by WebGPU (Chrome flag / newer runtimes).
    xrGpuBinding: typeof self.XRGPUBinding !== 'undefined',
    domOverlay: false,
    userAgent: navigator.userAgent,
  };

  try {
    caps.webgl2 = !!document.createElement('canvas').getContext('webgl2');
  } catch { /* headless or blocked context */ }

  if (navigator.gpu) {
    try {
      caps.webgpu = !!(await navigator.gpu.requestAdapter());
    } catch { /* adapter request rejected */ }
  }

  if (navigator.xr) {
    caps.xr = true;
    try { caps.immersiveAR = await navigator.xr.isSessionSupported('immersive-ar'); } catch { /* ignore */ }
    try { caps.immersiveVR = await navigator.xr.isSessionSupported('immersive-vr'); } catch { /* ignore */ }
  }

  // dom-overlay support is only discoverable per-session; assume it on AR
  // capable browsers and let session init degrade gracefully.
  caps.domOverlay = caps.immersiveAR;

  return caps;
}

/**
 * Backend policy:
 *  - WebGPU when available and either no immersive XR is on offer, or the
 *    browser can bind WebXR to WebGPU (XRGPUBinding), or the user opted in.
 *  - Otherwise WebGL2 (three.js WebGPURenderer's forceWebGL backend), which
 *    keeps the battle-tested WebXR/WebGL path for headsets like Quest 3.
 */
export function chooseBackend(caps, rendererConfig) {
  const xrLikely = caps.immersiveAR || caps.immersiveVR;
  const webgpuOk =
    caps.webgpu &&
    rendererConfig.preferWebGPU &&
    (!xrLikely || caps.xrGpuBinding || rendererConfig.webgpuXR);
  return webgpuOk ? 'webgpu' : 'webgl2';
}
