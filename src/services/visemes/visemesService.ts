import { lipsyncConvert } from './lipsyncQueue'
import type { VisemeSequenceItem, VisemeState, VisemeTarget, WhisperData } from './visemeTypes'
import { createEmptyVisemeTarget } from './visemeTypes'
import { defaultVisemeConfig, type VisemeConfig, applyCurve } from './visemeConfig'
import { visemePerformanceMonitor } from './visemePerformance'

/**
 * Generate viseme sequence from whisper data and volume
 */
export function visemesSequence(
  _volume: VisemeState,
  whisperData: WhisperData | null,
  time: number,
  config: VisemeConfig = defaultVisemeConfig
): VisemeSequenceItem[] {
  // Input validation
  if (!whisperData) {
    console.warn('visemesSequence: No whisper data provided')
    return []
  }

  if (!whisperData.words || !whisperData.wtimes || !whisperData.wdurations) {
    console.warn('visemesSequence: Incomplete whisper data', {
      hasWords: !!whisperData.words,
      hasTimes: !!whisperData.wtimes,
      hasDurations: !!whisperData.wdurations
    })
    return []
  }

  if (whisperData.words.length === 0) {
    console.warn('visemesSequence: Empty words array')
    return []
  }

  const result = lipsyncConvert(whisperData, 'en', config)
  const sequence = result?.anim || []

  // Validate sequence items
  const validSequence = sequence.filter(item => {
    if (!item.ts || !Array.isArray(item.ts) || item.ts.length !== 3) {
      console.warn('visemesSequence: Invalid timestamp array', item)
      return false
    }
    
    if (!item.vs || Object.keys(item.vs).length === 0) {
      console.warn('visemesSequence: Empty viseme values', item)
      return false
    }
    
    return true
  })

  // Add time offset using configurable fudge factor
  for (const item of validSequence) {
    item.ts[0] += time + config.timing.fudgeFactor
    item.ts[1] += time + config.timing.fudgeFactor
    item.ts[2] += time + config.timing.fudgeFactor
  }

  console.log(`visemesSequence: Generated ${validSequence.length} valid visemes from ${whisperData.words.length} words`)
  return validSequence
}

/**
 * Update viseme targets based on current time and sequence
 */
export function visemesUpdate(volume: VisemeState, time: number, config: VisemeConfig = defaultVisemeConfig): void {
  const startTime = performance.now()
  
  // Input validation
  if (!volume || !volume.sequence) {
    console.warn('visemesUpdate: Invalid volume state')
    return
  }

  // Initialize visemes if not present
  if (!volume.targets) {
    volume.targets = createEmptyVisemeTarget()
  }

  if (!volume.dirty) {
    volume.dirty = {}
  }

  const visemes = volume.targets

  // Dampen existing visemes using configurable factor
  Object.entries(visemes).forEach(([key, value]) => {
    const visemeKey = key as keyof VisemeTarget
    visemes[visemeKey] = value > 0.01 ? value * config.intensity.dampeningFactor : 0
  })

  // Performance optimization: Only process visemes that could be active
  const activeVisemes = volume.sequence.filter(item => 
    item.ts[0] <= time && item.ts[1] >= time
  )

  let visemesProcessed = 0

  // Apply sequence items that are active at current time
  for (const item of activeVisemes) {
    const begins = item.ts[0]
    const ends = item.ts[1]

    // Apply minimum duration filter if configured
    if (config.timing.minDuration > 0) {
      const visemeDuration = ends - begins
      if (visemeDuration < config.timing.minDuration) continue
    }

    Object.entries(item.vs).forEach(([key, valueArray]) => {
      if (!valueArray || !Array.isArray(valueArray) || valueArray.length < 2) {
        console.warn('visemesUpdate: Invalid value array for viseme', key)
        return
      }

      let value = valueArray[1] // Get the peak value
      if (typeof value !== 'number' || isNaN(value)) {
        console.warn('visemesUpdate: Invalid value for viseme', key, value)
        return
      }

      // Apply configurable intensity multiplier
      value *= config.intensity.baseMultiplier

      // Apply configurable attack curve
      if (time - begins < config.timing.attackTime) {
        const attackProgress = (time - begins) / config.timing.attackTime
        value *= applyCurve(attackProgress, config.curves.attackCurve)
      }

      // Apply configurable release curve
      if (ends - time < config.timing.releaseTime) {
        const releaseProgress = (config.timing.releaseTime - (ends - time)) / config.timing.releaseTime
        value *= applyCurve(releaseProgress, config.curves.releaseCurve)
      }

      // Ensure minimum visibility threshold
      if (value < config.intensity.minThreshold) value = config.intensity.minThreshold

      const visemeKey = key as keyof VisemeTarget
      if (visemeKey in visemes) {
        visemes[visemeKey] = value
        visemesProcessed++
      } else {
        console.warn('visemesUpdate: Unknown viseme key', visemeKey)
      }
    })
  }

  const updateTime = performance.now() - startTime
  
  // Performance monitoring
  visemePerformanceMonitor.endFrame(
    visemesProcessed,
    volume.sequence.length,
    updateTime,
    0 // rigApplyTime will be set in visemesToRig
  )
}

/**
 * Apply viseme targets to the actual avatar rig
 */
export function visemesToRig(volume: VisemeState, _time: number, amplify: number = 1.0): void {
  const startTime = performance.now()
  
  if (!volume.targets) return

  // Test to reduce work
  if (!volume.dirty) volume.dirty = {}

  let targetsUpdated = 0

  Object.entries(volume.targets).forEach(([key, value]) => {
    const visemeKey = key as keyof VisemeTarget

    // Apply global fader
    if (amplify !== 1.0) {
      value = volume.targets[visemeKey] = value * amplify
    }

    // Only touch dirty targets for optimization
    if (value === volume.dirty[visemeKey]) return
    volume.dirty[visemeKey] = value
    targetsUpdated++

    // Handle VRM avatars
    if (volume.vrm) {
      try {
        volume.vrm.expressionManager.setValue(key, value)
      } catch (error) {
        console.error('visemesToRig: Error setting VRM expression', key, value, error)
      }
      return
    }

    // Handle morph target based avatars
    const group = volume.dictionary?.[key]
    if (!group || !volume.morphs) return

    volume.morphs.forEach((part) => {
      group.forEach((index) => {
        if (part.morphTargetInfluences && part.morphTargetInfluences[index] !== undefined) {
          part.morphTargetInfluences[index] = value
        }
      })
    })
  })

  const rigApplyTime = performance.now() - startTime
  
  // Log performance warnings for rig application
  if (rigApplyTime > 5) { // 5ms threshold for rig updates
    console.warn(`visemesToRig: Rig update took ${rigApplyTime.toFixed(2)}ms, updated ${targetsUpdated} targets`)
  }
}

/**
 * Initialize viseme state for an avatar
 */
export function initializeVisemeState(): VisemeState {
  return {
    targets: createEmptyVisemeTarget(),
    dirty: {},
    sequence: []
  }
}

/**
 * Set up viseme state for VRM avatar
 */
export function setupVisemeStateForVRM(
  state: VisemeState,
  vrm: { expressionManager: { setValue: (key: string, value: number) => void } }
): void {
  state.vrm = vrm
}

/**
 * Set up viseme state for morph target based avatar
 */
export function setupVisemeStateForMorphTargets(
  state: VisemeState,
  morphs: { morphTargetInfluences: number[] }[],
  dictionary: Record<string, number[]>
): void {
  state.morphs = morphs
  state.dictionary = dictionary
}
