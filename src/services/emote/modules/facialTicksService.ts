import type { EmoteConfig } from '../configs/emoteConfig'
import { VRM_EXPRESSIONS, type EmoteState, type FacialTarget } from '../emoteTypes'
import { applyExpression, clamp } from '../utils/expressionUtils'

export const updateFacialTicks = (state: EmoteState, _delta: number , config : EmoteConfig): void => {
  if (!state.targets) return

  const currentTime = performance.now()
  const { tickState } = state

  // Non-mouth tick expressions for subtle movement
  const vrmTickExpressions = [
    VRM_EXPRESSIONS.lookLeft, // Subtle eye movement
    VRM_EXPRESSIONS.lookRight // Subtle eye movement
  ]

  const tickTargets: readonly (keyof FacialTarget)[] = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft',
    'browOuterUpRight',
    'cheekSquintLeft',
    'cheekSquintRight'
  ]

  // Generate tick value based on time (more subtle for natural look)
  const tickValue = clamp(Math.sin(currentTime / config.tick.frequency) * config.tick.intensity, 0, config.tick.intensity)

  if (tickValue <= 0.01) {
    tickState.currentTick = null
    return
  }

  // Pick a new tick target if needed
  if (!tickState.currentTick || Math.random() < 0.3) {
    tickState.currentTick = tickTargets[Math.floor(Math.random() * tickTargets.length)]
  }

  // Apply tick animation to state targets (for morph target compatibility)
  if (tickState.currentTick && state.targets[tickState.currentTick] !== undefined) {
    state.targets[tickState.currentTick] = tickValue
  }

  // Apply subtle VRM tick expressions (eye movements only)
  if (Math.random() < config.tick.probability) {
    // Even less frequent for subtlety
    const randomVrmTick = vrmTickExpressions[Math.floor(Math.random() * vrmTickExpressions.length)]
    applyExpression(state, randomVrmTick, tickValue * 0.2) // Very subtle for VRM

    // Clear the expression shortly after
    setTimeout(() => {
      applyExpression(state, randomVrmTick, 0)
    }, 200)
  }
}
