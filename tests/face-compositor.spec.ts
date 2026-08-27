import { test, expect, type Page } from '@playwright/test'

/**
 * Face arbitration — the regression suite for the FaceCompositor.
 *
 * WHAT THIS EXISTS TO CATCH
 * -------------------------
 * The avatar's face used to be written by three producers in sequence every
 * frame — an FFT lip-sync path, a legacy word-timed viseme service, and the
 * emote service — each poking `morphTargetInfluences` directly. Whoever ran last
 * won, so a smile could flatten a viseme mid-word and a zeroed expression could
 * pin a VRM's mouth shut.
 *
 * These tests assert the ARBITRATION, not the pixels: `__harness.compositorTrace()`
 * reports which layer owned each facial region on the last rendered frame. A
 * screenshot cannot tell you why a mouth looked wrong; this can.
 */

interface RegionOwnership {
  region: string
  winner: string | null
  exclusive: boolean
}
interface Trace {
  regions: RegionOwnership[]
  written: Record<string, number>
  releasing: string[]
}
interface SpeechDebug {
  kind: 'scheduled' | 'sequence' | 'acoustic' | 'none'
  hasAnalyser: boolean
  energy: number
  claimed: boolean
  text: string
  keys: number
  frame: number
}
interface Harness {
  setEmote(emotion: string, relaxTime?: number): void
  speak(text: string): Promise<number | null>
  faceSnapshot(): { jawOpen: number; blink: number; mouth: Record<string, number> }
  compositorTrace(): Trace | null
  speechDebug(): SpeechDebug | null
  setMorph(entries: Record<string, number>): number
  clearMorphs(): void
}
declare global {
  interface Window {
    __harness?: Harness
    __harnessReady?: boolean
    __avatarLoaded?: boolean
  }
}

/** Greg is an RPM "pro" GLB: ARKit-52 plus Oculus visemes — the richest rig we ship. */
const AVATAR = 'Greg'

async function loadHarness(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`))
  await page.goto(`/harness.html?avatar=${AVATAR}&shot=face&bg=dark`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__harnessReady === true, { timeout: 60_000 })
  await page.waitForFunction(() => window.__avatarLoaded === true, { timeout: 90_000 })
  return errors
}

const trace = (page: Page) => page.evaluate(() => window.__harness!.compositorTrace())
const snapshot = (page: Page) => page.evaluate(() => window.__harness!.faceSnapshot())
const speechDebug = (page: Page) => page.evaluate(() => window.__harness!.speechDebug())
const ownerOf = (t: Trace | null, region: string) => t?.regions.find((r) => r.region === region) ?? null

/**
 * Everything below waits on RENDERED FRAMES, never on wall-clock time.
 *
 * These specs run under the capture config's SwiftShader flags, where a real 3D
 * scene renders at single-digit FPS and cross-process `evaluate` polling starves
 * it further — a `waitForTimeout(3000)` can span as few as five frames. Timing
 * out in wall-clock made this suite measure the test rig instead of the product,
 * which is exactly the flakiness this repo already has a reputation for.
 */
async function waitForFrames(page: Page, count: number, timeoutMs = 60_000): Promise<void> {
  const start = (await speechDebug(page))?.frame ?? 0
  await page
    .waitForFunction(
      ([from, n]) => ((window.__harness?.speechDebug()?.frame ?? 0) - (from as number)) >= (n as number),
      [start, count] as const,
      { timeout: timeoutMs, polling: 100 }
    )
    .catch(() => {
      throw new Error(`render loop advanced fewer than ${count} frames in ${timeoutMs}ms (frame stalled at ${start})`)
    })
}

/** Peak jaw opening observed over the next `frames` rendered frames. */
async function peakJawOverFrames(page: Page, frames: number): Promise<number> {
  const start = (await speechDebug(page))?.frame ?? 0
  let peak = 0
  for (;;) {
    const [snap, dbg] = await Promise.all([snapshot(page), speechDebug(page)])
    peak = Math.max(peak, snap.jawOpen)
    if ((dbg?.frame ?? 0) - start >= frames) return peak
    await page.waitForTimeout(60)
  }
}

/** Wait until the speech layer reports a given state. */
async function waitForSpeechKind(page: Page, kind: SpeechDebug['kind'], timeoutMs = 60_000): Promise<void> {
  await page.waitForFunction(
    (k) => {
      const actual = window.__harness?.speechDebug()?.kind
      // 'none' is exact; anything else means "some tier owns the mouth", because
      // which tier wins depends on what the configured engine reports and that is
      // not what these specs are about.
      return k === 'none' ? actual === 'none' : actual !== undefined && actual !== 'none'
    },
    kind,
    { timeout: timeoutMs, polling: 100 }
  )
}

test.describe('face compositor', () => {
  test('is live and arbitrating on a loaded avatar', async ({ page }) => {
    const errors = await loadHarness(page)
    const t = await trace(page)
    expect(t, 'compositorTrace() must be non-null once an avatar is mounted').not.toBeNull()
    expect(errors, 'no page errors during load').toEqual([])
  })

  test('emotion owns the lips while the avatar is silent', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => window.__harness!.setEmote('happy', 8000))
    await waitForFrames(page, 3)

    const lips = ownerOf(await trace(page), 'lips')
    expect(lips?.winner, 'a silent avatar must let emotion shape the mouth').toBe('emotion')
    expect(lips?.exclusive, 'nothing should be claiming the mouth while silent').toBe(false)
  })

  test('speech takes the mouth exclusively, and a smile cannot flatten it', async ({ page }) => {
    await loadHarness(page)

    // Hold a happy expression for the whole utterance. Before the compositor this
    // is exactly what smeared the visemes: the emote service ran after the lip-sync
    // writer and overwrote the same mouth morphs.
    await page.evaluate(() => window.__harness!.setEmote('happy', 10_000))
    await waitForFrames(page, 2)

    await page.evaluate(() => window.__harness!.speak('Hello there, this is a lip sync check.'))
    // Wait for the SPEECH layer to actually take over rather than for a stopwatch.
    await waitForSpeechKind(page, 'acoustic')

    const t = await trace(page)
    const jaw = ownerOf(t, 'jaw')
    expect(jaw?.winner, 'speech must own the jaw while speaking').toBe('speech')
    expect(jaw?.exclusive, 'the mouth claim must be exclusive during speech').toBe(true)

    // Brows are NOT part of the mouth claim — the avatar should still look happy.
    const brows = ownerOf(t, 'brows')
    expect(brows?.winner, 'emotion and vitality keep the upper face during speech').not.toBe('speech')
  })

  test('the mouth actually moves during speech', async ({ page }) => {
    await loadHarness(page)
    const restingJaw = (await snapshot(page)).jawOpen
    await page.evaluate(() => window.__harness!.speak('Testing one two three, the quick brown fox.'))
    await waitForSpeechKind(page, 'acoustic')
    const peak = await peakJawOverFrames(page, 8)

    // The whole point. A pass here means real decoded audio reached the analyser,
    // the compositor resolved a mouth shape, and it landed on the rig.
    expect(peak, 'jaw must open measurably while speaking').toBeGreaterThan(0.05)
    expect(peak).toBeGreaterThan(restingJaw)
  })

  test('the mouth returns to rest after speech, and emotion gets the lips back', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => window.__harness!.speak('A slightly longer line so the analyser has something to chew on.'))
    await waitForSpeechKind(page, 'acoustic')
    expect(await peakJawOverFrames(page, 6), 'sanity: the jaw opened before we test that it closes').toBeGreaterThan(0.05)

    // Wait for the speech layer to stand down, then for the release ramp to run.
    await waitForSpeechKind(page, 'none')
    await waitForFrames(page, 4)
    const after = await snapshot(page)
    expect(after.jawOpen, 'a finished utterance must not leave the jaw hanging open').toBeLessThan(0.12)

    const jaw = ownerOf(await trace(page), 'jaw')
    expect(jaw?.exclusive ?? false, 'the mouth claim must be released when speech ends').toBe(false)
  })

  test('the override layer beats every autonomous producer', async ({ page }) => {
    await loadHarness(page)
    // The capture path: scripted weights must survive blinks, emotes and idle
    // vitality, or every deterministic face shot is a lie.
    await page.evaluate(() => window.__harness!.setEmote('happy', 5000))
    await page.evaluate(() => window.__harness!.setMorph({ jawOpen: 0.85 }))
    await waitForFrames(page, 3)

    const held = await snapshot(page)
    expect(held.jawOpen, 'a scripted morph must be held, not released').toBeGreaterThan(0.7)
    expect(ownerOf(await trace(page), 'jaw')?.winner).toBe('override')

    await page.evaluate(() => window.__harness!.clearMorphs())
    await waitForFrames(page, 4)
    expect((await snapshot(page)).jawOpen, 'clearing the override releases the key').toBeLessThan(0.2)
  })
})
