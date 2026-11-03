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

// Every weight imported in fonts.ts, so a new or dropped import can't go unchecked.
const families: Record<string, string> = {
  'zen-maru-gothic': 'Zen Maru Gothic',
  'zen-kaku-gothic-new': 'Zen Kaku Gothic New',
  'ibm-plex-mono': 'IBM Plex Mono',
}
const faces = [
  ...readFileSync(new URL('../src/theme/fonts.ts', import.meta.url), 'utf8').matchAll(
    /^import '@fontsource\/([\w-]+)\/latin-(\d+)\.css'/gm,
  ),
].map(([, slug = '', weight = '']) => {
  const family = families[slug]
  if (!family) throw new Error(`Add the family name of @fontsource/${slug} to theme.spec.ts`)
  return { family, weight }
})

test('@TAN-12 every imported font weight is bundled and loads', async ({ page }) => {
  await page.goto('/')

  // An empty list would pass vacuously.
  expect(faces).toHaveLength(7)
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
