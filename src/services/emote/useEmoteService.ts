import { useCallback, useMemo, useRef } from 'react'

import {
  applyEmoteStateToMorphTargets,
  applyEmoteStateToVRM,
  applyEmotion,
  handleBargeIn,
  initializeEmoteState,
  initiateGaze,
  resetEmoteState,
  setupEmoteStateForMorphTargets,
  setupEmoteStateForVRM,
  startPerformance,
  updateEmoteState
} from './emoteService'
import type { EmoteState, EmotionType, FacialTarget, GazeOptions, PerformanceData } from './emoteTypes'
import type { VRM } from '@pixiv/three-vrm'
import type { Camera, Object3D } from 'three'

export const useEmoteService = () => {
  const emoteStateRef = useRef<EmoteState>(initializeEmoteState())

  const setEmotion = useCallback((emotion: EmotionType) => {
    applyEmotion(emoteStateRef.current, emotion)
  }, [])

  const performAction = useCallback((performanceData: PerformanceData) => {
    const startTime = performance.now()
    startPerformance(emoteStateRef.current, performanceData, startTime)
  }, [])

  const triggerGaze = useCallback((options?: GazeOptions) => {
    initiateGaze(emoteStateRef.current, options)
  }, [])

  const update = useCallback((currentTime: number = performance.now()) => {
    updateEmoteState(emoteStateRef.current, currentTime)
  }, [])

  const reset = useCallback(() => {
    resetEmoteState(emoteStateRef.current)
  }, [])

  const onBargeIn = useCallback(() => {
    handleBargeIn(emoteStateRef.current)
  }, [])

  const setupForVRM = useCallback((vrm:VRM) => {
    setupEmoteStateForVRM(emoteStateRef.current, vrm)
  }, [])

  const setupForMorphTargets = useCallback(
    (morphs: { morphTargetInfluences: number[] }[], dictionary: Record<string, number[]>) => {
      setupEmoteStateForMorphTargets(emoteStateRef.current, morphs, dictionary)
    },
    []
  )

  const applyToVRM = useCallback((vrm: VRM ) => {
    applyEmoteStateToVRM(emoteStateRef.current, vrm)
  }, [])

  const applyToMorphTargets = useCallback(
    (morphs: { morphTargetInfluences: number[] }[], dictionary: Record<string, number[]>) => {
      applyEmoteStateToMorphTargets(emoteStateRef.current, morphs, dictionary)
    },
    []
  )

  const getCurrentTargets = useCallback((): Partial<FacialTarget> => {
    return emoteStateRef.current.targets
  }, [])

  const getCurrentEmotion = useCallback((): EmotionType => {
    return emoteStateRef.current.currentEmotion
  }, [])

  const isPerforming = useCallback((): boolean => {
    return emoteStateRef.current.isPerforming
  }, [])

  const setAvatarReferences = useCallback(
    (references: { bones?: Record<string, unknown>; node?: Object3D;  camera: Camera } ) => {
      console.log("SETUP avatar references")
      const state = emoteStateRef.current
      if (references.bones) state.bones = references.bones as EmoteState['bones']
      if (references.node) state.node = references.node as EmoteState['node']
      if (references.camera) state.camera = references.camera as EmoteState['camera']
    },
    []
  )

  const actions = useMemo(() => ({
    setEmotion,
    performAction,
    triggerGaze,
    reset,
    onBargeIn,
    update,
    setupForVRM,
    setupForMorphTargets,
    setAvatarReferences,
    applyToVRM,
    applyToMorphTargets
  }), [setEmotion, performAction, triggerGaze, reset, onBargeIn, update, setupForVRM, setupForMorphTargets, setAvatarReferences, applyToVRM, applyToMorphTargets])
  
  const getters = useMemo(() => ({
    getCurrentTargets,
    getCurrentEmotion,
    isPerforming,
    getState: () => emoteStateRef.current
  }), [getCurrentTargets, getCurrentEmotion, isPerforming])


  return useMemo(() => ({
    actions,
    getters
  }), [actions, getters])

}
