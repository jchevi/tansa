import { expect, test, type Page } from '@playwright/test'
import { durationOption } from './support/duration.ts'
import { fillCharter, openNewSession, sampleCharter, startButton } from './support/charter.ts'
import { readSessions, readTimeSegments } from './support/db.ts'
import {
  endSessionButton,
  mainButton,
  mainMenu,
  mainNavigation,
  sessionTimer,
} from './support/nav.ts'
import { seedSession, setSessionStatus, type SeedSession } from './support/seed.ts'
import { setTabVisibility } from './support/visibility.ts'

// A fixed instant for the fake clock; seeded times are derived from it. The clock is
// installed before the page loads and paused at T, so nothing moves unless a test says so:
// runFor fires every timer due (a ticking display); fastForward fires each due timer at
// most once (a throttled background tab or a sleeping laptop); setSystemTime moves
// Date.now() without firing any timer [TAN-21].
const T = Date.UTC(2026, 9, 28, 10, 0, 0)
const MINUTE = 60_000
const SECOND = 1_000

// The ring is a circle of radius 7: the arc's dash offset is C·(1 − progress).
const RING_CIRCUMFERENCE = 2 * Math.PI * 7
const ringOffset = (elapsedSeconds: number, targetMinutes: number) =>
  RING_CIRCUMFERENCE * (1 - Math.min(1, elapsedSeconds / (targetMinutes * 60)))

const running = (elapsed: number, overrides: Partial<SeedSession> = {}): SeedSession => ({
  status: 'running',
  explore: 'the cart and promo codes',
  createdAt: T - elapsed,
  segments: [{ state: 'running', startedAt: T - elapsed }],
  ...overrides,
})

async function installClock(page: Page, at: number = T) {
  // Installed a minute early: pausing at an instant already past is rejected.
  await page.clock.install({ time: at - MINUTE })
  await page.clock.pauseAt(at)
}

// The app creates the database on its first load, so seed after it, then reload on the
// paused fake clock.
async function openWithSession(page: Page, seed: SeedSession, path = '/session') {
  await page.goto('/history')
  await expect(mainNavigation(page)).toBeVisible()
  await seedSession(page, seed)
  await installClock(page)
  await page.goto(path)
  await expect(sessionTimer(page)).toBeVisible()
}

const expectTimerReads = async (page: Page, elapsed: string, remaining: string) => {
  const timer = sessionTimer(page)
  await expect(timer.getByText(elapsed, { exact: true })).toBeVisible()
  await expect(timer.getByText(`${remaining} left`, { exact: true })).toBeVisible()
}

const ringArc = (page: Page) => sessionTimer(page).locator('.timer-ring-arc')

const parseClock = (text: string) => {
  const [minutes, seconds] = text.split(':').map(Number)
  return (minutes ?? 0) * 60 + (seconds ?? 0)
}

test.describe('Timer is always visible', () => {
  test('@TAN-21 the timer shows elapsed and remaining time and the ensō ring in the navigation', async ({
    page,
  }) => {
    await openWithSession(page, running(37 * MINUTE + 12 * SECOND))

    await expectTimerReads(page, '37:12', '22:48')
    await expect(
      sessionTimer(page).getByRole('img', { name: '37 of 60 minutes elapsed', exact: true }),
    ).toBeVisible()
    const offset = Number(await ringArc(page).getAttribute('stroke-dashoffset'))
    expect(offset).toBeCloseTo(ringOffset(37 * 60 + 12, 60), 2)

    await page.clock.runFor(5 * SECOND)
    await expectTimerReads(page, '37:17', '22:43')
  })

  test('@TAN-21 the timer follows the session on every screen with navigation', async ({
    page,
  }) => {
    await openWithSession(page, running(37 * MINUTE + 12 * SECOND, { targetMinutes: 90 }))

    for (const path of ['/new', '/history', '/settings', '/session']) {
      await page.goto(path)
      await expectTimerReads(page, '37:12', '52:48')
    }

    await page.goto('/')
    await expect(mainMenu(page)).toBeVisible()
    await expect(page.getByRole('banner')).toHaveCount(0)
    await expect(mainButton(page)).toContainText('37:12')
  })

  // An absence test: green before any code. Its locator is the one the tests above prove.
  test('@TAN-21 no timer without a session in progress', async ({ page }) => {
    await page.goto('/history')
    await expect(mainNavigation(page)).toBeVisible()
    await expect(sessionTimer(page)).toHaveCount(0)

    await seedSession(page, {
      status: 'debrief',
      explore: 'the order history',
      createdAt: T,
      segments: [{ state: 'running', startedAt: T, endedAt: T + 30 * MINUTE }],
    })
    await page.reload()
    await expect(mainNavigation(page)).toBeVisible()
    await expect(sessionTimer(page)).toHaveCount(0)
  })

  test('@TAN-21 a new session starts its timer at 00:00', async ({ page }) => {
    await installClock(page)
    await openNewSession(page)
    await fillCharter(page, sampleCharter)
    await durationOption(page, 45).check()
    await startButton(page).click()

    await expect(page).toHaveURL(/\/session$/)
    await expectTimerReads(page, '00:00', '45:00')

    await page.clock.runFor(60 * SECOND)
    await expectTimerReads(page, '01:00', '44:00')
  })

  test('@TAN-21 the timer stays in view when the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 600 })
    const explore = Array.from(
      { length: 12 },
      (_, n) =>
        `step ${String(n + 1)}: apply a promo code, change the quantity and check the total`,
    ).join(', ')
    await openWithSession(page, running(5 * MINUTE, { explore }))

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    await expect(sessionTimer(page)).toBeInViewport()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })

  test('@TAN-21 the remaining time stops at 00:00 left at the target', async ({ page }) => {
    await openWithSession(page, running(60 * MINUTE + 5 * SECOND))

    await expectTimerReads(page, '60:05', '00:00')
    await expect(
      sessionTimer(page).getByRole('img', { name: '60 of 60 minutes elapsed', exact: true }),
    ).toBeVisible()
    expect(Number(await ringArc(page).getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 2)
  })
})

test.describe('Time survives a reload', () => {
  test('@TAN-21 the timer survives a reload and never goes back', async ({ page }) => {
    await installClock(page)
    await openNewSession(page)
    await fillCharter(page, sampleCharter)
    await startButton(page).click()
    await expect(page).toHaveURL(/\/session$/)

    await page.clock.runFor('12:30')
    await expectTimerReads(page, '12:30', '47:30')
    const before = await page.evaluate(() => Date.now())

    await page.reload()

    expect(await page.evaluate(() => Date.now())).toBeGreaterThanOrEqual(before)
    const elapsed = sessionTimer(page).locator('.timer-elapsed')
    await expect(elapsed).toBeVisible()
    const seconds = parseClock(await elapsed.innerText())
    expect(seconds).toBeGreaterThanOrEqual(750)
    expect(seconds).toBeLessThanOrEqual(751)
  })
})

test.describe('Background tab keeps time right', () => {
  test('@TAN-21 coming back to a background tab shows the full time at once', async ({ page }) => {
    await openWithSession(page, running(10 * MINUTE))
    await expectTimerReads(page, '10:00', '50:00')

    await setTabVisibility(page, 'hidden')
    // Five minutes pass and no timer fires: only the return can update the display.
    await page.clock.setSystemTime(T + 5 * MINUTE)
    await setTabVisibility(page, 'visible')

    await expectTimerReads(page, '15:00', '45:00')
  })

  test('@TAN-21 a throttled tab still shows five more minutes', async ({ page }) => {
    await openWithSession(page, running(10 * MINUTE))

    // Due timers fire at most once: a counter would show 10:01.
    await page.clock.fastForward('05:00')

    await expectTimerReads(page, '15:00', '45:00')
  })
})

test.describe('Ending a session before the debrief exists', () => {
  test('@TAN-21 End session moves the session to debrief and shows the placeholder', async ({
    page,
  }) => {
    await openWithSession(page, running(20 * MINUTE))

    await endSessionButton(page).click()

    await expect(page).toHaveURL(/\/debrief$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Debrief', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('The PROOF debrief is coming soon. Your session is saved.', { exact: true }),
    ).toBeVisible()

    const [session] = await readSessions(page)
    expect(session?.status).toBe('debrief')
    expect(session).not.toHaveProperty('closedAt')
    const [segment] = await readTimeSegments(page)
    expect(segment?.endedAt).toBe(T)

    await expect(sessionTimer(page)).toHaveCount(0)
    await expect(
      mainNavigation(page).getByRole('link', { name: 'Session', exact: true }),
    ).toHaveCount(0)

    await page.reload()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Debrief', exact: true }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Back to Home', exact: true }).click()
    await expect(mainButton(page)).toHaveAccessibleName('New session')
  })

  test('@TAN-21 End session is reached with the keyboard', async ({ page }) => {
    await openWithSession(page, running(3 * MINUTE))

    await page.getByRole('link', { name: 'New session', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(endSessionButton(page)).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/debrief$/)
  })

  // An absence test: green before any code. Its locator is the one the tests above prove.
  test('@TAN-21 End session is only on the Session screen', async ({ page }) => {
    await openWithSession(page, running(3 * MINUTE), '/history')
    await expect(endSessionButton(page)).toHaveCount(0)

    await page.goto('/new')
    await expect(sessionTimer(page)).toBeVisible()
    await expect(endSessionButton(page)).toHaveCount(0)
  })

  test('@TAN-21 End session that fails shows an alert and can be retried', async ({ page }) => {
    await openWithSession(page, running(3 * MINUTE))
    // Another tab ends the session; this page still shows it in progress.
    await setSessionStatus(page, 'debrief')

    await endSessionButton(page).click()

    await expect(page.getByRole('alert')).toHaveText('The session could not be ended. Try again.')
    await expect(page).toHaveURL(/\/session$/)
    await expect(endSessionButton(page)).toBeEnabled()
  })

  test('@TAN-21 a double click ends the session once', async ({ page }) => {
    await openWithSession(page, running(3 * MINUTE))
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await endSessionButton(page).dblclick()

    await expect(page).toHaveURL(/\/debrief$/)
    // Reading the store waits for any queued readwrite transaction, so a second end, if
    // one was sent, has settled by now. It would be refused and logged with console.error;
    // its alert could not show, because /debrief has unmounted the button.
    const sessions = await readSessions(page)
    expect(sessions.map((session) => session.status)).toEqual(['debrief'])
    const segments = await readTimeSegments(page)
    expect(segments.map((segment) => segment.endedAt)).toEqual([T])
    expect(errors).toEqual([])
  })
})

test.describe('Reduce motion', () => {
  const arcTransition = (page: Page) =>
    ringArc(page).evaluate((arc) => {
      const style = getComputedStyle(arc)
      return { duration: parseFloat(style.transitionDuration), property: style.transitionProperty }
    })

  // The CSS transition runs on real time, not the fake clock: poll the computed value
  // (not the attribute, which changes at once) until it settles.
  const expectArcSettlesAfterAMinute = async (page: Page) => {
    await page.clock.runFor(60 * SECOND)
    await expect
      .poll(async () =>
        ringArc(page).evaluate((arc) => parseFloat(getComputedStyle(arc).strokeDashoffset)),
      )
      .toBeCloseTo(ringOffset(31 * 60, 60), 2)
  }

  test('@TAN-21 the ensō ring moves without transition under reduce motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openWithSession(page, running(30 * MINUTE))

    // The global rule in base.css: 0.01 ms.
    expect((await arcTransition(page)).duration).toBeLessThan(0.001)
    await expectArcSettlesAfterAMinute(page)
  })

  test('@TAN-21 the ensō ring creeps forward without reduce motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openWithSession(page, running(30 * MINUTE))

    expect(await arcTransition(page)).toEqual({ duration: 1, property: 'stroke-dashoffset' })
    await expectArcSettlesAfterAMinute(page)
  })
})

test.describe('Colors', () => {
  test('@TAN-21 the ring and the timer use the theme tokens', async ({ page }) => {
    await openWithSession(page, running(30 * MINUTE))

    const colors = await sessionTimer(page).evaluate((timer) => {
      // A token's computed color, as the browser resolves it on a probe element.
      const resolve = (token: string) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      const pick = (selector: string) => {
        const element = timer.querySelector(selector)
        if (!element) throw new Error(`${selector} not found`)
        return getComputedStyle(element)
      }
      return {
        arc: pick('.timer-ring-arc').stroke,
        track: pick('.timer-ring-track').stroke,
        elapsed: pick('.timer-elapsed').color,
        remaining: pick('.timer-remaining').color,
        accentStrong: resolve('--color-accent-strong'),
        hair: resolve('--color-hair'),
        ink: resolve('--color-ink'),
        muted: resolve('--color-muted'),
      }
    })

    expect(colors.arc).toBe(colors.accentStrong)
    expect(colors.track).toBe(colors.hair)
    expect(colors.elapsed).toBe(colors.ink)
    expect(colors.remaining).toBe(colors.muted)
  })
})
