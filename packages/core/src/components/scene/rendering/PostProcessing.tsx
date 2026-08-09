/**
 * Post-processing effects for enhanced visual quality
 * - Ambient occlusion, for environments that are a room rather than a floating bust
 * - Bloom for glowing effects
 * - Better visual fidelity on desktop
 */

import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing'
import { memo, type JSX } from 'react'


interface PostProcessingProps {
  enabled: boolean
  quality: 'low' | 'medium' | 'high'
  isMobile: boolean
  /**
   * Screen-space ambient occlusion. OFF unless the caller asks, because the default viewport
   * is one avatar on a transparent background — there is nothing for an occlusion term to
   * occlude, and it would be paying a depth pass for it. The diorama is the opposite case:
   * twenty cabinets with panel gaps, louvres and door seams, all of which are modelled and
   * none of which read without something darkening the crevices.
   */
  ao?: boolean
}

const PostProcessingComponent = ({ enabled, quality, isMobile, ao = false }: PostProcessingProps) => {
  if (!enabled || isMobile || quality === 'low') {
    // Skip post-processing on mobile and low quality for performance
    return null
  }

  const bloomIntensity = quality === 'high' ? 0.3 : 0.2
  const bloomRadius = quality === 'high' ? 0.8 : 0.6

  // EffectComposer's children are typed as elements, not as `Element | false`, so the optional
  // pass is assembled here rather than inlined with a `&&` that would type-error.
  const effects: JSX.Element[] = []

  // N8AO rather than the SSAO effect: SSAO needs EffectComposer's normal pass, which is a
  // second full-scene render, and at the film's 3840x2160 capture buffer that is the most
  // expensive thing in the frame. N8AO reconstructs normals from depth instead, and `halfRes`
  // runs the AO and its denoise at quarter the pixels before a depth-aware upsample — which is
  // invisible on soft contact occlusion and is most of why this costs a handful of draw calls
  // rather than a whole second pass over the scene.
  //
  // aoRadius is in world units: 0.55 m is about the depth of the recess behind a cabinet door
  // and the gap between two bolted-together frames, which is the scale of the detail this is
  // here to recover. Much larger and it stops being crevice shading and starts dimming whole
  // machines.
  if (ao) {
    effects.push(
      <N8AO
        key="ao"
        halfRes
        quality={quality === 'high' ? 'medium' : 'low'}
        aoRadius={0.55}
        distanceFalloff={0.8}
        intensity={2.6}
        color="#050b0f"
      />
    )
  }

  // Subtle bloom for highlights
  effects.push(
    <Bloom
      key="bloom"
      intensity={bloomIntensity}
      luminanceThreshold={0.9}
      luminanceSmoothing={0.9}
      radius={bloomRadius}
      mipmapBlur
    />
  )

  return <EffectComposer multisampling={quality === 'high' ? 8 : 4}>{effects}</EffectComposer>
}

export const PostProcessing = memo(PostProcessingComponent)
