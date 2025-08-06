import { useCallback, useRef } from 'react'
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

  const setupForVRM = useCallback((vrm: { expressionManager: { setValue: (key: string, value: number) => void } }) => {
    setupEmoteStateForVRM(emoteStateRef.current, vrm)
  }, [])

  const setupForMorphTargets = useCallback(
    (morphs: { morphTargetInfluences: number[] }[], dictionary: Record<string, number[]>) => {
      setupEmoteStateForMorphTargets(emoteStateRef.current, morphs, dictionary)
    },
    []
  )

  const applyToVRM = useCallback((vrm: { expressionManager: { setValue: (key: string, value: number) => void } }) => {
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
    (references: { bones?: Record<string, unknown>; node?: unknown; scene?: { camera: unknown } }) => {
      const state = emoteStateRef.current
      if (references.bones) state.bones = references.bones as EmoteState['bones']
      if (references.node) state.node = references.node as EmoteState['node']
      if (references.scene) state.scene = references.scene as EmoteState['scene']
    },
    []
  )

  return {
    // Core emotion controls
    setEmotion,
    performAction,
    triggerGaze,
    reset,
    onBargeIn,

    // Update loop
    update,

    // Setup and integration
    setupForVRM,
    setupForMorphTargets,
    setAvatarReferences,

    // Application
    applyToVRM,
    applyToMorphTargets,

    // State access
    getCurrentTargets,
    getCurrentEmotion,
    isPerforming,

    // Direct state access (for advanced use cases)
    getState: () => emoteStateRef.current
  }
}
