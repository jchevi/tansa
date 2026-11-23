import type { Page } from '@playwright/test'

// Headless Chromium cannot truly send a tab to the background, and the app only reads
// document.visibilityState and the visibilitychange event, so the test sets both [TAN-21].
export async function setTabVisibility(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { value: next, configurable: true })
    Object.defineProperty(document, 'hidden', { value: next === 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}
