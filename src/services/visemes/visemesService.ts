import { lipsyncConvert } from './lipsyncQueue'
import type { VisemeSequenceItem, VisemeState, VisemeTarget, WhisperData } from './visemeTypes'
import { createEmptyVisemeTarget } from './visemeTypes'

/**
 * Generate viseme sequence from whisper data and volume
 */
export function visemesSequence(
  _volume: VisemeState,
  whisperData: WhisperData | null,
  time: number
): VisemeSequenceItem[] {
  if (!whisperData) {
    console.warn('visemes - no whisper data')
    return []
  }

  const result = lipsyncConvert(whisperData, 'en')
  const sequence = result?.anim || []

  // Add time offset with fudge factor from original implementation
  for (const item of sequence) {
    item.ts[0] += time + 150
    item.ts[1] += time + 150
    item.ts[2] += time + 150
  }

  return sequence
}

/**
 * Update viseme targets based on current time and sequence
 */
export function visemesUpdate(volume: VisemeState, time: number): void {
  const attack = 50
  const release = 60

  // Initialize visemes if not present
  if (!volume.targets) {
    volume.targets = createEmptyVisemeTarget()
  }

  if (!volume.dirty) {
    volume.dirty = {}
  }

  const visemes = volume.targets

  // Dampen existing visemes
  Object.entries(visemes).forEach(([key, value]) => {
    const visemeKey = key as keyof VisemeTarget
    visemes[visemeKey] = value > 0.01 ? value * 0.85 : 0
  })

  // Apply sequence items that are active at current time
  for (const item of volume.sequence) {
    const begins = item.ts[0]
    const ends = item.ts[1]

    if (begins > time || ends < time) continue

    Object.entries(item.vs).forEach(([key, valueArray]) => {
      if (!valueArray) return

      let value = valueArray[1] // Get the peak value

      // Apply attack curve
      if (time - begins < attack) {
        value *= Math.pow((time - begins) / attack, 3)
      }

      // Apply release curve
      if (ends - time < release) {
        value *= Math.pow((release - (ends - time)) / release, 3)
      }

      const visemeKey = key as keyof VisemeTarget
      if (visemeKey in visemes) {
        visemes[visemeKey] = value
        if (VISEMES_DEBUG) {
          console.log(`Viseme ${visemeKey} updated to ${value.toFixed(3)} at time ${time}`)
        }
      }
    })
  }
}

/**
 * Apply viseme targets to the actual avatar rig
 */
export function visemesToRig(volume: VisemeState, _time: number, amplify: number = 1.0): void {
  if (!volume.targets) return

  // Test to reduce work
  if (!volume.dirty) volume.dirty = {}

  Object.entries(volume.targets).forEach(([key, value]) => {
    const visemeKey = key as keyof VisemeTarget

    // Apply global fader
    if (amplify !== 1.0) {
      value = volume.targets[visemeKey] = value * amplify
    }

    // Only touch dirty targets for optimization
    if (value === volume.dirty[visemeKey]) return
    volume.dirty[visemeKey] = value

    // Handle VRM avatars
    if (volume.vrm) {
      volume.vrm.expressionManager.setValue(key, value)
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
