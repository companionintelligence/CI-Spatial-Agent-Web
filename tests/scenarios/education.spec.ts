import { test, expect } from '@playwright/test'
import { bootApp, sendAndAwaitReply, sendTurn, assistantBubbleCount, canvasFramesDiffer } from './_scenario'

/**
 * L4 · Education vertical — tutor turn-taking + barge-in.
 * docs/TESTING-PIPELINE.md: multiple turns; expression changes between turns;
 * barge-in stops mid-utterance.
 *
 * Real app, offline directed-responses mode. Hard assertions: a short multi-turn Q&A
 * (each turn adds an assistant bubble) and a barge-in turn ("wait", routed through
 * shouldTriggerBargeIn → agent.actions.triggerBargein()) that the app accepts without
 * breaking the conversation. The strict "barge-in halts the utterance mid-flight" and
 * "facial expression changes between turns" assertions live in the skipped test — they
 * read ref-held service state the app never surfaces.
 */
test.describe('L4 · education (tutor turn-taking + barge-in)', () => {
  test('handles multiple tutoring turns, each adding a reply', async ({ page }) => {
    const { errors } = await bootApp(page)

    const turns = ['Hello', 'Can you help me?', 'How are you?']
    let prevCount = 0
    for (const turn of turns) {
      const reply = await sendAndAwaitReply(page, turn)
      expect(reply.length, `reply for "${turn}" should have text`).toBeGreaterThan(0)

      const count = await assistantBubbleCount(page)
      expect(count, 'each turn should add an assistant bubble').toBeGreaterThan(prevCount)
      prevCount = count
    }

    // Observational only (never fails the test).
    // eslint-disable-next-line no-console
    console.log('[education] canvas frames differed during Q&A:', await canvasFramesDiffer(page))

    expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('accepts a barge-in turn without breaking the conversation', async ({ page }) => {
    const { errors } = await bootApp(page)

    // Start an utterance...
    await sendAndAwaitReply(page, 'Can you help me?')

    // ...then barge in. "wait" is both a barge-in phrase (shouldTriggerBargeIn) and a
    // directed-responses trigger, so the turn both interrupts and produces a reply.
    const before = await assistantBubbleCount(page)
    await sendTurn(page, 'wait')

    await expect
      .poll(async () => assistantBubbleCount(page), {
        timeout: 30_000,
        message: 'app did not produce a reply after a barge-in turn'
      })
      .toBeGreaterThan(before)

    // Conversation is still alive: a follow-up turn still works after the barge-in.
    const followUp = await sendAndAwaitReply(page, 'Thank you')
    expect(followUp.length).toBeGreaterThan(0)

    expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([])
  })

  // TODO: assert barge-in actually STOPS the in-progress utterance (TTS isSpeaking flips
  // false, visemes reset) and that facial EXPRESSION changes between turns. Both live in
  // ref-held service state (useTTSService / useEmoteService) the app never surfaces on
  // `window`, and frameloop="demand" defeats screenshot frame-diffing (see
  // canvasFramesDiffer). Wire once the app exposes an agent-debug surface; until then this
  // stays skipped rather than a false pass.
  test.skip('barge-in halts the in-progress utterance and expression changes between turns', async () => {
    // Intentionally skipped — see TODO above.
  })
})
