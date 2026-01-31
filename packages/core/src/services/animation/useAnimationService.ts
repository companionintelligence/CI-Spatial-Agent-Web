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
    (actions: Record<string, THREE.AnimationAction>, mixer: THREE.AnimationMixer, avatar?: THREE.Object3D , animation?: AnimationClip) => {
      setupAnimationState(animationStateRef.current, actions, mixer, avatar)

      // Initialize with a default animation
      const personality = animationStateRef.current.currentPersonality
      initializeDefaultAnimation(animationStateRef.current, personality, animation)
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
    const personality = animationStateRef.current.currentPersonality
    return getPersonalityAnimationClips(personality)
  }, [])

  const actions = useMemo(
    () => ({
      setPersonality,
      performAction,
      enqueue: (performanceData: AnimationPerformanceData) =>
        enqueueAnimation(animationStateRef.current, performanceData),
      clearQueue: () => clearAnimationQueue(animationStateRef.current),
      enableCycling,
      reset,
      setup,
      update,
      getCurrentInfo,
      getAvailableClips,
    }),
    [setPersonality, performAction, enqueueAnimation, clearAnimationQueue, enableCycling, reset, setup, update, getCurrentInfo, getAvailableClips]
  )

  const state = useMemo(
    () => animationStateRef.current
    ,
    [animationStateRef.current]
  )

  return useMemo(
    () => ({
      actions,
      state
    }),
    [actions, state]
  )
}

// Preload animation assets
Object.values(ANIMATION_CLIPS).forEach((clip) => {
  useGLTF.preload(clip.path)
})
