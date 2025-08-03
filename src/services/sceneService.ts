import { useCallback, useState } from 'react'
import type { SceneConfig } from './sceneTypes'
import { defaultSceneConfig } from './sceneTypes'

export const useSceneService = () => {
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(defaultSceneConfig)

  const updateSceneConfig = useCallback((config: Partial<SceneConfig>) => {
    setSceneConfig((prev) => ({ ...prev, ...config }))
  }, [])

  return {
    sceneConfig,
    actions: {
      updateSceneConfig
    }
  }
}
