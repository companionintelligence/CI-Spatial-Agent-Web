import { test, expect, type Page } from '@playwright/test'
import { AvatarOptions } from '../packages/core/src/components/scene/avatar/AvatarOptions'

/**
 * L5 — Avatar render matrix (docs/TESTING-PIPELINE.md, P4/P6).
 *
 * Proves every avatar in the catalog actually loads on the real WebGL renderer:
 * for each AvatarOptions key we drive the capture harness (/harness.html), wait for
 * window.__avatarLoaded, and assert (a) no uncaught page error fired while loading and
 * (b) the three.js canvas has a non-zero backing-store size (i.e. a live GL context).
 *
 * The harness mounts the SAME AvatarModel + viseme/emote/animation services the app
 * ships, so a pass here means the model loads, its skeleton resolves a head bone
 * (onHeadLocated → __avatarLoaded), and the renderer produced a frame.
 *
 * We generate one test per key from AvatarOptions (that IS the array
 * window.__harness.listAvatars() returns — verified against the live harness in the
 * first test below, so the roster is never silently hardcoded out of sync).
 */

const AVATAR_KEYS = Object.keys(AvatarOptions)

/** Wait for the harness API to mount, then for the requested avatar to finish loading. */
async function gotoAvatar(page: Page, name: string) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`))

  await page.goto(`/harness.html?avatar=${encodeURIComponent(name)}&shot=body`, {
    waitUntil: 'domcontentloaded'
  })

  await page.waitForFunction(() => (window as unknown as { __harnessReady?: boolean }).__harnessReady === true, {
    timeout: 60_000
  })

  return errors
}

test.describe('L5 · avatar render matrix', () => {
  test('roster: harness.listAvatars() matches AvatarOptions (not hardcoded)', async ({ page }) => {
    const errors = await gotoAvatar(page, AVATAR_KEYS[0])
    // Wait for the first avatar so the harness is fully wired before we read it.
    await page
      .waitForFunction(() => (window as unknown as { __avatarLoaded?: boolean }).__avatarLoaded === true, {
        timeout: 90_000
      })
      .catch(() => {
        /* roster check does not depend on load success */
      })

    const runtimeList = await page.evaluate(
      () => (window as unknown as { __harness?: { listAvatars(): string[] } }).__harness?.listAvatars() ?? []
    )

    // The runtime catalog and the static source the matrix iterates must agree,
    // otherwise the matrix would silently skip newly added avatars.
    expect(new Set(runtimeList)).toEqual(new Set(AVATAR_KEYS))
    expect(runtimeList.length).toBeGreaterThanOrEqual(24)
    expect(errors, `page errors while booting harness:\n${errors.join('\n')}`).toEqual([])
  })

  for (const name of AVATAR_KEYS) {
    test(`loads avatar: ${name}`, async ({ page }) => {
      const errors = await gotoAvatar(page, name)

      // __avatarLoaded flips true only when the model parsed AND its skeleton exposed
      // a head bone (onHeadLocated). A timeout here is a real finding: that avatar does
      // not load/rig on the WebGL renderer.
      await page.waitForFunction(
        () => (window as unknown as { __avatarLoaded?: boolean }).__avatarLoaded === true,
        { timeout: 90_000 }
      )

      // Non-zero backing store == a live WebGL context that produced a frame.
      const canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas') as HTMLCanvasElement | null
        return c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null
      })
      expect(canvas, 'no <canvas> rendered').not.toBeNull()
      expect(canvas!.w).toBeGreaterThan(0)
      expect(canvas!.h).toBeGreaterThan(0)
      expect(canvas!.cw).toBeGreaterThan(0)
      expect(canvas!.ch).toBeGreaterThan(0)

      // No uncaught error fired during load (bad GLTF, missing morphs, shader crash…).
      expect(errors, `page errors while loading "${name}":\n${errors.join('\n')}`).toEqual([])
    })
  }
})
