import * as THREE from 'three'

import { ANIMATION_CLIPS } from './config/animationClips'
import type { AnimationCategory, AnimationClip, AnimationPerformanceData, AnimationState } from './animationTypes'
import { getPersonalityConfiguration } from './config/personalityConfig'

// --------------------- State Management ---------------------
export function initializeAnimationState(): AnimationState {
  return {
    currentClip: null,
    nextClip: null,
    transitionProgress: 0,
    transitionDuration: 0,
    isTransitioning: false,
    lastChangeTime: 0,

    enabled: true,
    currentPersonality: 'professional',
    cyclingState: {
      nextCycleTime: 0,
      isActive: true,
      lastCategory: 'idle',
      cycleInterval: 10000,
      randomizeInterval: false,
      cyclingEnabled: false
    },

    cachedClips: [],
    queue: [],

    mixer: undefined,
    actions: undefined,
    avatar: undefined
  }
}

export function resetAnimationState(state: AnimationState) {
  state.currentClip = null
  state.nextClip = null
  state.transitionProgress = 0
  state.isTransitioning = false
  state.lastChangeTime = 0
  state.cyclingState.nextCycleTime = 0
  state.cachedClips = []
}

// --------------------- Personality ---------------------
export function applyPersonality(state: AnimationState, personality: string) {
  state.currentPersonality = personality
  const config = getPersonalityConfiguration(personality)
  state.cyclingState.cycleInterval = config.defaultCycleInterval
  state.cachedClips = getPersonalityAnimationClips(personality)
}

export function getPersonalityAnimationClips(personality: string): AnimationClip[] {
  const config = getPersonalityConfiguration(personality)
  return Object.values(ANIMATION_CLIPS).filter((clip) => config.categories.includes(clip.category))
}

// --------------------- Setup ---------------------
export function setupAnimationState(
  state: AnimationState,
  actions: Record<string, THREE.AnimationAction>,
  mixer: THREE.AnimationMixer,
  avatar?: THREE.Object3D
) {
  state.actions = actions
  state.mixer = mixer
  state.avatar = avatar
}

export function initializeDefaultAnimation(state: AnimationState, personality: string, animation?: AnimationClip) {
  if (!state.actions) return
  if (!state.cachedClips.length) {
    state.cachedClips = getPersonalityAnimationClips(personality)
  }
  const firstClip = animation ?? pickNextClip(state)
  //const firstClip = ANIMATION_CLIPS[0]
  if (firstClip) {
    playClip(state, firstClip, 0) // no blend for first clip
    state.lastChangeTime = performance.now()
    state.cyclingState.nextCycleTime = state.lastChangeTime + state.cyclingState.cycleInterval
  }
}

// --------------------- Playback ---------------------
export function setAnimationEnabled(state: AnimationState, enabled: boolean) {
  state.enabled = enabled
}

export function startPerformance(state: AnimationState, performanceData: AnimationPerformanceData, _startTime: number) {
  if (!state.actions) return

  // Find the corresponding configured clip
  const configuredClip = performanceData.clip
  if (!configuredClip) {
    // Fallback: if clip is unknown, attempt to play the raw action directly
    const action = state.actions[performanceData.clip.name]
    if (!action) return

    action.reset()
    action.setLoop(
      performanceData.loopCount === Infinity ? THREE.LoopRepeat : THREE.LoopOnce,
      performanceData.loopCount ?? 1
    )
    action.clampWhenFinished = true
    action.timeScale = performanceData.speed ?? 1.0

    const blendMs = performanceData.blendTime ?? 500
    const blendSeconds = Math.max(0, blendMs) / 1000
    if (blendSeconds > 0) {
      action.setEffectiveWeight(0.0)
      action.fadeIn(blendSeconds)
      action.play()
    } else {
      action.setEffectiveWeight(1.0)
      action.play()
    }
    return
  }

  // Create a runtime clip instance that respects performance overrides
  const runtimeClip = {
    ...configuredClip,
    loopCount: performanceData.loopCount ?? configuredClip.loopCount ?? 1,
    speed: performanceData.speed ?? configuredClip.speed ?? 1
  }

  // Determine blend time (ms). Prefer explicit performance override, then clip default, then personality default
  const personalityBlend = getPersonalityConfiguration(state.currentPersonality).blendTime
  const blendMs = performanceData.blendTime ?? configuredClip.blendTime ?? personalityBlend ?? 500


  // If immediate is requested and we are not transitioning, play now; otherwise queue it
  if (performanceData.immediate && !state.isTransitioning) {
    playClip(state, runtimeClip, blendMs)
    state.lastChangeTime = performance.now()
  } else {
    if (!state.queue) state.queue = []
    state.queue.push({ clip: runtimeClip, blendTime: blendMs })
  }
}

// --------------------- Main Update Loop ---------------------
export function updateAnimation(state: AnimationState, delta: number) {
  if (!state.enabled || !state.mixer) return

  state.mixer.update(delta)

  const now = performance.now()

  // Handle weight-based transitions
  if (state.isTransitioning && state.nextClip && state.currentClip && state.actions) {
    state.transitionProgress += delta * 1000 // Convert delta to milliseconds
    const progress = Math.min(state.transitionProgress / state.transitionDuration, 1.0)

    // Apply easing curve based on blend curve
    function applyEasing(progress: number, blendCurve?: string): number {
      switch (blendCurve) {
        case 'easeIn':
          return progress * progress
        case 'easeOut':
          return progress * (2 - progress)
        case 'easeInOut':
          return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress
        case 'bounce':
          // Simple bounce approximation
          if (progress < 1 / 2.75) {
            return 7.5625 * progress * progress
          } else if (progress < 2 / 2.75) {
            return 7.5625 * (progress -= 1.5 / 2.75) * progress + 0.75
          } else if (progress < 2.5 / 2.75) {
            return 7.5625 * (progress -= 2.25 / 2.75) * progress + 0.9375
          } else {
            return 7.5625 * (progress -= 2.625 / 2.75) * progress + 0.984375
          }
        case 'linear':
        default:
          return progress
      }
    }

    const blendCurve = state.nextClip?.blendCurve || 'linear'
    const easedProgress = applyEasing(progress, blendCurve)

    const currentAction = state.actions[state.currentClip.name]
    const nextAction = state.actions[state.nextClip.name]

    if (currentAction && nextAction) {
      // Blend weights: current fades out, next fades in
      currentAction.setEffectiveWeight(1.0 - easedProgress)
      nextAction.setEffectiveWeight(easedProgress)
    }
    // Transition complete
    if (progress >= 1.0) {
      state.isTransitioning = false
      if (currentAction) {
        currentAction.setEffectiveWeight(0.0)
      }
      if (nextAction) {
        nextAction.setEffectiveWeight(1.0)
      }
      state.currentClip = state.nextClip
      state.nextClip = null
      state.transitionProgress = 0
    }
  }

  // Check if current clip finished early (loopCount based) → start next immediately
  // Early finish: If not transitioning, current clip exists, and its action is active

  if (state.isTransitioning || !state.currentClip) return

  const elapsed = (now - state.lastChangeTime)
  if (Number.isFinite(state.currentClip.loopCount ?? Infinity)) {
    const loops = state.currentClip.loopCount ?? 1
    const effectiveDuration = state.currentClip.duration * loops
    if (elapsed < effectiveDuration * 0.9 ) {
      return
    }
  } else {
    if (elapsed < state.cyclingState.cycleInterval ) {
      return
    }
  }
  // If there are queued items, consume the next queued clip; otherwise pick via cycling
  let nextItem: { clip: AnimationClip; blendTime: number } | null = null
  if (state.queue && state.queue.length > 0) {
    nextItem = state.queue.shift() || null
  }
  const shouldCycle = state.cyclingState.cyclingEnabled;
  const item = nextItem || (shouldCycle ? { clip: pickNextClip(state) , blendTime: undefined } : null);

  if (item) {
    const clip = item.clip;
    const blend =
      (item.blendTime ?? clip.blendTime) ||
      getPersonalityConfiguration(state.currentPersonality).blendTime;
    playClip(state, clip, blend);
    state.lastChangeTime = now;
    return;
  }
}

// --------------------- Helpers ---------------------

function weightedCategoryPick(weights: Record<AnimationCategory, number>): AnimationCategory {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const [category, weight] of Object.entries(weights)) {
    r -= weight
    if (r <= 0) return category as AnimationCategory
  }
  return 'idle'
}

function pickNextClip(state: AnimationState): AnimationClip {
  const personalityConfig = getPersonalityConfiguration(state.currentPersonality)
  const allClips = getPersonalityAnimationClips(state.currentPersonality)

  // Find the next category in the sequence
  const categories = personalityConfig.categories
  let nextCategory: AnimationCategory

  if (state.cyclingState.lastCategory) {
    const idx = categories.indexOf(state.cyclingState.lastCategory)
    nextCategory = categories[(idx + 1) % categories.length]
  } else {
    nextCategory = categories[0]
  }

  // Apply weighted hybrid: 70% chance to go to next in sequence, 30% fully weighted random
  const useSequence = Math.random() < 0.7
  const categoryToPick = useSequence ? nextCategory : weightedCategoryPick(personalityConfig.weights)

  // Filter clips of chosen category
  const categoryClips = allClips.filter((c) => c.category === categoryToPick)
  if (categoryClips.length === 0) return allClips[Math.floor(Math.random() * allClips.length)]

  // Pick random clip from that category
  // Pick a clip using weighted random based on clip weights (if available), otherwise uniform random
  let chosenClip: AnimationClip = categoryClips[0]
  if (categoryClips[0] && typeof categoryClips[0].weight === 'number') {
    // Weighted random pick
    const totalWeight = categoryClips.reduce((sum, c) => sum + (c.weight ?? 1), 0)
    let r = Math.random() * totalWeight
    for (const clip of categoryClips) {
      r -= clip.weight ?? 1
      if (r <= 0) {
        chosenClip = clip
        break
      }
    }
    // Fallback in case of rounding errors
    if (!chosenClip) chosenClip = categoryClips[categoryClips.length - 1]
  } else {
    // Uniform random pick
    chosenClip = categoryClips[Math.floor(Math.random() * categoryClips.length)]
  }
  state.cyclingState.lastCategory = categoryToPick
  return chosenClip
}

function playClip(state: AnimationState, clip: AnimationClip, blendTime: number, _warp: boolean = true) {
  if (!state.actions || !state.mixer) return
  const action = state.actions[clip.name]

  if (!action) return

  action.reset()
  // Normalize loop configuration: ensure at least one iteration for LoopOnce, support finite repeats and Infinity
  let loopMode: THREE.AnimationActionLoopStyles
  let repetitions: number
  if (clip.loopCount === Infinity) {
    loopMode = THREE.LoopRepeat
    repetitions = Infinity
  } else if ((clip.loopCount ?? 1) > 1) {
    loopMode = THREE.LoopRepeat
    repetitions = Math.max(2, Math.floor(clip.loopCount))
  } else {
    loopMode = THREE.LoopOnce
    repetitions = 1
  }
  action.setLoop(loopMode, repetitions)
  action.clampWhenFinished = true

  // Apply animation speed from clip configuration
  action.timeScale = clip.speed
  // If no current clip, start immediately with full weight
  if (!state.currentClip) {
    action.setEffectiveWeight(1.0)
    action.play()
    state.currentClip = clip
    return
  }

  // Set up weight-based transition
  const currentAction = state.actions[state.currentClip.name]

  if (state.currentClip && state.currentClip.name === clip.name) {
    currentAction.play()
    return
  }

  if (currentAction && blendTime > 0) {
    // Start transition state
    state.isTransitioning = true
    state.nextClip = clip
    state.transitionProgress = 0
    state.transitionDuration = blendTime
    // Start new action with zero weight and correct speed
    action.setEffectiveWeight(0.0)
    action.play()

    // Current action starts at full weight
    currentAction.setEffectiveWeight(1.0)
  } else {
    // Instant transition - stop current and start new
    if (currentAction) {
      currentAction.setEffectiveWeight(0.0)
      currentAction.stop()
    }

    action.setEffectiveWeight(1.0)
    action.play()
    state.currentClip = clip
  }
}

// --------------------- Info ---------------------
export function getCurrentAnimationInfo(state: AnimationState) {
  return {
    currentClip: state.currentClip,
    nextClip: state.nextClip,
    isTransitioning: state.isTransitioning,
    queueLength: state.queue?.length ?? 0
  }
}

// --------------------- Queue API ---------------------
export function enqueueAnimation(state: AnimationState, performanceData: AnimationPerformanceData) {
  const configuredClip = performanceData.clip
  if (!configuredClip) return
  const runtimeClip = {
    ...configuredClip,
    loopCount: performanceData.loopCount ?? configuredClip.loopCount ?? 1,
    speed: performanceData.speed ?? configuredClip.speed ?? 1
  }
  const personalityBlend = getPersonalityConfiguration(state.currentPersonality).blendTime
  const blendMs = performanceData.blendTime ?? configuredClip.blendTime ?? personalityBlend ?? 500
  if (!state.queue) state.queue = []
  state.queue.push({ clip: runtimeClip, blendTime: blendMs })
}

export function clearAnimationQueue(state: AnimationState) {
  if (state.queue) state.queue.length = 0
}
