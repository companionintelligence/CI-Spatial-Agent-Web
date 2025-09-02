import type { XRStore } from '@react-three/xr'
import { memo, useState } from 'react'

import type { SceneConfig } from '../app/sceneTypes'
import type { useAnimationService } from '../services/animation/useAnimationService'
import type { useEmoteService } from '../services/emote/useEmoteService'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import type { SceneLocation } from '../services/webxr/sceneUnderstanding'
import { Scene3D } from '../scene/Scene3D'
import { WebXRSceneControls } from './webxr/WebXRSceneControls'

interface AvatarViewportProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  setXRStore?: (store: XRStore) => void
  enableSceneUnderstanding?: boolean
}

const AvatarViewportComponent = ({
  sceneConfig,
  visemeService,
  emoteService,
  animationService,
  setXRStore,
  enableSceneUnderstanding = true
}: AvatarViewportProps) => {
  const [xrStore, setXRStoreLocal] = useState<XRStore | null>(null)

  const handleXRStoreChange = (store: XRStore) => {
    setXRStoreLocal(store)
    if (setXRStore) {
      setXRStore(store)
    }
  }

  const handleLocationSelected = (location: SceneLocation) => {
    console.log('Selected location:', location)
    // Could add highlighting or camera movement here
  }

  console.log('viewport rerender')
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
        boxShadow: '0 2px 4px rgba(0,0,0,0.07)',
        position: 'relative'
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
          setXRStore={handleXRStoreChange}
          enableSceneUnderstanding={enableSceneUnderstanding}
        />
        
        {/* WebXR Scene Understanding Controls */}
        {enableSceneUnderstanding && (
          <WebXRSceneControls
            xrStore={xrStore}
            onLocationSelected={handleLocationSelected}
          />
        )}
      </div>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const AvatarViewport = memo(AvatarViewportComponent)
