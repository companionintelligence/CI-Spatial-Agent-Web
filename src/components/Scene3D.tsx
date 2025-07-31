import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { AvatarConfig, SceneConfig } from '../services/sceneTypes'
import { AvatarModel } from './AvatarModel'
import { SimpleAvatar } from './SimpleAvatar'

interface Scene3DProps {
  sceneConfig: SceneConfig
  avatarConfig: AvatarConfig
}

const SceneContent = ({ sceneConfig, avatarConfig }: Scene3DProps) => {
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
      <AvatarModel
        modelUrl={avatarConfig.modelUrl}
        animationUrl={avatarConfig.animationUrl}
        position={avatarConfig.position}
        visible={avatarConfig.visible}
      />

      {/* Simple avatar test (positioned to the side) */}
      <SimpleAvatar position={[2, 0, 0]} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
    </>
  )
}

export const Scene3D = ({ sceneConfig, avatarConfig }: Scene3DProps) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
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
        <SceneContent sceneConfig={sceneConfig} avatarConfig={avatarConfig} />
      </Canvas>
    </div>
  )
}
