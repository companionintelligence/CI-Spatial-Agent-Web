import { useState, useCallback } from 'react'
import type { SceneConfig, AvatarConfig } from './sceneTypes'
import { defaultSceneConfig, defaultAvatarConfig } from './sceneTypes'

export const useSceneService = () => {
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(defaultSceneConfig)
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(defaultAvatarConfig)

  const updateSceneConfig = useCallback((config: Partial<SceneConfig>) => {
    setSceneConfig(prev => ({ ...prev, ...config }))
  }, [])

  const updateAvatarConfig = useCallback((config: Partial<AvatarConfig>) => {
    setAvatarConfig(prev => ({ ...prev, ...config }))
  }, [])

  const loadAvatar = useCallback((modelUrl: string, animationUrl?: string) => {
    setAvatarConfig(prev => ({
      ...prev,
      modelUrl,
      animationUrl
    }))
  }, [])

  const setAvatarPosition = useCallback((position: [number, number, number]) => {
    setAvatarConfig(prev => ({ ...prev, position }))
  }, [])

  const toggleAvatarVisibility = useCallback(() => {
    setAvatarConfig(prev => ({ ...prev, visible: !prev.visible }))
  }, [])

  return {
    sceneConfig,
    avatarConfig,
    actions: {
      updateSceneConfig,
      updateAvatarConfig,
      loadAvatar,
      setAvatarPosition,
      toggleAvatarVisibility
    }
  }
}
