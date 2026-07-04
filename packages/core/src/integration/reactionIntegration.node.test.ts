import { describe, expect, it } from 'vitest'

import type { ConversationMessage } from '../services/conversation/conversationType'
import type { PerformanceData } from '../services/emote/emoteTypes'
import {
  createReactionFromMessage,
  reactionIntegrationService,
  selectAnimationForPerformance
} from './reactionIntegration'

const perf = (emotion: PerformanceData['emotion']): PerformanceData => ({ emotion })

describe('selectAnimationForPerformance — EMOTION_TO_CATEGORY mapping', () => {
  it('maps positive emotions (happy, love) to the gesture category', () => {
    expect(selectAnimationForPerformance(perf('happy'))!.category).toBe('gesture')
    expect(selectAnimationForPerformance(perf('love'))!.category).toBe('gesture')
  })

  it('maps negative/aroused emotions to the expression category', () => {
    for (const e of ['angry', 'fear', 'sad', 'disgust'] as const) {
      expect(selectAnimationForPerformance(perf(e))!.category).toBe('expression')
    }
  })

  it('returns undefined (stay idle) for neutral', () => {
    expect(selectAnimationForPerformance(perf('neutral'))).toBeUndefined()
  })

  it('returns undefined when the emotion is undefined', () => {
    expect(selectAnimationForPerformance(perf(undefined))).toBeUndefined()
  })

  it('returns undefined for an unmapped emotion (sleep, alert)', () => {
    expect(selectAnimationForPerformance(perf('sleep'))).toBeUndefined()
    expect(selectAnimationForPerformance(perf('alert'))).toBeUndefined()
  })
})

describe('selectAnimationForPerformance — skeleton-agnostic shape', () => {
  it('returns a category-based descriptor with no explicit clip', () => {
    const a = selectAnimationForPerformance(perf('happy'))!
    expect(a).toMatchObject({
      category: 'gesture',
      immediate: true,
      loopCount: 1
    })
    // Skeleton-agnostic: it names a category, never a concrete clip.
    expect('clip' in a).toBe(false)
    expect(a.category).toBeTypeOf('string')
  })

  it('clamps speed into [0.7, 1.4] regardless of intensity', () => {
    expect(selectAnimationForPerformance(perf('happy'), 0).speed!).toBeGreaterThanOrEqual(0.7)
    expect(selectAnimationForPerformance(perf('happy'), 5).speed!).toBeLessThanOrEqual(1.4)
  })

  it('clamps blendTime into [350, 500]', () => {
    for (const intensity of [0, 0.5, 1, 5]) {
      const bt = selectAnimationForPerformance(perf('angry'), intensity)!.blendTime!
      expect(bt).toBeGreaterThanOrEqual(350)
      expect(bt).toBeLessThanOrEqual(500)
    }
  })

  it('increases speed and shortens blend as intensity rises', () => {
    const low = selectAnimationForPerformance(perf('angry'), 0.1)!
    const high = selectAnimationForPerformance(perf('angry'), 0.9)!
    expect(high.speed!).toBeGreaterThanOrEqual(low.speed!)
    expect(high.blendTime!).toBeLessThanOrEqual(low.blendTime!)
  })
})

describe('createReactionFromMessage', () => {
  const msg = (text: string): ConversationMessage =>
    ({ id: '1', text, isUser: false, timestamp: 0 } as ConversationMessage)

  it('derives a happy gesture reaction from cheerful text', () => {
    const { performance, animation } = createReactionFromMessage(msg('I am so happy and excited!'))
    expect(performance.emotion).toBe('happy')
    expect(animation?.category).toBe('gesture')
  })

  it('produces no body animation for neutral text', () => {
    const { performance, animation } = createReactionFromMessage(msg('the weather is fine today'))
    expect(performance.emotion).toBe('neutral')
    expect(animation).toBeUndefined()
  })

  it('threads the message index through as the gaze bcounter', () => {
    const { performance } = createReactionFromMessage(msg('hello there'), 7)
    expect(performance.bcounter).toBe(7)
  })
})

describe('reactionIntegrationService facade', () => {
  it('exposes the reaction functions', () => {
    expect(reactionIntegrationService.selectAnimationForPerformance).toBe(selectAnimationForPerformance)
    expect(reactionIntegrationService.createReactionFromMessage).toBe(createReactionFromMessage)
  })
})
