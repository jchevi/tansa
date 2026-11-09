import { expect, test, type Page } from '@playwright/test'
import { contrastRatio } from '../src/theme/contrast.ts'
import {
  charterSection,
  charterStatus,
  discoverField,
  exploreField,
  fillCharter,
  inProgressNotice,
  sampleCharter,
  startButton,
  withField,
  type CharterValues,
} from './support/charter.ts'
import { compositeToHex, parseCssColor } from './support/color.ts'
import { readSessions, readTimeSegments } from './support/db.ts'
import { mainButton, mainNavigation } from './support/nav.ts'
import { seedSession, type SeedSession } from './support/seed.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MINUTE = 60_000

// New session through the "+" link, as the ticket describes it.
async function openNewSession(page: Page) {
  await page.goto('/history')
  await expect(mainNavigation(page)).toBeVisible()
  await page.getByRole('link', { name: 'New session', exact: true }).click()
  await expect(page).toHaveURL(/\/new$/)
}

// The app creates the database on its first load, so seed after it, then reload.
async function seedAndReload(page: Page, seed: SeedSession) {
  await page.goto('/history')
  await expect(mainNavigation(page)).toBeVisible()
  await seedSession(page, seed)
  await page.reload()
  await expect(mainNavigation(page)).toBeVisible()
}

const seeded = (status: SeedSession['status'], explore: string): SeedSession => {
  const now = Date.now()
  return {
    status,
    explore,
    createdAt: now - 5 * MINUTE,
    segments:
      status === 'paused'
        ? [
            { state: 'running', startedAt: now - 5 * MINUTE, endedAt: now - MINUTE },
            { state: 'paused', startedAt: now - MINUTE },
          ]
        : [{ state: 'running', startedAt: now - 5 * MINUTE }],
  }
}

async function expectCharterShown(page: Page, values: CharterValues) {
  const section = charterSection(page)
  await expect(section).toBeVisible()
  await expect(section).toContainText(values.explore)
  await expect(section).toContainText(values.with)
  await expect(section).toContainText(values.discover)
}

test('@TAN-18 start is blocked until the charter is complete', async ({ page }) => {
  await openNewSession(page)

  await expect(startButton(page)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: Explore, With, To discover')
  // The button is described by the message, so a screen reader hears why it is disabled.
  await expect(startButton(page)).toHaveAccessibleDescription('Missing: Explore, With, To discover')

  await exploreField(page).fill(sampleCharter.explore)
  await expect(charterStatus(page)).toHaveText('Missing: With, To discover')
  await withField(page).fill(sampleCharter.with)
  await expect(charterStatus(page)).toHaveText('Missing: To discover')
  await expect(startButton(page)).toBeDisabled()

  await discoverField(page).fill(sampleCharter.discover)
  await expect(startButton(page)).toBeEnabled()
  await expect(charterStatus(page)).toHaveText('Charter complete')

  await withField(page).fill('')
  await expect(startButton(page)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: With')
})

const fields = [
  { name: 'Explore', key: 'explore' },
  { name: 'With', key: 'with' },
  { name: 'To discover', key: 'discover' },
] as const

for (const field of fields) {
  test(`@TAN-18 an empty ${field.name} alone blocks start`, async ({ page }) => {
    await openNewSession(page)

    await fillCharter(page, { ...sampleCharter, [field.key]: '' })

    await expect(startButton(page)).toBeDisabled()
    await expect(charterStatus(page)).toHaveText(`Missing: ${field.name}`)
  })
}

test('@TAN-18 a complete charter starts a running session', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)

  await startButton(page).click()

  await expect(page).toHaveURL(/\/session$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Session', exact: true })).toBeVisible()
  await expectCharterShown(page, sampleCharter)
  await expect(
    mainNavigation(page).getByRole('link', { name: 'Session', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  const sessions = await readSessions(page)
  expect(sessions).toHaveLength(1)
  const [session] = sessions
  expect(session?.id).toMatch(UUID_V4)
  expect(session?.status).toBe('running')
  expect(session?.charter).toEqual(sampleCharter)
  expect(session?.targetMinutes).toBe(60)
  expect(session?.areas).toEqual([])

  const segments = await readTimeSegments(page)
  expect(segments).toHaveLength(1)
  const [segment] = segments
  expect(segment?.id).toMatch(UUID_V4)
  expect(segment?.sessionId).toBe(session?.id)
  expect(segment?.state).toBe('running')
  expect(segment?.endedAt).toBeUndefined()
  expect(segment?.startedAt).toBe(session?.createdAt)
})

test("@TAN-18 the started session's charter survives a reload", async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await startButton(page).click()
  await expect(page).toHaveURL(/\/session$/)

  await page.reload()

  await expectCharterShown(page, sampleCharter)
  await page.goto('/')
  await expect(mainButton(page)).toContainText('Resume session')
  await expect(mainButton(page)).toContainText(sampleCharter.explore)
})

test('@TAN-18 the charter can be filled and started with the keyboard', async ({ page }) => {
  await openNewSession(page)

  await exploreField(page).focus()
  await page.keyboard.type('the wish list')
  // Enter adds a line inside a field; it does not submit the form.
  await page.keyboard.press('Enter')
  await expect(exploreField(page)).toHaveValue('the wish list\n')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Tab')
  await expect(withField(page)).toBeFocused()
  await page.keyboard.type('a signed-in user')
  await page.keyboard.press('Tab')
  await expect(discoverField(page)).toBeFocused()
  await page.keyboard.type('items lost between devices')
  await page.keyboard.press('Tab')
  await expect(startButton(page)).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/session$/)
  await expectCharterShown(page, {
    explore: 'the wish list',
    with: 'a signed-in user',
    discover: 'items lost between devices',
  })
})

test('@TAN-18 a field with only spaces counts as empty', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, { ...sampleCharter, discover: '   ' })

  await expect(startButton(page)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: To discover')

  await discoverField(page).fill('\t\n ')
  await expect(startButton(page)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: To discover')
})

test('@TAN-18 charter values are saved without surrounding blanks', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, {
    explore: '  the cart  ',
    with: 'a guest account\nand a saved card ',
    discover: ' pricing errors',
  })

  await startButton(page).click()

  await expect(page).toHaveURL(/\/session$/)
  const [session] = await readSessions(page)
  expect(session?.charter).toEqual({
    explore: 'the cart',
    with: 'a guest account\nand a saved card',
    discover: 'pricing errors',
  })
  await expect(charterSection(page)).toContainText('the cart')
})

const blocking = [
  { status: 'running', label: 'running' },
  { status: 'paused', label: 'paused' },
] as const

for (const { status, label } of blocking) {
  test(`@TAN-18 with a ${label} session, + asks to resume or end it first`, async ({ page }) => {
    await seedAndReload(page, seeded(status, 'the gift cards'))

    await page.getByRole('link', { name: 'New session', exact: true }).click()

    await expect(page).toHaveURL(/\/new$/)
    await expect(inProgressNotice(page)).toBeVisible()
    await expect(inProgressNotice(page)).toContainText('Resume it or end it')
    await expect(exploreField(page)).toHaveCount(0)
    await expect(startButton(page)).toHaveCount(0)

    await page.getByRole('main').getByRole('link', { name: 'Resume session', exact: true }).click()
    await expect(page).toHaveURL(/\/session$/)
    await expect(charterSection(page)).toContainText('the gift cards')
  })
}

test('@TAN-18 a session in debrief does not block a new one', async ({ page }) => {
  await seedAndReload(page, seeded('debrief', 'the order history'))

  await page.getByRole('link', { name: 'New session', exact: true }).click()
  await fillCharter(page, sampleCharter)
  await startButton(page).click()

  await expect(page).toHaveURL(/\/session$/)
  await expectCharterShown(page, sampleCharter)
  const sessions = await readSessions(page)
  expect(sessions.map((session) => session.status).sort()).toEqual(['debrief', 'running'])
})

test('@TAN-18 a session started elsewhere after the form opened is not duplicated', async ({
  page,
}) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  // Another tab starts a session while this form is open.
  await seedSession(page, seeded('running', 'the newsletter sign-up'))

  await startButton(page).click()

  await expect(inProgressNotice(page)).toBeVisible()
  const sessions = await readSessions(page)
  expect(sessions.filter((s) => s.status === 'running' || s.status === 'paused')).toHaveLength(1)
  expect(sessions[0]?.charter.explore).toBe('the newsletter sign-up')
  expect(await readTimeSegments(page)).toHaveLength(1)
})

test('@TAN-18 a double click starts only one session', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)

  await startButton(page).dblclick()

  await expect(page).toHaveURL(/\/session$/)
  expect(await readSessions(page)).toHaveLength(1)
  expect(await readTimeSegments(page)).toHaveLength(1)
})

test('@TAN-18 charter fields have a visible boundary', async ({ page }) => {
  await openNewSession(page)

  for (const field of [exploreField(page), withField(page), discoverField(page)]) {
    const colors = await field.evaluate((element) => {
      // The first ancestor (or the field itself) with a painted background is what the
      // border is seen against.
      let behind: Element | null = element
      while (behind) {
        const background = getComputedStyle(behind).backgroundColor
        if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
          return {
            border: getComputedStyle(element).borderTopColor,
            width: parseFloat(getComputedStyle(element).borderTopWidth),
            behind: background,
          }
        }
        behind = behind.parentElement
      }
      throw new Error('No painted background behind the field')
    })
    const behind = parseCssColor(colors.behind)
    expect(behind.a).toBe(1)
    const border = compositeToHex(parseCssColor(colors.border), behind)
    expect(colors.width).toBeGreaterThanOrEqual(1)
    expect(contrastRatio(border, compositeToHex(behind, behind))).toBeGreaterThanOrEqual(3)
  }
})

test('@TAN-18 a long charter wraps on the Session screen', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  // Letters and digits only: a hyphen or a slash would give the browser a break point.
  const token =
    'SPRINGSALE2026FREESHIPPINGONALLITEMSWITHNOMINIMUMORDERFORRETURNINGCUSTOMERSINEVERYREGION'
  const long = (start: string) =>
    `${start} ${token} while the cart holds items from three sellers, one of them out of stock, and the shopper switches currency before paying with a saved card`
  const values = {
    explore: long('the coupon field'),
    with: long('stacked codes'),
    discover: long('rounding errors'),
  }
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  await openNewSession(page)
  await fillCharter(page, values)
  expect(await overflow()).toBe(0)

  await startButton(page).click()

  await expect(page).toHaveURL(/\/session$/)
  await expectCharterShown(page, values)
  expect(await overflow()).toBe(0)
})
