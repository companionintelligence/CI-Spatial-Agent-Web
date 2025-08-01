import { useCallback, useRef } from 'react'
import type { VisemeState, WhisperData } from './visemeTypes'
import {
  initializeVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesSequence,
  visemesToRig,
  visemesUpdate
} from './visemesService'

export const useVisemeService = () => {
  const visemeStateRef = useRef<VisemeState>(initializeVisemeState())

  const generateSequence = useCallback((whisperData: WhisperData | null, startTime: number) => {
    const sequence = visemesSequence(visemeStateRef.current, whisperData, startTime)
    visemeStateRef.current.sequence = sequence
    return sequence
  }, [])

  const updateVisemes = useCallback((currentTime: number) => {
    visemesUpdate(visemeStateRef.current, currentTime)
  }, [])

  const applyToRig = useCallback((currentTime: number, amplify: number = 1.0) => {
    visemesToRig(visemeStateRef.current, currentTime, amplify)
  }, [])

  const setupForVRM = useCallback((vrm: { expressionManager: { setValue: (key: string, value: number) => void } }) => {
    setupVisemeStateForVRM(visemeStateRef.current, vrm)
  }, [])

  const setupForMorphTargets = useCallback(
    (morphs: { morphTargetInfluences: number[] }[], dictionary: Record<string, number[]>) => {
      setupVisemeStateForMorphTargets(visemeStateRef.current, morphs, dictionary)
    },
    []
  )

  const getCurrentTargets = useCallback(() => {
    return visemeStateRef.current.targets
  }, [])

  const getSequence = useCallback(() => {
    return visemeStateRef.current.sequence
  }, [])

  const reset = useCallback(() => {
    visemeStateRef.current = initializeVisemeState()
  }, [])

  return {
    actions: {
      generateSequence,
      updateVisemes,
      applyToRig,
      setupForVRM,
      setupForMorphTargets,
      reset
    },
    getters: {
      getCurrentTargets,
      getSequence
    }
  }
}
