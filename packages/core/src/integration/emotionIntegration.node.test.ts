import { describe, expect, it } from 'vitest'

import type { ConversationMessage } from '../services/conversation/conversationType'
import {
  detectEmotionFromText,
  getEmotionIntensity,
  shouldTriggerBargeIn
} from './emotionIntegration'

const userMsg = (text: string, isUser = true) =>
  ({ text, isUser } as unknown as ConversationMessage)

describe('detectEmotionFromText', () => {
  it.each([
    ['I am so happy today', 'happy'],
    ['🎉 congrats', 'happy'],
    ['this is sad news', 'sad'],
    ['I am absolutely furious', 'angry'],
    ['I am terrified of that', 'fear'],
    ['that is disgusting', 'disgust'],
    ['I adore them', 'love'],
    ['the weather is fine', 'neutral']
  ])('maps %j → %s', (text, expected) => {
    expect(detectEmotionFromText(text)).toBe(expected)
  })

  it('matches the happy branch before love when "love" appears alone', () => {
    // Documents current precedence: happy checks `includes('love')` first.
    expect(detectEmotionFromText('I love you')).toBe('happy')
  })
})

describe('shouldTriggerBargeIn', () => {
  it('fires on a short interruptive command from the user', () => {
    expect(shouldTriggerBargeIn(userMsg('stop'))).toBe(true)
    expect(shouldTriggerBargeIn(userMsg('please wait a second'))).toBe(true)
  })

  it('does not fire on ordinary user speech', () => {
    expect(shouldTriggerBargeIn(userMsg('tell me more about that'))).toBe(false)
  })

  it('never fires on assistant messages', () => {
    expect(shouldTriggerBargeIn(userMsg('stop', false))).toBe(false)
  })
})

describe('getEmotionIntensity', () => {
  it('ranks high-intensity language highest', () => {
    expect(getEmotionIntensity('this is extremely good')).toBeGreaterThanOrEqual(0.8)
  })

  it('ranks medium-intensity language in the middle band', () => {
    const v = getEmotionIntensity('this is very nice')
    expect(v).toBeGreaterThan(0.5)
    expect(v).toBeLessThan(0.8)
  })

  it('defaults neutral text to a low floor', () => {
    expect(getEmotionIntensity('the sky')).toBeCloseTo(0.3)
  })
})
