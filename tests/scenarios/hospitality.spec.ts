import { test, expect } from '@playwright/test'
import { bootApp, sendAndAwaitReply, canvasFramesDiffer } from './_scenario'

/**
 * L4 · Hospitality vertical — greeter / wayfinding.
 * docs/TESTING-PIPELINE.md: greet gesture on load; reply bubble; pointing/gesture;
 * lip-sync frames differ.
 *
 * Runs the REAL app (`/`) in offline directed-responses mode. The "hello" turn resolves
 * to a greeting reply; the wayfinding turn ("Where's the conference room?") exercises
 * the default fallback path. Hard assertions here are the door-to-door reliable ones:
 * the avatar boots and each user turn yields a visible reply bubble. The strict
 * embodiment assertions (pointing gesture, lip-sync frames differ) are not reliably
 * observable from the real app — see the skipped test at the bottom for why.
 */
test.describe('L4 · hospitality (wayfinding greeter)', () => {
  test('greets and answers a wayfinding question with visible replies', async ({ page }) => {
    const { errors } = await bootApp(page)

    // Greeting turn — the greeter use case opens with a welcome.
    const greeting = await sendAndAwaitReply(page, 'Hello')
    expect(greeting.length, 'greeting reply should have text').toBeGreaterThan(0)

    // Wayfinding turn — the doc's canonical hospitality prompt.
    const wayfinding = await sendAndAwaitReply(page, "Where's the conference room?")
    expect(wayfinding.length, 'wayfinding reply should have text').toBeGreaterThan(0)

    // Observational only (never fails the test): note whether the canvas visibly moved.
    // See canvasFramesDiffer() for why this is not a hard gate on the real app.
    console.log('[hospitality] canvas frames differed during reply:', await canvasFramesDiffer(page))

    expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([])
  })

  // TODO: assert embodiment fired for real — a greet/pointing GESTURE on the wayfinding
  // answer and lip-sync activity (viseme morphs driving). This is not wireable against
  // the current real app: (1) <Canvas frameloop="demand"> + no preserveDrawingBuffer
  // makes screenshot frame-diffing unreliable (idle 0/10, reply ~1/12 pairs differ),
  // and (2) the app exposes no animation/emote/viseme service state on `window`. The
  // instrumented surface for this is the L3/L5 harness (window.__harness), which already
  // captures gesture/lip-sync as reviewable WebP. Wire this L4 assertion once useAgent
  // exposes an agent-debug hook (e.g. window.__agentDebug = { activeClip, emotion,
  // visemeActive }). Do NOT convert to a false pass.
  test.skip('fires a pointing/greet gesture + lip-sync on the wayfinding answer', async () => {
    // Intentionally skipped — see TODO above.
  })
})
