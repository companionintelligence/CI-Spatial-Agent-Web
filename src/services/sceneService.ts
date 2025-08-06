import { useCallback, } from 'react'
import type { SceneConfig } from './sceneTypes'
import { defaultSceneConfig } from './sceneTypes'
import { useSimpleStore } from '../utils/SimpleStore'

export const useSceneService = () => {
  const [sceneConfig, setSceneConfig] = useSimpleStore<SceneConfig>(() => defaultSceneConfig)

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
