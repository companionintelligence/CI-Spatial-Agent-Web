import type { EmoteState, FacialTarget } from '../emoteTypes'

export const clamp = (num: number, min: number, max: number): number =>
  Math.max(Math.min(num, Math.max(min, max)), Math.min(min, max))

export const applyExpression = (state: EmoteState, expressionName: string, value: number): void => {
  const clampedValue = clamp(value, 0, 1)
  state.targets[expressionName as keyof FacialTarget] = clampedValue
}

export const resetAllExpressions = (state: EmoteState, expressions: readonly string[]): void => {
  expressions.forEach((expression) => {
    applyExpression(state, expression, 0)
  })
}

export const applyExpressionSafely = (state: EmoteState, expressionName: string, value: number): boolean => {
  try {
    applyExpression(state, expressionName, value)
    return true
  } catch (error) {
    console.warn(`Failed to apply expression ${expressionName}:`, error)
    return false
  }
}
