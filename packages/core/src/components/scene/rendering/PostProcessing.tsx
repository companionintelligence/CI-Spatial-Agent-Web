/**
 * Post-processing effects for enhanced visual quality
 * - Bloom for glowing effects
 * - Better visual fidelity on desktop
 */

import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { memo } from 'react'

interface PostProcessingProps {
  enabled: boolean
  quality: 'low' | 'medium' | 'high'
  isMobile: boolean
}

const PostProcessingComponent = ({ enabled, quality, isMobile }: PostProcessingProps) => {
  if (!enabled || isMobile || quality === 'low') {
    // Skip post-processing on mobile and low quality for performance
    return null
  }

  const bloomIntensity = quality === 'high' ? 0.3 : 0.2
  const bloomRadius = quality === 'high' ? 0.8 : 0.6

  return (
    <EffectComposer
      multisampling={quality === 'high' ? 8 : 4}
    >
      {/* Subtle bloom for highlights */}
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.9}
        radius={bloomRadius}
        mipmapBlur
      />
    </EffectComposer>
  )
}

export const PostProcessing = memo(PostProcessingComponent)
