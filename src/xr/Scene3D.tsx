import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { SceneConfig } from '../services/sceneTypes'
import { useSimpleStore } from '../utils/SimpleStore'
import { AvatarModel, AvatarState } from './AvatarModel'
import { AnimationOptions, AvatarOptions } from './AvatarOptions'

interface Scene3DProps {
  sceneConfig: SceneConfig
}

const SceneContent = ({ sceneConfig }: Scene3DProps) => {
  return (
    <>
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
      <AvatarModel />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
    </>
  )
}

export const Scene3D = ({ sceneConfig }: Scene3DProps) => {
  const [state, setState] = useSimpleStore(AvatarState)

  const handleAvatarChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState((state) => {
      state.selectedModel = event.target.value
      return state
    })
  }

  const handleAnimationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState((state) => {
      state.selectedAnimation = event.target.value
      return state
    })
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Controls overlay */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          display: 'flex',
          gap: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '5px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>Avatar:</label>
          <select
            value={state.selectedModel}
            onChange={handleAvatarChange}
            style={{
              padding: '5px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'white',
              minWidth: '150px'
            }}
          >
            {AvatarOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>Animation:</label>
          <select
            value={state.selectedAnimation}
            onChange={handleAnimationChange}
            style={{
              padding: '5px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'white',
              minWidth: '150px'
            }}
          >
            {AnimationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Canvas
        camera={{
          position: sceneConfig.cameraPosition,
          near: sceneConfig.near,
          far: sceneConfig.far,
          fov: 50
        }}
        shadows
        style={{ background: `#${sceneConfig.background?.toString(16).padStart(6, '0') || '1a1a1a'}` }}
      >
        <SceneContent sceneConfig={sceneConfig} />
      </Canvas>
    </div>
  )
}
