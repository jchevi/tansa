import { expect, test, type Page } from '@playwright/test'
import { expectVisibleBoundary } from './support/boundary.ts'
import {
  charterSection,
  charterStatus,
  discoverField,
  exploreField,
  fillCharter,
  openNewSession,
  sampleCharter,
  startButton,
  startButtonNamed,
} from './support/charter.ts'
import { areasField, buildField, environmentField, testDataField } from './support/context.ts'
import { readSessions } from './support/db.ts'
import { durationGroup, durationOption, durationOptions } from './support/duration.ts'

// The pill a user sees and clicks is the label around the radio; the radio itself is
// transparent on top of it.
const pill = (page: Page, minutes: number) => durationOption(page, minutes).locator('xpath=..')

async function startAndReadTarget(page: Page): Promise<number> {
  await startButton(page).click()
  await expect(page).toHaveURL(/\/session$/)
  await expect(charterSection(page)).toContainText(sampleCharter.explore)
  const sessions = await readSessions(page)
  expect(sessions).toHaveLength(1)
  const [session] = sessions
  if (!session) throw new Error('No session stored')
  return session.targetMinutes
}

test('@TAN-20 60 min is selected when New session opens', async ({ page }) => {
  await openNewSession(page)

  await expect(durationOptions(page)).toHaveCount(4)
  for (const [index, name] of ['45 min', '60 min', '90 min', '120 min'].entries()) {
    await expect(durationOptions(page).nth(index)).toHaveAccessibleName(name)
  }
  await expect(durationOption(page, 60)).toBeChecked()
  for (const minutes of [45, 90, 120]) {
    await expect(durationOption(page, minutes)).not.toBeChecked()
  }
  await expect(startButton(page)).toHaveAccessibleName('Start session · 60 min')
  await expect(startButton(page)).toHaveText('Start session · 60 min →')
})

test('@TAN-20 a session started without choosing has a 60-minute target', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)

  expect(await startAndReadTarget(page)).toBe(60)
})

test('@TAN-20 choosing 90 min updates the button and the session target', async ({ page }) => {
  await openNewSession(page)

  await pill(page, 90).click()

  await expect(durationOption(page, 90)).toBeChecked()
  await expect(durationOption(page, 60)).not.toBeChecked()
  await expect(startButtonNamed(page, 90)).toBeVisible()
  await fillCharter(page, sampleCharter)
  expect(await startAndReadTarget(page)).toBe(90)

  await page.reload()
  await expect(charterSection(page)).toContainText(sampleCharter.explore)
  const [session] = await readSessions(page)
  expect(session?.targetMinutes).toBe(90)
})

for (const minutes of [45, 120]) {
  test(`@TAN-20 choosing ${String(minutes)} min sets its own target`, async ({ page }) => {
    await openNewSession(page)

    await pill(page, minutes).click()

    await expect(startButtonNamed(page, minutes)).toBeVisible()
    await fillCharter(page, sampleCharter)
    expect(await startAndReadTarget(page)).toBe(minutes)
  })
}

test('@TAN-20 the duration can be chosen before the charter is complete', async ({ page }) => {
  await openNewSession(page)

  await pill(page, 120).click()

  await expect(startButtonNamed(page, 120)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: Explore, With, To discover')
  await fillCharter(page, sampleCharter)
  await expect(durationOption(page, 120)).toBeChecked()
  expect(await startAndReadTarget(page)).toBe(120)
})

test('@TAN-20 the duration can be chosen with the keyboard', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await discoverField(page).focus()

  // The group is one Tab stop, on the checked radio.
  await page.keyboard.press('Tab')
  await expect(durationOption(page, 60)).toBeFocused()

  await page.keyboard.press('ArrowRight')
  await expect(durationOption(page, 90)).toBeFocused()
  await expect(durationOption(page, 90)).toBeChecked()
  await expect(startButtonNamed(page, 90)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  // Past the last option the arrows wrap to the first.
  await expect(durationOption(page, 45)).toBeChecked()
  await page.keyboard.press('ArrowLeft')
  await expect(durationOption(page, 120)).toBeChecked()
  await page.keyboard.press('Space')
  await expect(durationOption(page, 120)).toBeChecked()

  for (const field of [
    environmentField(page),
    buildField(page),
    areasField(page),
    testDataField(page),
  ]) {
    await page.keyboard.press('Tab')
    await expect(field).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(startButtonNamed(page, 120)).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/session$/)
  const [session] = await readSessions(page)
  expect(session?.targetMinutes).toBe(120)
})

test('@TAN-20 Enter on a duration does not start the session', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await discoverField(page).focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowRight')
  await expect(durationOption(page, 90)).toBeFocused()

  await page.keyboard.press('Enter')
  await page.keyboard.type('x')

  await expect(page).toHaveURL(/\/new$/)
  await expect(durationOption(page, 90)).toBeChecked()
  for (let step = 0; step < 5; step++) await page.keyboard.press('Tab')
  // After an early start the page would be /session and this button gone: the stored
  // target alone could not tell, since both would be 90.
  await expect(startButtonNamed(page, 90)).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/session$/)
  const sessions = await readSessions(page)
  expect(sessions).toHaveLength(1)
  expect(sessions[0]?.targetMinutes).toBe(90)
})

test('@TAN-20 the duration is announced as a radio group', async ({ page }) => {
  await openNewSession(page)

  await expect(durationGroup(page)).toHaveAccessibleName('Duration')
  for (const minutes of [120, 45, 90]) {
    await pill(page, minutes).click()
    await expect(durationGroup(page).locator('input:checked')).toHaveCount(1)
    await expect(durationOption(page, minutes)).toBeChecked()
  }
  // Transparent, not removed: every radio can still take focus.
  for (const minutes of [45, 60, 90, 120]) {
    await durationOption(page, minutes).focus()
    await expect(durationOption(page, minutes)).toBeFocused()
  }
})

test('@TAN-20 every duration has a visible boundary and the selected one stands out', async ({
  page,
}) => {
  await openNewSession(page)

  for (const minutes of [45, 60, 90, 120]) {
    await expectVisibleBoundary(pill(page, minutes))
  }
  const measure = (minutes: number) =>
    pill(page, minutes).evaluate((label) => ({
      border: parseFloat(getComputedStyle(label).borderTopWidth),
      weight: Number(getComputedStyle(label).fontWeight),
    }))
  const checked = await measure(60)
  const unchecked = await measure(90)
  expect(checked.border).toBeGreaterThan(unchecked.border)
  expect(checked.weight).toBeGreaterThan(unchecked.weight)
})

test('@TAN-20 a focused duration shows the focus ring', async ({ page }) => {
  await openNewSession(page)
  await discoverField(page).focus()

  await page.keyboard.press('Tab')

  await expect(durationOption(page, 60)).toBeFocused()
  await expect(pill(page, 60)).toHaveCSS('outline-style', 'solid')
  await expect(pill(page, 60)).toHaveCSS('outline-width', '2px')

  await exploreField(page).focus()
  await expect(pill(page, 60)).toHaveCSS('outline-style', 'none')
})

test('@TAN-20 the duration options fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await openNewSession(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
  for (const minutes of [45, 60, 90, 120]) {
    await expect(pill(page, minutes)).toBeVisible()
    const box = await pill(page, minutes).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? Infinity) + (box?.width ?? 0)).toBeLessThanOrEqual(320)
  }
})
