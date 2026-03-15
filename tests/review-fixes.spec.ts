import { test, expect, type Page } from '@playwright/test'

async function waitForAppReady(page: Page) {
  await page.waitForSelector('.app-container, div[class*="min-h-screen"]', { timeout: 30000 })
}

test.describe('review fixes', () => {
  test('right-positioned XR chat toggle uses the configured button size for offset', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () => 'Mozilla/5.0 OculusBrowser'
      })

      const originalMatchMedia = window.matchMedia.bind(window)
      window.matchMedia = (query: string) => {
        if (query === '(pointer: coarse)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false
          } as MediaQueryList
        }

        return originalMatchMedia(query)
      }
    })

    await page.goto('/')
    await waitForAppReady(page)

    const chatToggle = page.locator('button').filter({ hasText: '▶' }).first()

    await expect(chatToggle).toBeVisible()

    const styles = await chatToggle.evaluate((element) => {
      const button = element as HTMLButtonElement
      return {
        right: button.style.right,
        minWidth: button.style.minWidth,
        height: button.style.height
      }
    })

    expect(styles).toEqual({
      right: 'calc(-44px + 22rem)',
      minWidth: '44px',
      height: '44px'
    })
  })
})
