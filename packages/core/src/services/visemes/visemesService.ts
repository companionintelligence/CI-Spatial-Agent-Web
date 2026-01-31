import type { VRM } from '@pixiv/three-vrm'

import { lipsyncConvert } from './lipsync/lipsyncQueue'
import { applyCurve, defaultVisemeConfig, type VisemeConfig } from './config/visemeConfig'
import type { VisemeSequenceItem, VisemeState, VisemeTarget, VRMVisemeTarget, WhisperData } from './visemeTypes'
import { createEmptyVisemeTarget, createEmptyVRMVisemeTarget } from './visemeTypes'

const OCULUS_TO_VRM_MAPPING: Record<keyof VisemeTarget, keyof VRMVisemeTarget> = {
  // Vowels - direct mapping where possible
  viseme_aa: 'aa', // open back vowel → aa
  viseme_E: 'ee', // mid front vowel → ee
  viseme_I: 'ee', // close front vowel → ee
  viseme_O: 'oh', // mid back vowel → oh
  viseme_U: 'ou', // close back vowel → ou

  // Consonants - map to closest vowel shape
  viseme_PP: 'ou', // bilabial (closed lips) → ou (rounded)
  viseme_FF: 'ee', // labiodental → ee (spread lips)
  viseme_TH: 'aa', // dental → aa (open)
  viseme_DD: 'aa', // alveolar → aa (open)
  viseme_kk: 'ih', // velar → ih (mid position)
  viseme_CH: 'ee', // palato-alveolar → ee
  viseme_SS: 'ee', // alveolar fricative → ee (spread)
  viseme_nn: 'ih', // nasal → ih (neutral)
  viseme_RR: 'aa' // trill → aa (open)
}

export function convertToVRMTarget(oculusTarget: VisemeTarget): VRMVisemeTarget {
  const vrmTarget: VRMVisemeTarget = createEmptyVRMVisemeTarget()

  Object.entries(oculusTarget).forEach(([key, value]) => {
    const oculusKey = key as keyof VisemeTarget
    const vrmKey = OCULUS_TO_VRM_MAPPING[oculusKey]

    if (vrmKey && value > 0) {
      // Use max value when multiple Oculus visemes map to same VRM viseme
      vrmTarget[vrmKey] = Math.max(vrmTarget[vrmKey], value)
    }
  })

  return vrmTarget
}

/**
 * Generate viseme sequence from whisper data and volume
 */
export function visemesSequence(
  _volume: VisemeState,
  whisperData: WhisperData | null,
  config: VisemeConfig = defaultVisemeConfig
): VisemeSequenceItem[] {
  const time = performance.now()
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
  const validSequence = sequence.filter((item) => {
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
export function visemesUpdate(volume: VisemeState, _delta: number, config: VisemeConfig = defaultVisemeConfig): void {
  const startTime = performance.now()

  if (!volume || !volume.sequence) {
    console.warn('visemesUpdate: Invalid volume state')
    return
  }

  // Initialize targets based on system type
  if (!volume.targets) {
    volume.targets = volume.isVRMMode ? createEmptyVRMVisemeTarget() : createEmptyVisemeTarget()
  }

  if (!volume.dirty) {
    volume.dirty = {}
  }
  // Apply dampening
  Object.entries(volume.targets).forEach(([key, value]) => {
    ;(volume.targets as any)[key] = value > 0.01 ? value * config.intensity.dampeningFactor : 0
  })

  // Process active visemes
  const activeVisemes = volume.sequence.filter((item) => item.ts[0] <= startTime && item.ts[1] >= startTime)

  let visemesProcessed = 0

  for (const item of activeVisemes) {
    const begins = item.ts[0]
    const ends = item.ts[1]

    if (config.timing.minDuration > 0) {
      const visemeDuration = ends - begins
      if (visemeDuration < config.timing.minDuration) continue
    }

    Object.entries(item.vs).forEach(([key, valueArray]) => {
      if (!valueArray || !Array.isArray(valueArray) || valueArray.length < 2) {
        console.warn('visemesUpdate: Invalid value array for viseme', key)
        return
      }

      let value = valueArray[1]
      if (typeof value !== 'number' || isNaN(value)) {
        console.warn('visemesUpdate: Invalid value for viseme', key, value)
        return
      }

      value *= config.intensity.baseMultiplier

      // Apply curves
      if (startTime - begins < config.timing.attackTime) {
        const attackProgress = (startTime - begins) / config.timing.attackTime
        value *= applyCurve(attackProgress, config.curves.attackCurve)
      }

      if (ends - startTime < config.timing.releaseTime) {
        const releaseProgress = (config.timing.releaseTime - (ends - startTime)) / config.timing.releaseTime
        value *= applyCurve(releaseProgress, config.curves.releaseCurve)
      }

      if (value < config.intensity.minThreshold) value = config.intensity.minThreshold

      // Apply to appropriate target system

      const mappedKey = volume.isVRMMode ? OCULUS_TO_VRM_MAPPING[key as keyof typeof OCULUS_TO_VRM_MAPPING] : key
      if (mappedKey && mappedKey in volume.targets) {
        ;(volume.targets as any)[mappedKey] = value
        visemesProcessed++
      }
    })
  }

}
/**
 * Apply viseme targets to the actual avatar rig
 */
export function visemesToRig(volume: VisemeState, _delta: number, amplify: number = 1.0): void {
  const startTime = performance.now()

  if (!volume.targets) return
  if (!volume.dirty) volume.dirty = {}

  let targetsUpdated = 0
  // Handle VRM avatars
  if (volume.vrm) {
    let targetToApply: VRMVisemeTarget

    if (volume.isVRMMode) {
      // Direct VRM mode - targets are already VRM format
      targetToApply = volume.targets as VRMVisemeTarget
    } else {
      // GLB mode - convert 14 visemes to 5 VRM visemes
      targetToApply = convertToVRMTarget(volume.targets as VisemeTarget)
    }

    Object.entries(targetToApply).forEach(([key, value]) => {
      if (amplify !== 1.0) {
        value = value * amplify
      }

      if (value === (volume.dirty as any)[key]) return
      ;(volume.dirty as any)[key] = value
      targetsUpdated++

      try {
        volume.vrm!.expressionManager!.setValue(key, value)
      } catch (error) {
        console.error('visemesToRig: Error setting VRM expression', key, value, error)
      }
    })

    const rigApplyTime = performance.now() - startTime
    if (rigApplyTime > 5) {
      console.warn(`visemesToRig: VRM update took ${rigApplyTime.toFixed(2)}ms, updated ${targetsUpdated} targets`)
    }
    return
  }

  // Handle GLB morph target avatars (original system)
  Object.entries(volume.targets).forEach(([key, value]) => {
    if (amplify !== 1.0) {
      value = (volume.targets as any)[key] = value * amplify
    }

    if (value === (volume.dirty as any)[key]) return
    ;(volume.dirty as any)[key] = value
    targetsUpdated++

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
  if (rigApplyTime > 5) {
    console.warn(`visemesToRig: GLB update took ${rigApplyTime.toFixed(2)}ms, updated ${targetsUpdated} targets`)
  }
}

/**
 * Initialize viseme state for an avatar
 */
export function initializeVisemeState(forVRM: boolean = false): VisemeState {
  return {
    targets: forVRM ? createEmptyVRMVisemeTarget() : createEmptyVisemeTarget(),
    dirty: {},
    sequence: [],
    isVRMMode: forVRM
  }
}

/**
 * Set up viseme state for VRM avatar
 */
export function setupVisemeStateForVRM(state: VisemeState, vrm: VRM): void {
  state.vrm = vrm

  // Auto-detect if this VRM supports only 5 mouth expressions
  try {
    const expressions = Object.keys(vrm.expressionManager?.expressionMap || {})
    const vrmMouthExpressions = ['aa', 'ee', 'ih', 'oh', 'ou']
    const hasVRMMouthExpressions = vrmMouthExpressions.every((exp) => expressions.includes(exp))
    const hasOculusVisemes = ['PP', 'FF', 'TH'].some((exp) => expressions.includes(exp))

    if (hasVRMMouthExpressions && !hasOculusVisemes) {
      // This VRM only supports 5 mouth expressions - switch to VRM mode
      state.isVRMMode = true
      state.targets = createEmptyVRMVisemeTarget()
      state.dirty = {}
      console.log('VRM detected: Using 5-expression mode (aa, ee, ih, oh, ou)')
    } else {
      // This VRM supports full visemes - keep GLB mode
      state.isVRMMode = false
      console.log('VRM detected: Using 14-viseme mode (full Oculus set)')
    }

    console.log('VRM Available expressions:', expressions)
  } catch (error) {
    console.warn('Could not detect VRM expression capabilities, defaulting to GLB mode')
    state.isVRMMode = false
  }
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
  state.isVRMMode = false // GLB mode
}
