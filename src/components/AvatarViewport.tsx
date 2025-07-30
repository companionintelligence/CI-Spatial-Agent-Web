import { Scene3D } from './Scene3D'
import type { SceneConfig, AvatarConfig } from '../services/sceneTypes'

interface AvatarViewportProps {
  sceneConfig: SceneConfig
  avatarConfig: AvatarConfig
}

export const AvatarViewport = ({ sceneConfig, avatarConfig }: AvatarViewportProps) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#095D72',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#2A2A2A',
          position: 'relative'
        }}
      >
        <Scene3D sceneConfig={sceneConfig} avatarConfig={avatarConfig} />
      </div>
    </div>
  )
}
