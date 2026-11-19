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
  withField,
} from './support/charter.ts'
import {
  areasField,
  buildField,
  contextChips,
  contextRegion,
  contextTerms,
  environmentField,
  fillContext,
  testDataField,
} from './support/context.ts'
import { readSessions } from './support/db.ts'

async function start(page: Page) {
  await startButton(page).click()
  await expect(page).toHaveURL(/\/session$/)
  // The Charter region renders only once the stored session has loaded, so checks made
  // after this one see the loaded screen, not the loading one.
  await expect(charterSection(page)).toContainText(sampleCharter.explore)
}

async function onlySession(page: Page) {
  const sessions = await readSessions(page)
  expect(sessions).toHaveLength(1)
  const [session] = sessions
  if (!session) throw new Error('No session stored')
  return session
}

test('@TAN-19 an empty context does not block start', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)

  await expect(startButton(page)).toBeEnabled()
  await expect(charterStatus(page)).toHaveText('Charter complete')

  await start(page)

  const session = await onlySession(page)
  expect(session.areas).toEqual([])
  expect(Object.keys(session)).not.toContain('environment')
  expect(Object.keys(session)).not.toContain('build')
  expect(Object.keys(session)).not.toContain('testData')
  await expect(contextRegion(page)).toHaveCount(0)
})

test('@TAN-19 a filled context does not complete the charter', async ({ page }) => {
  await openNewSession(page)
  await fillContext(page, {
    environment: 'Staging',
    build: '1.4.2',
    areas: 'Cart, checkout',
    testData: 'qa+01@example.com',
  })

  await expect(startButton(page)).toBeDisabled()
  await expect(charterStatus(page)).toHaveText('Missing: Explore, With, To discover')
})

test('@TAN-19 environment and areas are shown as chips', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, { environment: 'Staging', areas: 'Cart, checkout' })

  await start(page)

  await expect(contextChips(page)).toHaveText(['Staging', 'Cart', 'checkout'])
  await expect(contextTerms(page)).toHaveText(['Environment', 'Areas'])

  const session = await onlySession(page)
  expect(session.environment).toBe('Staging')
  expect(session.areas).toEqual(['Cart', 'checkout'])
  expect(Object.keys(session)).not.toContain('build')
  expect(Object.keys(session)).not.toContain('testData')
})

test('@TAN-19 every context field is saved and shown', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, {
    environment: 'Staging',
    build: '1.4.2',
    areas: 'Cart, checkout',
    testData: 'qa+01@example.com · WELCOME10',
  })

  await start(page)

  const chips = ['Staging', '1.4.2', 'Cart', 'checkout', 'qa+01@example.com · WELCOME10']
  await expect(contextChips(page)).toHaveText(chips)
  await expect(contextTerms(page)).toHaveText([
    'Environment',
    'Build or version',
    'Areas',
    'Test data',
  ])

  const session = await onlySession(page)
  expect(session).toMatchObject({
    environment: 'Staging',
    build: '1.4.2',
    areas: ['Cart', 'checkout'],
    testData: 'qa+01@example.com · WELCOME10',
  })

  // Read from storage, not from memory.
  await page.reload()
  await expect(charterSection(page)).toContainText(sampleCharter.explore)
  await expect(contextChips(page)).toHaveText(chips)
})

test('@TAN-19 areas are split by commas and blanks are dropped', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, { areas: 'Cart, , checkout ,' })

  await start(page)

  const session = await onlySession(page)
  expect(session.areas).toEqual(['Cart', 'checkout'])
  await expect(contextChips(page)).toHaveText(['Cart', 'checkout'])
})

test('@TAN-19 areas with only commas and spaces store none', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, { areas: ' , ,' })

  await start(page)

  const session = await onlySession(page)
  expect(session.areas).toEqual([])
  await expect(contextRegion(page)).toHaveCount(0)
})

test('@TAN-19 context values are saved without surrounding blanks', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, {
    environment: '  Staging  ',
    build: '   ',
    testData: '  qa+01@example.com\ncodes WELCOME10  ',
  })

  await start(page)

  const session = await onlySession(page)
  expect(session.environment).toBe('Staging')
  expect(Object.keys(session)).not.toContain('build')
  expect(session.testData).toBe('qa+01@example.com\ncodes WELCOME10')
  await expect(contextChips(page)).toHaveCount(2)
  await expect(contextChips(page).first()).toHaveText('Staging')
  // The chip keeps the line break typed in test data: innerText reflects the rendering, so
  // without white-space: pre-line the two lines would read as one. A regex, because a
  // string expectation collapses whitespace and would pass either way.
  await expect(contextChips(page).last()).toHaveText(/^qa\+01@example\.com\ncodes WELCOME10$/, {
    useInnerText: true,
  })
})

test('@TAN-19 Enter in a one-line context field does not start the session', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)

  await environmentField(page).focus()
  await page.keyboard.type('Staging')
  await page.keyboard.press('Enter')
  await expect(environmentField(page)).toHaveValue('Staging')
  await buildField(page).focus()
  await page.keyboard.type('1.4.2')
  await page.keyboard.press('Enter')
  await expect(buildField(page)).toHaveValue('1.4.2')
  await areasField(page).focus()
  await page.keyboard.type('Cart')
  await page.keyboard.press('Enter')
  await expect(areasField(page)).toHaveValue('Cart')

  await page.keyboard.press('Tab')
  await expect(testDataField(page)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(startButton(page)).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/session$/)
  // An early start on the first Enter would have saved a session without build and areas.
  const session = await onlySession(page)
  expect(session).toMatchObject({ environment: 'Staging', build: '1.4.2', areas: ['Cart'] })
})

test('@TAN-19 the context can be filled with the keyboard', async ({ page }) => {
  await openNewSession(page)

  await exploreField(page).focus()
  await page.keyboard.type(sampleCharter.explore)
  await page.keyboard.press('Tab')
  await expect(withField(page)).toBeFocused()
  await page.keyboard.type(sampleCharter.with)
  await page.keyboard.press('Tab')
  await expect(discoverField(page)).toBeFocused()
  await page.keyboard.type(sampleCharter.discover)

  const steps = [
    { field: environmentField(page), value: 'Staging' },
    { field: buildField(page), value: '1.4.2' },
    { field: areasField(page), value: 'Cart, checkout' },
    { field: testDataField(page), value: 'qa+01@example.com' },
  ]
  for (const { field, value } of steps) {
    await page.keyboard.press('Tab')
    await expect(field).toBeFocused()
    await page.keyboard.type(value)
  }
  await page.keyboard.press('Tab')
  await expect(startButton(page)).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/session$/)
  await expect(contextChips(page)).toHaveText([
    'Staging',
    '1.4.2',
    'Cart',
    'checkout',
    'qa+01@example.com',
  ])
})

test('@TAN-19 context fields have a visible boundary', async ({ page }) => {
  await openNewSession(page)

  for (const field of [
    environmentField(page),
    buildField(page),
    areasField(page),
    testDataField(page),
  ]) {
    await expectVisibleBoundary(field)
  }
})

test('@TAN-19 long context values wrap', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  // Letters and digits only: a hyphen or a slash would give the browser a break point.
  const token =
    'SPRINGSALE2026FREESHIPPINGONALLITEMSWITHNOMINIMUMORDERFORRETURNINGCUSTOMERSINEVERYREGION'
  const long = (start: string) =>
    `${start} ${token} on the checkout of a marketplace with three sellers and a gift card`
  const values = {
    environment: long('staging'),
    build: long('build'),
    areas: long('cart'),
    testData: long('shopper'),
  }
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, values)
  expect(await overflow()).toBe(0)

  await start(page)

  await expect(contextChips(page)).toHaveCount(4)
  for (const chip of await contextChips(page).all()) {
    await expect(chip).toBeVisible()
  }
  expect(await overflow()).toBe(0)
})

// Found in the exploratory session on the preview [TAN-19]: the examples read as values,
// the chips had no visible names, long values broke the chips and the multi-line fields
// could be dragged to any height.

test('@TAN-19 the examples in empty fields cannot be mistaken for values', async ({ page }) => {
  await openNewSession(page)

  for (const field of [
    exploreField(page),
    withField(page),
    discoverField(page),
    environmentField(page),
    buildField(page),
    areasField(page),
    testDataField(page),
  ]) {
    await expect(field).toHaveValue('')
    await expect(field).toHaveAttribute('placeholder', /^e\.g\. \S/)
  }
})

test('@TAN-19 each context value shows its name', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, {
    environment: 'Staging',
    build: '1.4.2',
    areas: 'Cart, checkout',
    testData: 'qa+01@example.com',
  })

  await start(page)

  await expect(contextTerms(page)).toHaveText([
    'Environment',
    'Build or version',
    'Areas',
    'Test data',
  ])
  // Shown, not only read by screen readers: a clipped 1 px term would still count as visible.
  for (const term of await contextTerms(page).all()) {
    await expect(term).toBeVisible()
    const box = await term.boundingBox()
    expect(box?.width).toBeGreaterThan(20)
    expect(box?.height).toBeGreaterThan(10)
  }
})

test('@TAN-19 environment, build and test data are text, areas are chips', async ({ page }) => {
  await openNewSession(page)
  await fillCharter(page, sampleCharter)
  await fillContext(page, {
    environment: 'Staging',
    build: '1.4.2',
    areas: 'Cart, checkout',
    testData: 'qa+01@example.com',
  })

  await start(page)

  // A term spans the whole row, so it measures the width a text value gets.
  const rowWidth = (await contextTerms(page).first().boundingBox())?.width ?? 0
  expect(rowWidth).toBeGreaterThan(200)
  const width = async (index: number) =>
    (await contextChips(page).nth(index).boundingBox())?.width ?? 0
  // Values: Staging, 1.4.2, Cart, checkout, test data.
  for (const index of [0, 1, 4]) {
    expect(await width(index)).toBeGreaterThan(rowWidth * 0.95)
  }
  for (const index of [2, 3]) {
    expect(await width(index)).toBeLessThan(rowWidth * 0.5)
  }
})

test('@TAN-19 multi-line fields keep a minimum and a maximum height', async ({ page }) => {
  await openNewSession(page)
  const manyLines = Array.from({ length: 40 }, (_, n) => `line ${String(n + 1)}`).join('\n')

  for (const field of [
    exploreField(page),
    withField(page),
    discoverField(page),
    testDataField(page),
  ]) {
    // Dragging the resize handle sets an inline height, so the test sets one too.
    const lineHeight = await field.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
    await field.evaluate((el) => {
      el.style.height = '0px'
    })
    expect((await field.boundingBox())?.height).toBeGreaterThanOrEqual(lineHeight)

    await field.evaluate((el) => {
      el.style.height = '3000px'
    })
    expect((await field.boundingBox())?.height).toBeLessThanOrEqual(400)

    await field.fill(manyLines)
    // Past the maximum the field scrolls inside instead of growing.
    expect(await field.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  }
})
