/**
 * Renderer Configuration for Multi-Platform Support
 * 
 * Provides optimized renderer settings for:
 * - Desktop (WebGPU/WebGL2)
 * - Mobile (WebGL2 with reduced quality)
 * - WebXR (VR/AR with spatial tracking)
 */

import * as THREE from 'three'

export interface DeviceCapabilities {
  isDesktop: boolean
  isMobile: boolean
  isTablet: boolean
  hasWebGPU: boolean
  hasWebGL2: boolean
  devicePixelRatio: number
  maxTextureSize: number
  vendorInfo?: string
  /** UNMASKED_RENDERER_WEBGL — names the actual GL implementation. */
  rendererInfo?: string
  /**
   * True when WebGL is being rasterised on the CPU (SwiftShader, llvmpipe,
   * Microsoft Basic Render Driver). Such a context advertises full WebGL2 and
   * the same capabilities a discrete GPU does while being orders of magnitude
   * slower, so feature detection alone cannot tell the two apart.
   */
  isSoftwareRenderer: boolean
}

/**
 * Names reported by the common software rasterisers. SwiftShader is what
 * headless Chromium falls back to; llvmpipe/softpipe are the Mesa equivalents;
 * the Microsoft and VMware entries appear on VMs and over remote desktop.
 */
const SOFTWARE_RENDERER_RE =
  /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|vmware|virgl/i

export interface RenderQuality {
  shadowMapSize: number
  antialiasing: boolean
  pixelRatio: number
  toneMapping: THREE.ToneMapping
  toneMappingExposure: number
  outputColorSpace: THREE.ColorSpace
  maxLights: number
  useShadows: boolean
  useFXAA: boolean
  useSSAO: boolean
}

/**
 * Detect device capabilities
 */
export const detectCapabilities = async (): Promise<DeviceCapabilities> => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth > 768
  const isDesktop = !isMobile && !isTablet

  // Check WebGPU support
  let hasWebGPU = false
  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      hasWebGPU = !!adapter
    } catch {
      hasWebGPU = false
    }
  }

  // Check WebGL2 support
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  const hasWebGL2 = !!gl

  // Get max texture size
  let maxTextureSize = 2048 // safe default
  if (gl) {
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  }

  // Get device pixel ratio (capped for performance)
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  // Get GPU vendor info for optimization hints. The RENDERER string is the one
  // that names the implementation ("ANGLE (Google, Vulkan … SwiftShader Device)"),
  // so it is what decides whether we are on a CPU rasteriser; VENDOR alone reads
  // "Google Inc." for both hardware ANGLE and SwiftShader.
  let vendorInfo: string | undefined
  let rendererInfo: string | undefined
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      vendorInfo = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      rendererInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    }
  }
  const isSoftwareRenderer = SOFTWARE_RENDERER_RE.test(`${vendorInfo ?? ''} ${rendererInfo ?? ''}`)

  return {
    isDesktop,
    isMobile,
    isTablet,
    hasWebGPU,
    hasWebGL2,
    devicePixelRatio,
    maxTextureSize,
    vendorInfo,
    rendererInfo,
    isSoftwareRenderer
  }
}

/**
 * Get render quality settings based on device capabilities
 */
export const getRenderQuality = (capabilities: DeviceCapabilities, forceQuality?: 'low' | 'medium' | 'high'): RenderQuality => {
  // Determine quality level
  let quality: 'low' | 'medium' | 'high'
  
  if (forceQuality) {
    quality = forceQuality
  } else if (capabilities.isSoftwareRenderer) {
    // A CPU rasteriser passes every check below — desktop UA, WebGL2 present,
    // large MAX_TEXTURE_SIZE — and would land on 'high': 2048² shadow maps plus
    // SSAO, FXAA and MSAA at up to 2× pixel ratio, all without a GPU. That is a
    // slideshow on a real machine that has fallen back to software (no GPU,
    // blocklisted driver, VM, remote desktop), and in headless Chromium it is
    // slow enough that a frame never lands: every desktop product-video shot
    // timed out — page.screenshot at 30s, page.goto at 45s — while the mobile
    // viewport, which takes the 'low' branch below, captured fine.
    quality = 'low'
  } else if (capabilities.isMobile && !capabilities.isTablet) {
    quality = 'low'
  } else if (capabilities.isTablet || !capabilities.hasWebGL2) {
    quality = 'medium'
  } else {
    quality = 'high'
  }

  // Base settings
  const settings: Record<'low' | 'medium' | 'high', RenderQuality> = {
    low: {
      shadowMapSize: 512,
      antialiasing: false,
      pixelRatio: Math.min(capabilities.devicePixelRatio, 1.5),
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      outputColorSpace: THREE.SRGBColorSpace,
      maxLights: 4,
      useShadows: false,
      useFXAA: false,
      useSSAO: false
    },
    medium: {
      shadowMapSize: 1024,
      antialiasing: true,
      pixelRatio: Math.min(capabilities.devicePixelRatio, 1.5),
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      outputColorSpace: THREE.SRGBColorSpace,
      maxLights: 6,
      useShadows: true,
      useFXAA: true,
      useSSAO: false
    },
    high: {
      shadowMapSize: 2048,
      antialiasing: true,
      pixelRatio: Math.min(capabilities.devicePixelRatio, 2),
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      outputColorSpace: THREE.SRGBColorSpace,
      maxLights: 8,
      useShadows: true,
      useFXAA: true,
      useSSAO: true
    }
  }

  return settings[quality]
}

/**
 * Create WebGL context with optimized settings
 */
export const createWebGLContext = (capabilities: DeviceCapabilities, quality: RenderQuality): WebGLContextAttributes => {
  return {
    alpha: true,
    antialias: quality.antialiasing,
    depth: true,
    stencil: false,
    powerPreference: capabilities.isMobile ? 'default' : 'high-performance',
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    desynchronized: !capabilities.isMobile, // Reduce input latency on desktop
    premultipliedAlpha: true,
    xrCompatible: true // Enable WebXR support
  }
}

/**
 * Configure renderer after creation
 */
export const configureRenderer = (
  renderer: THREE.WebGLRenderer,
  capabilities: DeviceCapabilities,
  quality: RenderQuality
): void => {
  // Set pixel ratio
  renderer.setPixelRatio(quality.pixelRatio)

  // Enable/disable shadows
  renderer.shadowMap.enabled = quality.useShadows
  if (quality.useShadows) {
    renderer.shadowMap.type = capabilities.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap
  }

  // Tone mapping
  renderer.toneMapping = quality.toneMapping
  renderer.toneMappingExposure = quality.toneMappingExposure

  // Color management
  renderer.outputColorSpace = quality.outputColorSpace

  // Additional optimizations for mobile
  if (capabilities.isMobile) {
    renderer.sortObjects = true // Reduce overdraw
    renderer.info.autoReset = true
  }

  console.log(`Renderer configured for ${capabilities.isMobile ? 'mobile' : capabilities.isTablet ? 'tablet' : 'desktop'} with ${quality.useShadows ? 'shadows' : 'no shadows'}`)
}

/**
 * Get performance hints for runtime adjustments
 */
export const getPerformanceHints = (capabilities: DeviceCapabilities) => {
  return {
    // Reduce polygon count on mobile
    useSimplifiedModels: capabilities.isMobile,
    
    // Use texture compression
    useTextureCompression: capabilities.isMobile,
    
    // Reduce animation updates
    animationUpdateRate: capabilities.isMobile ? 30 : 60,
    
    // Frustum culling
    useFrustumCulling: true,
    
    // LOD (Level of Detail)
    useLOD: capabilities.isMobile,
    
    // Reduce particle count
    maxParticles: capabilities.isMobile ? 100 : 1000,
    
    // Physics update rate
    physicsUpdateRate: capabilities.isMobile ? 30 : 60
  }
}
