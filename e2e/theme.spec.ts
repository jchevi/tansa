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

// The first Tab on Home lands on the menu's main link [TAN-17]. Home renders after the local
// database opens, so wait for the menu before pressing Tab.
test('@TAN-31 keyboard focus shows a primary-colored ring', async ({ page }) => {
  await page.goto('/')
  const menu = page.getByRole('navigation', { name: 'Main menu', exact: true })
  await expect(menu).toBeVisible()

  await page.keyboard.press('Tab')

  const link = menu.getByRole('link').first()
  await expect(link).toBeFocused()
  await expect(link).toHaveCSS('outline-style', 'solid')
  await expect(link).toHaveCSS('outline-width', '2px')
  await expect(link).toHaveCSS('outline-color', computedRgb('--color-primary'))
})

// Measured with and without the setting, so the reset is proven to come from the media query.
// Order: transition duration, transition delay, animation duration, animation delay (s).
const motionCases = [
  { reducedMotion: 'no-preference', expected: [1, 2, 1, 2] },
  { reducedMotion: 'reduce', expected: [0.00001, 0, 0.00001, 0] },
] as const
for (const { reducedMotion, expected } of motionCases) {
  test(`@TAN-31 motion with reduced motion set to ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/')

    const timing = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.transition = 'opacity 1s 2s'
      probe.style.animation = 'none 1s 2s'
      document.body.append(probe)
      const style = getComputedStyle(probe)
      return [
        style.transitionDuration,
        style.transitionDelay,
        style.animationDuration,
        style.animationDelay,
      ].map((value) => parseFloat(value))
    })

    expect(timing).toEqual(expected)
  })
}

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
