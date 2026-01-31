import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { createXRStore, XR, type XRStore } from '@react-three/xr'
import { memo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { SceneConfig } from './sceneTypes'
import type { useAnimationService } from '../../services/animation/useAnimationService'
import type { useEmoteService } from '../../services/emote/useEmoteService'
import type { useVisemeService } from '../../services/visemes/useVisemeService'
import { AvatarModel } from './avatar/AvatarModel'
import { GraphicsFallback } from './GraphicsFallback'


interface Scene3DProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  setXRStore?: (store: XRStore) => void
  webGPUEnabled: boolean
}

// WebGL context config - WebGPU support can be added later when stable
const createGLContext = (_webGPUEnabled: boolean) => {
  // For now, always use WebGL for stability
  // WebGPU support via three/webgpu is still experimental
  return {
    antialias: true,
    powerPreference: 'high-performance' as WebGLPowerPreference,
    alpha: true,
    stencil: false,
    depth: true,
    preserveDrawingBuffer: false
  }
}

const SceneContent = ({
  sceneConfig,
  visemeService,
  emoteService,
  animationService,
  store,
  webGPUEnabled   
}: Scene3DProps & { store: XRStore }) => {
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const [camTarget, setCamTarget] = useState<[number, number, number]>(sceneConfig.cameraTarget)
  const [camPos, setCamPos] = useState<[number, number, number]>(sceneConfig.cameraPosition)

  useEffect(() => {
    camera.position.set(camPos[0], camPos[1], camPos[2])
    camera.lookAt(new THREE.Vector3(camTarget[0], camTarget[1], camTarget[2]))
    if (controlsRef.current) {
      controlsRef.current.target.set(camTarget[0], camTarget[1], camTarget[2])
      controlsRef.current.update()
    }
  }, [camPos, camTarget, camera])

  const handleHeadLocated = (target: [number, number, number], position: [number, number, number]) => {
    setCamTarget(target)
    setCamPos(position)
  }
  return (
    <XR store={store}>
      <OrbitControls
        ref={controlsRef}
        target={camTarget}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={10}
      />

      {/* Improved lighting setup */}
      <ambientLight intensity={0.4} color={0xffffff} />
      
      {/* Key light - main directional light from front-right */}
      <directionalLight 
        position={[3, 5, 5]} 
        intensity={1.2} 
        color={0xffffff} 
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />
      
      {/* Fill light - softer light from left */}
      <directionalLight 
        position={[-3, 3, 2]} 
        intensity={0.5} 
        color={0xeeeeff}
      />
      
      {/* Rim/back light for depth */}
      <directionalLight 
        position={[0, 3, -5]} 
        intensity={0.3} 
        color={0xffeedd}
      />

      <Environment preset="studio" background={false} />

      <AvatarModel
        visemeService={visemeService}
        emoteService={emoteService}
        animationService={animationService}
        onHeadLocated={handleHeadLocated}
        webGPUEnabled={webGPUEnabled}
      />
    </XR>
  )
}

const Scene3DComponent = ({ sceneConfig, visemeService, emoteService, animationService, setXRStore, webGPUEnabled }: Scene3DProps) => {
  const store = createXRStore()

  useEffect(() => {
    if (setXRStore) {
      setXRStore(store)
    }
  }, [setXRStore, store])


  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas        
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        style={{ background: 'transparent' }}
        shadows={false}
        gl={createGLContext(webGPUEnabled)}
        onCreated={(state) => { (state as any).raycaster.firstHitOnly = true }}
        fallback={<GraphicsFallback />}
      >
        <SceneContent
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          store={store}
          webGPUEnabled={webGPUEnabled}
        />
      </Canvas>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const Scene3D = memo(Scene3DComponent)
