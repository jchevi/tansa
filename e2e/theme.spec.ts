import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { hexToRgb } from '../src/theme/contrast.ts'
import { parseColorTokens } from '../src/theme/read-tokens.ts'

const tokens = parseColorTokens(
  readFileSync(new URL('../src/theme/tokens.css', import.meta.url), 'utf8'),
)

// getComputedStyle reports colors as rgb(r, g, b), never as hex.
function computedRgb(token: string): string {
  const hex = tokens.get(token)
  if (!hex) throw new Error(`${token} is not defined in tokens.css`)
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}

test('@TAN-12 the page uses the background and ink tokens', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('body')).toHaveCSS('background-color', computedRgb('--color-bg'))
  await expect(page.locator('body')).toHaveCSS('color', computedRgb('--color-ink'))
})

test('@TAN-12 the three font families are bundled and load', async ({ page }) => {
  await page.goto('/')

  const faces = [
    { family: 'Zen Maru Gothic', weight: '900' },
    { family: 'Zen Kaku Gothic New', weight: '400' },
    { family: 'IBM Plex Mono', weight: '400' },
  ]
  for (const face of faces) {
    // Not document.fonts.check(): it returns true for a family that was never registered.
    const loaded = await page.evaluate(async ({ family, weight }) => {
      await document.fonts.load(`${weight} 16px "${family}"`)
      return [...document.fonts].some(
        (font) =>
          font.family.replaceAll('"', '') === family &&
          font.weight === weight &&
          font.status === 'loaded',
      )
    }, face)
    expect.soft(loaded, `${face.family} ${face.weight} is loaded`).toBe(true)
  }
})
