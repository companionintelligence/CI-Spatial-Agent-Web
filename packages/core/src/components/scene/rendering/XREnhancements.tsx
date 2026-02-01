/**
 * WebXR Enhancements for VR/AR support
 * - Controller support
 * - Spatial reference grid
 */

import { createXRStore, XRButton } from '@react-three/xr'
import { memo } from 'react'

interface XREnhancementsProps {
  enabled: boolean
  showGrid?: boolean
}

const XREnhancementsComponent = ({ 
  enabled, 
  showGrid = true 
}: XREnhancementsProps) => {
  if (!enabled) {
    return null
  }

  return (
    <>
      {/* Floor grid for spatial reference in VR */}
      {showGrid && (
        <gridHelper 
          args={[10, 10, 0x444444, 0x222222]} 
          position={[0, 0, 0]} 
        />
      )}
      
      {/* Reference sphere for scale validation */}
      <mesh position={[0, 1, -2]} visible={false}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial 
          color={0x00ff00} 
          emissive={0x00ff00} 
          emissiveIntensity={0.5}
        />
      </mesh>
    </>
  )
}

export const XREnhancements = memo(XREnhancementsComponent)

/**
 * Create XR store and button for entering VR/AR mode
 * Usage: const xrStore = createXRStore(); <XREnterButton store={xrStore} />
 */
export { createXRStore, XRButton }
