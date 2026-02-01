import { useState, useEffect } from 'react'
import { detectCapabilities, getRenderQuality, type DeviceCapabilities, type RenderQuality } from './RendererConfig'

/**
 * Hook to detect and configure renderer based on device capabilities
 */
export const useRendererConfig = () => {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null)
  const [quality, setQuality] = useState<RenderQuality | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        const caps = await detectCapabilities()
        if (!mounted) return

        setCapabilities(caps)
        const qualitySettings = getRenderQuality(caps)
        setQuality(qualitySettings)
        setIsLoading(false)

        // Log capabilities for debugging
        console.log('Device Capabilities:', {
          type: caps.isMobile ? 'Mobile' : caps.isTablet ? 'Tablet' : 'Desktop',
          webGPU: caps.hasWebGPU,
          webGL2: caps.hasWebGL2,
          dpr: caps.devicePixelRatio,
          maxTexture: caps.maxTextureSize,
          vendor: caps.vendorInfo
        })
      } catch (error) {
        console.error('Failed to detect capabilities:', error)
        setIsLoading(false)
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [])

  return {
    capabilities,
    quality,
    isLoading
  }
}
