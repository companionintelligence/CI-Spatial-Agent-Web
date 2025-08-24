import { useGLTF } from '@react-three/drei'
import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { ANIMATION_CLIPS } from './config/animationClips'
import {
  applyPersonality,
  clearAnimationQueue,
  enqueueAnimation,
  getCurrentAnimationInfo,
  getPersonalityAnimationClips,
  initializeAnimationState,
  initializeDefaultAnimation,
  resetAnimationState,
  setAnimationEnabled,
  setupAnimationState,
  startPerformance,
  updateAnimation
} from './animationService'
import type { AnimationClip, AnimationPerformanceData, AnimationState } from './animationTypes'
import { getAvailablePersonalities } from './config/personalityConfig'

export const useAnimationService = () => {
  const animationStateRef = useRef<AnimationState>(initializeAnimationState())

  const setPersonality = useCallback((personality: string) => {
    applyPersonality(animationStateRef.current, personality)
  }, [])

  const performAction = useCallback((performanceData: AnimationPerformanceData) => {
    const startTime = performance.now()
    startPerformance(animationStateRef.current, performanceData, startTime)
  }, [])

  const reset = useCallback(() => {
    resetAnimationState(animationStateRef.current)
  }, [])

  const enableCycling = useCallback((enabled: boolean) => {
    setAnimationEnabled(animationStateRef.current, enabled)
  }, [])

  const setup = useCallback(
    (actions: Record<string, THREE.AnimationAction>, mixer: THREE.AnimationMixer, avatar?: THREE.Object3D) => {
      setupAnimationState(animationStateRef.current, actions, mixer, avatar)

      // Initialize with a default animation
      const personality = animationStateRef.current.cyclingState.currentPersonality
      initializeDefaultAnimation(animationStateRef.current, personality)
    },
    []
  )

  const update = useCallback((delta: number) => {
    updateAnimation(animationStateRef.current, delta)
  }, [])

  const getCurrentInfo = useCallback(() => {
    return getCurrentAnimationInfo(animationStateRef.current)
  }, [])

  const getAvailableClips = useCallback((): AnimationClip[] => {
    const personality = animationStateRef.current.cyclingState.currentPersonality
    return getPersonalityAnimationClips(personality)
  }, [])

  const getCurrentPersonality = useCallback((): string => {
    return animationStateRef.current.cyclingState.currentPersonality
  }, [])

  const isEnabled = useCallback((): boolean => {
    return animationStateRef.current.enabled
  }, [])

  const isTransitioning = useCallback((): boolean => {
    return animationStateRef.current.isTransitioning
  }, [])

  return useMemo(
    () => ({
      actions: {
        setPersonality,
        performAction,
        enqueue: (performanceData: AnimationPerformanceData) =>
          enqueueAnimation(animationStateRef.current, performanceData),
        clearQueue: () => clearAnimationQueue(animationStateRef.current),
        enableCycling,
        reset,
        setup,
        update
      },
      // Info methods
      getters: {
        getCurrentInfo,
        getCurrentPersonality,
        getAvailableClips,
        getAvailablePersonalities,
        isEnabled,
        isTransitioning,
        getState: () => animationStateRef.current
      }
    }),
    [
      setPersonality,
      performAction,
      enableCycling,
      reset,
      setup,
      update,
      getCurrentInfo,
      getCurrentPersonality,
      getAvailableClips,
      getAvailablePersonalities,
      isEnabled,
      isTransitioning
    ]
  )
}

// Preload animation assets
ANIMATION_CLIPS.forEach((clip) => {
  useGLTF.preload(clip.path)
})
