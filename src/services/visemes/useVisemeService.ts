import type { VRM } from '@pixiv/three-vrm'
import { useCallback, useMemo, useRef, useState } from 'react'

import { defaultVisemeConfig, type VisemeConfig } from './config/visemeConfig'
import { visemePerformanceMonitor } from './debug/visemePerformance'
import {
  initializeVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesSequence,
  visemesToRig,
  visemesUpdate
} from './visemesService'
import type { VisemeState, WhisperData } from './visemeTypes'

export const useVisemeService = (initialConfig?: Partial<VisemeConfig>) => {
  const visemeStateRef = useRef<VisemeState>(initializeVisemeState(false)) // Default to GLB mode
  const [config, setConfig] = useState<VisemeConfig>({
    ...defaultVisemeConfig,
    ...initialConfig
  })

  const generateSequence = useCallback(
    (whisperData: WhisperData | null) => {
      const sequence = visemesSequence(visemeStateRef.current, whisperData, config)
      visemeStateRef.current.sequence = sequence
      return sequence
    },
    [config]
  )

  const update = useCallback(
    (delta: number) => {
      visemesUpdate(visemeStateRef.current, delta, config)
    },
    [config]
  )

  const applyToRig = useCallback((delta: number, amplify: number = 1.0) => {
    visemesToRig(visemeStateRef.current, delta, amplify)
  }, [])

  const setupForVRM = useCallback((vrm: VRM) => {
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

  const updateConfig = useCallback((newConfig: Partial<VisemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }))
  }, [])

  const getConfig = useCallback(() => {
    return config
  }, [config])

  const getPerformanceMetrics = useCallback(() => {
    return {
      average: visemePerformanceMonitor.getAverageMetrics(),
      latest: visemePerformanceMonitor.getLatestMetrics()
    }
  }, [])

  const resetPerformance = useCallback(() => {
    visemePerformanceMonitor.reset()
  }, [])

  // Viseme service actions and getters (for this service, not emote)
  const actions = useMemo(
    () => ({
      update,
      reset,
      generateSequence,
      setupForVRM,
      setupForMorphTargets,
      applyToRig,
      updateConfig  
    }),
    [generateSequence, update, applyToRig, setupForVRM, setupForMorphTargets, reset, updateConfig]
  )

  const getters = useMemo(
    () => ({
      getCurrentTargets,
      getSequence,
      getConfig,
      getState: () => visemeStateRef.current
    }),
    [getCurrentTargets, getSequence, getConfig]
  )

  const debug = useMemo(() => ({
    getPerformanceMetrics,
    resetPerformance
  }),[getPerformanceMetrics, resetPerformance])

  return useMemo(
    () => ({
      actions,
      getters,
      debug
    }),
    [actions, getters , debug]
  )
}
