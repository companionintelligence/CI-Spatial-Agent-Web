import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { createXRStore, XR, type XRStore } from '@react-three/xr'
import { memo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import type { SceneConfig } from '../app/sceneTypes'
import type { useAnimationService } from '../services/animation/useAnimationService'
import type { useEmoteService } from '../services/emote/useEmoteService'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import { AvatarModel } from './AvatarModel'

interface Scene3DProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  setXRStore?: (store: XRStore) => void
}

const SceneContent = ({
  sceneConfig,
  visemeService,
  emoteService,
  animationService,
  store
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
      {/* Camera setup */}
      
      <OrbitControls
        ref={controlsRef}
        target={camTarget}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={10}
      />

      {/* Lighting */}
      {sceneConfig.roomLighting && (
        <>
          <ambientLight intensity={0.3} color={0xffffff} />
          <directionalLight position={[1, 1, 1]} intensity={0.8} color={0xffffff} castShadow />
        </>
      )}

      {/* Environment */}
      <Environment preset="studio" />

      {/* Avatar with external animations */}
      <AvatarModel
        visemeService={visemeService}
        emoteService={emoteService}
        animationService={animationService}
        onHeadLocated={handleHeadLocated}
      />

      {/* Ground plane */}
      {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh> */}
    </XR>
  )
}

const Scene3DComponent = ({ sceneConfig, visemeService, emoteService, animationService, setXRStore }: Scene3DProps) => {
  const store = createXRStore()
  

  useEffect(() => {
    if (setXRStore) {
      setXRStore(store)
    }
  }, [setXRStore, store])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Avatar Controls Component */}{' '}
      {/*<AvatarControls
        isVisible={true}
        onToggleVisibility={() => {}}
      />*/}
      {/* Canvas */}
      <Canvas camera={{ position: [0, 1.6, 3], fov: 50 }} style={{ background: 'transparent' }} shadows>
        <SceneContent
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          store={store}
        />
      </Canvas>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const Scene3D = memo(Scene3DComponent)
