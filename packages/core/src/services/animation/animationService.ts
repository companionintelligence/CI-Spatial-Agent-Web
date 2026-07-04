import * as THREE from 'three'

import { ANIMATION_CLIPS } from './config/animationClips'
import type { AnimationCategory, AnimationClip, AnimationPerformanceData, AnimationState } from './animationTypes'
import { getPersonalityConfiguration } from './config/personalityConfig'

/**
 * Animation service.
 *
 * Blending is delegated to three.js' native `AnimationAction.crossFadeTo` (with
 * time-warp) instead of the previous hand-rolled per-frame weight lerp, and clip
 * completion is driven by the mixer's `'finished'` event instead of an
 * elapsed-time heuristic. The public function surface is unchanged so
 * `useAnimationService` and `AvatarModel` are unaffected.
 */

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
    avatar: undefined,
    previousClipName: undefined,
    mixerFinishedListener: undefined
  }
}

export function resetAnimationState(state: AnimationState) {
  detachFinishedListener(state)
  state.currentClip = null
  state.nextClip = null
  state.transitionProgress = 0
  state.isTransitioning = false
  state.lastChangeTime = 0
  state.cyclingState.nextCycleTime = 0
  state.cachedClips = []
  state.previousClipName = undefined
  if (state.queue) state.queue.length = 0
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
  // Re-attach cleanly if setup runs again (e.g. avatar reload).
  detachFinishedListener(state)

  state.actions = actions
  state.mixer = mixer
  state.avatar = avatar

  const listener: THREE.EventListener<THREE.AnimationMixerEventMap['finished'], 'finished', THREE.AnimationMixer> = (
    event
  ) => handleActionFinished(state, event)
  state.mixerFinishedListener = listener
  mixer.addEventListener('finished', listener)
}

function detachFinishedListener(state: AnimationState) {
  if (state.mixer && state.mixerFinishedListener) {
    state.mixer.removeEventListener('finished', state.mixerFinishedListener)
  }
  state.mixerFinishedListener = undefined
}

/**
 * Fired when a LoopOnce/finite action reaches its end. Only the *currently
 * active* clip advances the queue; a clip that is merely fading out during a
 * crossfade is ignored.
 */
function handleActionFinished(state: AnimationState, event: { action: THREE.AnimationAction }) {
  if (!state.actions || !state.currentClip) return
  const currentAction = state.actions[state.currentClip.name]
  if (event.action !== currentAction) return
  advanceToNext(state, performance.now())
}

export function initializeDefaultAnimation(state: AnimationState, personality: string, animation?: AnimationClip) {
  if (!state.actions) return
  if (!state.cachedClips.length) {
    state.cachedClips = getPersonalityAnimationClips(personality)
  }
  const firstClip = animation ?? pickNextClip(state)
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

  const configuredClip = performanceData.clip
  if (!configuredClip) return

  // Runtime clip instance honoring performance overrides.
  const runtimeClip: AnimationClip = {
    ...configuredClip,
    loopCount: performanceData.loopCount ?? configuredClip.loopCount ?? 1,
    speed: performanceData.speed ?? configuredClip.speed ?? 1
  }

  const personalityBlend = getPersonalityConfiguration(state.currentPersonality).blendTime
  const blendMs = performanceData.blendTime ?? configuredClip.blendTime ?? personalityBlend ?? 500

  // Play immediately when idle-ish; otherwise queue so we never stack transitions.
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

  // The mixer drives all weight ramps scheduled by crossFadeTo/fadeIn/fadeOut.
  state.mixer.update(delta)

  const now = performance.now()

  // Track when the active crossfade has logically completed so we can stop the
  // faded-out action and re-open the gate for the next transition.
  if (state.isTransitioning) {
    state.transitionProgress += delta * 1000
    if (state.transitionProgress >= state.transitionDuration) {
      state.isTransitioning = false
      state.transitionProgress = 0
      if (state.previousClipName && state.actions) {
        const prev = state.actions[state.previousClipName]
        if (prev && (!state.currentClip || state.previousClipName !== state.currentClip.name)) {
          prev.stop()
        }
      }
      state.previousClipName = undefined
    }
  }

  if (!state.currentClip) return

  // Finite clips advance on the mixer 'finished' event. Infinite/looping clips
  // (e.g. idle) only rotate when cycling is enabled, on the cycle timer.
  const isInfinite = !Number.isFinite(state.currentClip.loopCount ?? Infinity)
  if (isInfinite && state.cyclingState.cyclingEnabled && !state.isTransitioning) {
    if (now - state.lastChangeTime >= state.cyclingState.cycleInterval) {
      advanceToNext(state, now)
    }
  }
}

/**
 * Choose and play the next clip: a queued performance first, then a cycled clip
 * if cycling is on, else fall back to the idle base so finite gestures never
 * freeze on their last frame.
 */
function advanceToNext(state: AnimationState, now: number) {
  if (!state.actions) return

  let item: { clip: AnimationClip; blendTime?: number } | null = null

  if (state.queue && state.queue.length > 0) {
    item = state.queue.shift() || null
  }

  if (!item && state.cyclingState.cyclingEnabled) {
    item = { clip: pickNextClip(state), blendTime: undefined }
  }

  if (!item) {
    const cur = state.currentClip
    const isFiniteNonIdle =
      cur && Number.isFinite(cur.loopCount ?? Infinity) && cur.name !== ANIMATION_CLIPS.idle_loop.name
    if (isFiniteNonIdle && state.actions[ANIMATION_CLIPS.idle_loop.name]) {
      item = { clip: ANIMATION_CLIPS.idle_loop, blendTime: undefined }
    }
  }

  if (!item) return

  const clip = item.clip
  const blend =
    (item.blendTime ?? clip.blendTime) || getPersonalityConfiguration(state.currentPersonality).blendTime
  playClip(state, clip, blend)
  state.lastChangeTime = now
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

  const categories = personalityConfig.categories
  let nextCategory: AnimationCategory

  if (state.cyclingState.lastCategory) {
    const idx = categories.indexOf(state.cyclingState.lastCategory)
    nextCategory = categories[(idx + 1) % categories.length]
  } else {
    nextCategory = categories[0]
  }

  // 70% sequential, 30% weighted-random category.
  const useSequence = Math.random() < 0.7
  const categoryToPick = useSequence ? nextCategory : weightedCategoryPick(personalityConfig.weights)

  const categoryClips = allClips.filter((c) => c.category === categoryToPick)
  if (categoryClips.length === 0) return allClips[Math.floor(Math.random() * allClips.length)]

  let chosenClip: AnimationClip = categoryClips[0]
  if (categoryClips[0] && typeof categoryClips[0].weight === 'number') {
    const totalWeight = categoryClips.reduce((sum, c) => sum + (c.weight ?? 1), 0)
    let r = Math.random() * totalWeight
    for (const clip of categoryClips) {
      r -= clip.weight ?? 1
      if (r <= 0) {
        chosenClip = clip
        break
      }
    }
    if (!chosenClip) chosenClip = categoryClips[categoryClips.length - 1]
  } else {
    chosenClip = categoryClips[Math.floor(Math.random() * categoryClips.length)]
  }
  state.cyclingState.lastCategory = categoryToPick
  return chosenClip
}

/** Apply loop/clamp/blend-mode config to an action from its clip definition. */
function configureAction(action: THREE.AnimationAction, clip: AnimationClip) {
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
  action.blendMode =
    clip.blendMode === 'additive' ? THREE.AdditiveAnimationBlendMode : THREE.NormalAnimationBlendMode
}

function playClip(state: AnimationState, clip: AnimationClip, blendTime: number) {
  if (!state.actions || !state.mixer) return
  const action = state.actions[clip.name]
  if (!action) return

  configureAction(action, clip)
  action.timeScale = clip.speed ?? 1

  // First clip: start at full weight, no blend.
  if (!state.currentClip) {
    action.reset()
    action.setEffectiveWeight(1.0)
    action.play()
    state.currentClip = clip
    state.isTransitioning = false
    return
  }

  // Re-triggering the same clip: ensure it's running rather than restarting hard.
  if (state.currentClip.name === clip.name) {
    action.paused = false
    if (!action.isRunning()) {
      action.reset()
      action.play()
    }
    return
  }

  const currentAction = state.actions[state.currentClip.name]
  const blendSeconds = Math.max(0, blendTime) / 1000

  if (currentAction && blendSeconds > 0) {
    // Native crossfade with time-warp. crossFadeTo ramps the weights via the mixer.
    action.reset()
    action.enabled = true
    action.setEffectiveTimeScale(clip.speed ?? 1)
    action.setEffectiveWeight(1.0)
    action.play()
    currentAction.crossFadeTo(action, blendSeconds, true)

    state.previousClipName = state.currentClip.name
    state.isTransitioning = true
    state.transitionDuration = blendTime
    state.transitionProgress = 0
  } else {
    // Instant switch.
    if (currentAction) {
      currentAction.stop()
    }
    action.reset()
    action.setEffectiveWeight(1.0)
    action.play()
    state.isTransitioning = false
    state.previousClipName = undefined
  }

  state.currentClip = clip
  state.nextClip = null
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
  const runtimeClip: AnimationClip = {
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

/**
 * Convert a normal clip into an additive clip relative to a reference pose (frame 0
 * of the base clip by default), so it can be layered over a base animation with an
 * action created using THREE.AdditiveAnimationBlendMode. Provided for future additive
 * layering; the current pipeline (drei useAnimations) plays clips in normal mode.
 */
export function makeAdditiveClip(clip: THREE.AnimationClip, referenceFrame = 0): THREE.AnimationClip {
  const additive = clip.clone()
  THREE.AnimationUtils.makeClipAdditive(additive, referenceFrame)
  additive.name = `${clip.name}__additive`
  return additive
}
