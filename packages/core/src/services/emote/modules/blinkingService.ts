import type { EmoteConfig } from '../configs/emoteConfig'
import type { EmoteState } from '../emoteTypes'
import { applyExpression } from '../utils/expressionUtils'

export const updateBlinking = (state: EmoteState, _delta: number , config: EmoteConfig): void => {
  if (!state.targets) return

  const currentTime = performance.now()
  const { blinkState } = state
  // Time to start a new blink
  if (currentTime >= blinkState.nextBlinkTime && !blinkState.isBlinking) {
    blinkState.isBlinking = true
    blinkState.blinkStartTime = currentTime
    blinkState.nextBlinkTime =
      currentTime + Math.random() * (config.blink.maxInterval - config.blink.minInterval) + config.blink.minInterval
  }

  // Handle active blink
  if (blinkState.isBlinking) {
    const blinkDuration = currentTime - blinkState.blinkStartTime

    if (blinkDuration < config.blink.cycleDuration) {
      // Blink animation using sine wave
      const blinkValue = Math.max(0, Math.min(1, Math.sin((blinkDuration / config.blink.cycleDuration) * Math.PI)))

      applyBlinkExpression(state, blinkValue)
    } else {
      // End blink
      blinkState.isBlinking = false
      resetBlinkExpression(state)
    }
  }
}

const applyBlinkExpression = (state: EmoteState, value: number): void => {
  if (state.vrm) {
    applyExpression(state, 'blink', value)
  } else {
    applyExpression(state, 'eyeBlinkLeft', value)
    applyExpression(state, 'eyesClosed', value)
    applyExpression(state, 'eyeBlinkRight', value)
  }
}

const resetBlinkExpression = (state: EmoteState): void => {
  applyExpression(state, 'blink', 0)
  applyExpression(state, 'eyeBlinkLeft', 0)
  applyExpression(state, 'eyeBlinkRight', 0)
  applyExpression(state, 'eyesClosed', 0)
}
