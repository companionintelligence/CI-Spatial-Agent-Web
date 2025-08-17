import { useCallback, useMemo, useRef, useState } from 'react'

import {
  initializeVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesSequence,
  visemesToRig,
  visemesUpdate
} from './visemesService'
import type { VisemeState, WhisperData } from './visemeTypes'
import { defaultVisemeConfig, type VisemeConfig } from './visemeConfig'
import { visemePerformanceMonitor } from './visemePerformance'

export const useVisemeService = (initialConfig?: Partial<VisemeConfig>) => {
  const visemeStateRef = useRef<VisemeState>(initializeVisemeState())
  const [config, setConfig] = useState<VisemeConfig>({
    ...defaultVisemeConfig,
    ...initialConfig
  })

  const generateSequence = useCallback((whisperData: WhisperData | null, startTime: number) => {
    const sequence = visemesSequence(visemeStateRef.current, whisperData, startTime, config)
    visemeStateRef.current.sequence = sequence
    return sequence
  }, [config])

  const updateVisemes = useCallback((currentTime: number) => {
    visemesUpdate(visemeStateRef.current, currentTime, config)
  }, [config])

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

  const updateConfig = useCallback((newConfig: Partial<VisemeConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
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
  const actions = useMemo(() => ({
    generateSequence,
    updateVisemes,
    applyToRig,
    setupForVRM,
    setupForMorphTargets,
    reset,
    updateConfig,
    resetPerformance
  }), [
    generateSequence,
    updateVisemes,
    applyToRig,
    setupForVRM,
    setupForMorphTargets,
    reset,
    updateConfig,
    resetPerformance
  ])

  const getters = useMemo(() => ({
    getCurrentTargets,
    getSequence,
    getConfig,
    getPerformanceMetrics
  }), [
    getCurrentTargets,
    getSequence,
    getConfig,
    getPerformanceMetrics
  ])
  

  return useMemo(() => ({
    actions,
    getters
  }), [actions, getters])

}
