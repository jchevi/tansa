import { expect, test, type Page } from '@playwright/test'
import { contrastRatio } from '../src/theme/contrast.ts'
import { compositeToHex, parseCssColor } from './support/color.ts'
import { logoLink, mainButton, mainMenu, mainNavigation, preferences } from './support/nav.ts'
import { seedSession, type SeedSession } from './support/seed.ts'

// A fixed instant for the fake clock; seeded times are derived from it.
const T = Date.UTC(2026, 9, 28, 10, 0, 0)
const MINUTE = 60_000
const SECOND = 1_000

async function openHome(page: Page) {
  await page.goto('/')
  await expect(mainMenu(page)).toBeVisible()
}

// The app creates the database on its first load, so seed after it, then reload. With
// clockAt, the reloaded page runs on a fake clock paused at that instant.
async function openWithSession(page: Page, seed: SeedSession, clockAt?: number) {
  await openHome(page)
  await seedSession(page, seed)
  if (clockAt !== undefined) {
    // Installed a minute early: pausing at an instant already past is rejected.
    await page.clock.install({ time: clockAt - MINUTE })
    await page.clock.pauseAt(clockAt)
  }
  await page.reload()
  await expect(mainMenu(page).or(mainNavigation(page))).toBeVisible()
}

const running = (explore: string, elapsed: number): SeedSession => ({
  status: 'running',
  explore,
  createdAt: T - elapsed,
  segments: [{ state: 'running', startedAt: T - elapsed }],
})

test('@TAN-17 the app opens on Home with only the centered menu', async ({ page }) => {
  await openHome(page)

  const menu = mainMenu(page)
  await expect(menu.getByRole('link', { name: 'New session', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'History', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  // The same locators are shown visible on /history in the navigation details test.
  await expect(mainNavigation(page)).toHaveCount(0)
  await expect(preferences(page)).toHaveCount(0)
})

test('@TAN-17 a running session turns the main button into Resume session', async ({ page }) => {
  await openWithSession(page, running('the cart and promo codes', 37 * MINUTE + 12 * SECOND), T)

  await expect(mainButton(page)).toHaveAccessibleName(
    'Resume session the cart and promo codes · 37:12',
  )
  await expect(mainMenu(page).getByRole('link', { name: 'New session', exact: true })).toBeVisible()

  await page.clock.runFor(5 * SECOND)
  await expect(mainButton(page)).toContainText('37:17')

  // Due timers fire at most once, like a laptop waking from sleep: only time computed from
  // the stored segments shows the full five minutes.
  await page.clock.fastForward('05:00')
  await expect(mainButton(page)).toContainText('42:17')

  await mainButton(page).click()
  await expect(page).toHaveURL(/\/session$/)
})

test('@TAN-17 a paused session also offers Resume session', async ({ page }) => {
  await openWithSession(
    page,
    {
      status: 'paused',
      explore: 'the wish list',
      createdAt: T - 20 * MINUTE,
      segments: [
        { state: 'running', startedAt: T - 20 * MINUTE, endedAt: T - 10 * MINUTE },
        { state: 'paused', startedAt: T - 10 * MINUTE },
      ],
    },
    T,
  )

  await expect(mainButton(page)).toHaveAccessibleName('Resume session the wish list · 10:00')
  await page.clock.runFor(5 * SECOND)
  await expect(mainButton(page)).toContainText('10:00')
})

test('@TAN-17 a long charter stays inside the main button', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  // An unbroken token wraps only with overflow-wrap.
  // Letters and digits only: a hyphen or a slash would give the browser a break point.
  const token =
    'SPRINGSALE2026FREESHIPPINGONALLITEMSWITHNOMINIMUMORDERFORRETURNINGCUSTOMERSINEVERYREGION'
  const explore = `the coupon field when a tester pastes ${token} and then edits the cart quantities, removes an item, adds it back from the wish list, and applies a second code before paying with a saved card`
  await openWithSession(page, running(explore, 5 * MINUTE), T)

  await expect(mainButton(page)).toHaveAccessibleName(`Resume session ${explore} · 05:00`)
  await expect(mainButton(page).locator('time')).toBeInViewport()
  const box = await mainButton(page).boundingBox()
  expect(box && box.x + box.width).toBeLessThanOrEqual(400)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

const notInProgress = [
  { label: 'no session', open: openHome },
  {
    label: 'a session in debrief',
    open: (page: Page) =>
      openWithSession(page, {
        status: 'debrief',
        explore: 'the order history',
        createdAt: T,
        segments: [{ state: 'running', startedAt: T, endedAt: T + 30 * MINUTE }],
      }),
  },
]

for (const { label, open } of notInProgress) {
  test(`@TAN-17 with ${label} the main button is New session`, async ({ page }) => {
    await open(page)

    await expect(mainButton(page)).toHaveAccessibleName('New session')
    await expect(mainMenu(page).getByRole('link', { name: /Resume session/ })).toHaveCount(0)
    await expect(
      mainMenu(page).getByRole('link', { name: 'New session', exact: true }),
    ).toHaveCount(1)
    await mainButton(page).click()
    await expect(page).toHaveURL(/\/new$/)
  })
}

// Each screen reached through its own link on Home.
const fromHomeMenu = (name: string) => async (page: Page) => {
  await openHome(page)
  await mainMenu(page).getByRole('link', { name, exact: true }).click()
}

const screens = [
  { name: 'New session', path: '/new', reach: fromHomeMenu('New session') },
  {
    name: 'Session',
    path: '/session',
    // Reached from Resume session, which needs a session in progress.
    reach: async (page: Page) => {
      await openWithSession(page, running('the product reviews', 3 * MINUTE))
      await mainButton(page).click()
    },
  },
  { name: 'History', path: '/history', reach: fromHomeMenu('History') },
  { name: 'Settings', path: '/settings', reach: fromHomeMenu('Settings') },
]

for (const screen of screens) {
  test(`@TAN-17 the tansa logo goes back to Home from ${screen.name}`, async ({ page }) => {
    await screen.reach(page)
    await expect(page).toHaveURL(new RegExp(`${screen.path}$`))
    await expect(
      page.getByRole('heading', { level: 1, name: screen.name, exact: true }),
    ).toBeVisible()

    await logoLink(page).click()

    await expect(page).toHaveURL(/:\d+\/$/)
    await expect(mainMenu(page)).toBeVisible()
    await expect(mainNavigation(page)).toHaveCount(0)
  })
}

test('@TAN-17 a screen reloaded by its URL still has the navigation', async ({ page }) => {
  await page.goto('/history')

  await expect(page.getByRole('heading', { level: 1, name: 'History', exact: true })).toBeVisible()
  await expect(mainNavigation(page)).toBeVisible()
})

test('@TAN-17 the navigation shows Session only while a session is in progress', async ({
  page,
}) => {
  await page.goto('/history')
  await expect(mainNavigation(page)).toBeVisible()
  const sessionLink = mainNavigation(page).getByRole('link', { name: 'Session', exact: true })
  await expect(sessionLink).toHaveCount(0)

  await seedSession(page, running('the size guide', 2 * MINUTE))
  await page.reload()

  await expect(sessionLink).toBeVisible()
  await sessionLink.click()
  await expect(page).toHaveURL(/\/session$/)
})

test('@TAN-17 the current screen is marked and + opens New session', async ({ page }) => {
  await page.goto('/history')

  await expect(mainNavigation(page)).toBeVisible()
  await expect(preferences(page)).toBeVisible()
  await expect(
    mainNavigation(page).getByRole('link', { name: 'History', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  await page.getByRole('link', { name: 'New session', exact: true }).click()
  await expect(page).toHaveURL(/\/new$/)

  await preferences(page).getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('@TAN-17 the current-screen tint keeps ink readable', async ({ page }) => {
  await page.goto('/history')
  const active = mainNavigation(page).getByRole('link', { name: 'History', exact: true })
  await expect(active).toHaveAttribute('aria-current', 'page')

  const colors = await active.evaluate((link) => {
    const pill = link.closest('nav')
    if (!pill) throw new Error('The active link is not inside a nav')
    return {
      text: getComputedStyle(link).color,
      tint: getComputedStyle(link).backgroundColor,
      pill: getComputedStyle(pill).backgroundColor,
    }
  })
  const pill = parseCssColor(colors.pill)
  const text = parseCssColor(colors.text)
  expect(pill.a).toBe(1)
  expect(text.a).toBe(1)

  const background = compositeToHex(parseCssColor(colors.tint), pill)
  const ink = compositeToHex(text, pill)
  expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(4.5)
})

test('@TAN-17 the browser back button returns to the previous screen', async ({ page }) => {
  await openHome(page)
  await mainMenu(page).getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/\/history$/)

  await page.goBack()

  await expect(mainMenu(page)).toBeVisible()
})

test('@TAN-17 a storage failure shows a message instead of a blank page', async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new Error('Storage blocked by the test')
    }
  })

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('local storage')
})

test('@TAN-17 an unknown path shows Home', async ({ page }) => {
  await page.goto('/nope')

  await expect(mainMenu(page)).toBeVisible()
  await expect(page).toHaveURL(/:\d+\/$/)
})

test('@TAN-17 the 探査 glyphs load from the bundled font', async ({ page }) => {
  await openHome(page)

  const covered = await page.evaluate(async () => {
    await document.fonts.load('400 16px "Zen Kaku Gothic New"', '探査')
    const loaded = [...document.fonts].filter(
      (font) =>
        font.family.replaceAll('"', '') === 'Zen Kaku Gothic New' &&
        font.weight === '400' &&
        font.status === 'loaded',
    )
    return ['U+63A2', 'U+67FB'].map((glyph) =>
      loaded.some((font) => font.unicodeRange.toUpperCase().includes(glyph)),
    )
  })

  expect(covered).toEqual([true, true])
})
