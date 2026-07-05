import { expect, type Page } from '@playwright/test'

/**
 * Shared driver for the L4 vertical scenario specs (docs/TESTING-PIPELINE.md).
 *
 * Every scenario drives the REAL app (`/`) in offline `directed-responses` mode:
 * the app defaults to llm_provider:'script' when no /config.json and no
 * VITE_LLM_PROVIDER are present (see resolveLLMConfig + defaultLLMConfig), so replies
 * come from apps/web/src/assets/directed-responses.json — deterministic, no LLM.
 *
 * We force script mode defensively via window.__APP_CONFIG__ (honored synchronously by
 * loadRuntimeConfig before first render) and clear any persisted LLM override, so the
 * suite is hermetic regardless of the developer's local settings.
 */

export const DIRECTED_SCRIPT_INIT = `
  try { localStorage.removeItem('ci_avatar_llm_overrides') } catch {}
  // Skip the mic onboarding modal so the chat input is immediately interactive.
  try { localStorage.setItem('ci_avatar_onboarded', 'true') } catch {}
  window.__APP_CONFIG__ = { llm: { llm_provider: 'script' } };
`

/** Selector reused from tests/agent.spec.ts — the app's single chat textarea. */
export const CHAT_INPUT = 'textarea.chat-input, input[type="text"], textarea'

export interface BootedApp {
  errors: string[]
}

/** Boot the real app in script mode and wait for the avatar canvas to come up. */
export async function bootApp(page: Page): Promise<BootedApp> {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`))

  await page.addInitScript(DIRECTED_SCRIPT_INIT)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // App shell + 3D canvas present (same readiness gate as tests/agent.spec.ts).
  await page.waitForSelector('.app-container, div[class*="min-h-screen"]', { timeout: 45_000 })
  await page.waitForSelector('canvas', { timeout: 45_000 })

  // Give the avatar its greet→idle startup a beat to begin animating.
  await page.waitForTimeout(2500)
  return { errors }
}

/** Number of assistant reply bubbles currently rendered in the chat log. */
export async function assistantBubbleCount(page: Page): Promise<number> {
  // ChatBubble labels the assistant turn with the literal text "Assistant".
  return page.getByText('Assistant', { exact: true }).count()
}

/**
 * Send a user turn via the chat input.
 *
 * We fill + press Enter (the ChatInput submits on Enter-without-shift) rather than
 * clicking the round send button: the XR "Exit XR" control in ControlOverlay overlaps
 * the input's bounding box and intercepts pointer events, so a real .click() on the
 * input/button is flaky. `fill()` targets the element directly and needs no clear
 * pointer path, and Enter avoids the overlaid button entirely.
 */
export async function sendTurn(page: Page, message: string): Promise<void> {
  const input = page.locator(CHAT_INPUT).first()
  await input.fill(message)
  await input.press('Enter')
}

/**
 * Send a turn and wait for a NEW assistant bubble to appear. Returns the assistant
 * bubble text once it settles. Throws (fails the test) if no reply appears.
 */
export async function sendAndAwaitReply(page: Page, message: string, timeout = 30_000): Promise<string> {
  const before = await assistantBubbleCount(page)
  await sendTurn(page, message)

  await expect
    .poll(async () => assistantBubbleCount(page), {
      timeout,
      message: `no new assistant reply appeared after sending "${message}"`
    })
    .toBeGreaterThan(before)

  // Grab the last assistant bubble's text (bubble body follows the "Assistant" label).
  const lastAssistant = page.getByText('Assistant', { exact: true }).last()
  const container = lastAssistant.locator('xpath=ancestor::div[1]')
  return (await container.textContent())?.trim() ?? ''
}

/**
 * Best-effort embodiment probe: is the rig MOVING while the avatar replies? We
 * screenshot the canvas repeatedly and report whether any two frames differ.
 *
 * IMPORTANT — this is observational, not a hard gate, and the L4 specs do NOT fail on
 * it. The real app's <Canvas> runs `frameloop="demand"` (Scene3D.tsx) and does not set
 * `preserveDrawingBuffer`, so Playwright's canvas.screenshot() frequently reads an
 * identical/stale framebuffer even while the scene is genuinely animating (verified:
 * idle shows 0/10 frame-pair diffs, a reply ~1/12, though PNG byte-sizes DO shift —
 * i.e. pixels change but screenshots rarely align with a rendered frame). The app also
 * exposes no viseme/emote/animation service state on `window`. The surface built to
 * observe rig motion deterministically is the L3/L5 capture harness
 * (window.__harness + preserveDrawingBuffer), not the real app. See the skipped
 * "embodiment" tests in each vertical spec for the strict assertion + TODO.
 */
export async function canvasFramesDiffer(page: Page, samples = 8, gapMs = 160): Promise<boolean> {
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()

  let prev = await canvas.screenshot()
  for (let i = 0; i < samples; i++) {
    await page.waitForTimeout(gapMs)
    const next = await canvas.screenshot()
    if (Buffer.compare(prev, next) !== 0) return true
    prev = next
  }
  return false
}
