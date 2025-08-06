import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { createXRStore, XR, type XRStore } from '@react-three/xr'
import { useEffect, } from 'react'
import { AvatarControls } from '../components/AvatarControls'
import type { useEmoteService } from '../services/emote/useEmoteService'
import type { SceneConfig } from '../services/sceneTypes'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import { AvatarModel } from './AvatarModel'
import { useSimpleStore } from '../utils/SimpleStore'

interface Scene3DProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  setXRStore?: (store: XRStore) => void
}

const SceneContent = ({ sceneConfig, visemeService, emoteService, store }: Scene3DProps & { store: XRStore }) => {
  return (
    <XR store={store}>
      {/* Camera setup */}
      <OrbitControls
        target={sceneConfig.cameraTarget}
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
      <AvatarModel visemeService={visemeService} emoteService={emoteService} />

      {/* Ground plane */}
      {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh> */}
    </XR>
  )
}

export const Scene3D = ({ sceneConfig, visemeService, emoteService, setXRStore }: Scene3DProps) => {
  const store = createXRStore()
  const [isControlsVisible, setIsControlsVisible] = useSimpleStore(() => true)

  useEffect(() => {
    if (setXRStore) {
      setXRStore(store)
    }
  }, [setXRStore, store])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Avatar Controls Component */}{' '}
      <AvatarControls
        isVisible={isControlsVisible}
        onToggleVisibility={() => setIsControlsVisible(!isControlsVisible)}
      />
      {/* Canvas */}
      <Canvas camera={{ position: [0, 1.6, 3], fov: 50 }} style={{ background: 'transparent' }} shadows>
        <SceneContent
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          store={store}
        />
      </Canvas>
    </div>
  )
}
