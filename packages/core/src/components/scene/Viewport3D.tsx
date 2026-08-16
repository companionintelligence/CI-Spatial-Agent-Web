import type { XRStore } from '@react-three/xr'
import { memo } from 'react'

import type { SceneConfig } from './sceneTypes'
import type { useAnimationService } from '../../services/animation/useAnimationService'
import type { useEmoteService } from '../../services/emote/useEmoteService'
import type { useVisemeService } from '../../services/visemes/useVisemeService'
import type { useTTSService } from '../../services/tts/ttsService'
import { Scene3D, type SceneActions } from './Scene3D'

interface viewport3DProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  ttsService?: ReturnType<typeof useTTSService>
  setXRStore?: (store: XRStore) => void
  onSceneActionsReady?: (actions: SceneActions) => void
  webGPUEnabled: boolean
}

const viewport3DComponent = ({
  sceneConfig,
  visemeService,
  emoteService,
  animationService,
  ttsService,
  setXRStore,
  onSceneActionsReady,
  webGPUEnabled
}: viewport3DProps) => {
  console.log('viewport rerender')
  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, var(--background) 0%, var(--card) 100%)',
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
          backgroundColor: 'var(--card)',
          position: 'relative'
        }}
      >
        <Scene3D
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          ttsService={ttsService}
          setXRStore={setXRStore}
          onSceneActionsReady={onSceneActionsReady}
          webGPUEnabled={webGPUEnabled}
        />
      </div>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const Viewport3D = memo(viewport3DComponent)
