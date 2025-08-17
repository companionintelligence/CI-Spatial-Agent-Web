import type { XRStore } from '@react-three/xr'
import { memo } from 'react'

import type { useEmoteService } from '../services/emote/useEmoteService'
import type { SceneConfig } from '../app/sceneTypes'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import { Scene3D } from '../xr/Scene3D'
import type { useAnimationService } from '../services/animation/useAnimationService'

interface AvatarViewportProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  setXRStore?: (store: XRStore) => void
}

const AvatarViewportComponent = ({ sceneConfig, visemeService, emoteService, animationService, setXRStore }: AvatarViewportProps) => {
  console.log("viewport rerender")
  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0C1418 0%, #17252A 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1B1E20',
          position: 'relative'
        }}
      >
        <Scene3D
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          setXRStore={setXRStore}
        />
      </div>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const AvatarViewport = memo(AvatarViewportComponent)
