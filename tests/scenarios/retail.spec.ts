import { test, expect } from '@playwright/test'
import { bootApp, sendAndAwaitReply, canvasFramesDiffer } from './_scenario'

/**
 * L4 · Retail vertical — product assistant.
 * docs/TESTING-PIPELINE.md: idle→gesture on answer; emote (happy) on positive;
 * response contains product text; lip-sync frames differ.
 *
 * Real app, offline directed-responses mode. Hard assertions: the product Q&A turn and
 * a positive/affirmation turn each yield a visible reply. The positive turn ("That is
 * great, I love it!") matches the "great"/"love" directed triggers whose replies carry
 * happy-emotion words — the path that, in useAgent, drives detectEmotionFromText →
 * EMOTION_TO_CATEGORY.happy = 'gesture'. Asserting that gesture actually fired is left
 * to the skipped test (not observable from the real app — see below).
 */
test.describe('L4 · retail (product assistant)', () => {
  test('answers a product question and a positive affirmation with visible replies', async ({ page }) => {
    const { errors } = await bootApp(page)

    // Product Q&A turn — the doc's canonical retail prompt.
    const product = await sendAndAwaitReply(page, 'Tell me about this jacket.')
    expect(product.length, 'product reply should have text').toBeGreaterThan(0)

    // Positive turn — exercises the happy→gesture embodiment path on an affirmation.
    const positive = await sendAndAwaitReply(page, 'That is great, I love it!')
    expect(positive.length, 'positive reply should have text').toBeGreaterThan(0)

    // Observational only (never fails the test).
    // eslint-disable-next-line no-console
    console.log('[retail] canvas frames differed during reply:', await canvasFramesDiffer(page))

    expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([])
  })

  // TODO: assert (a) the reply text contains catalog/product-specific content and
  // (b) a 'happy' emote + gesture specifically fired on the positive turn. Neither is
  // wireable against the current app: the offline directed-responses catalog has no
  // product entries (replies are generic assistant chatter), and the app exposes no
  // emote/animation state on `window` (frameloop="demand" also defeats screenshot
  // frame-diffing — see canvasFramesDiffer). Provide a retail directed-responses fixture
  // + an agent-debug hook, then assert here. Do NOT fake either assertion.
  test.skip('reply contains product text and fires a happy emote/gesture', async () => {
    // Intentionally skipped — see TODO above.
  })
})
