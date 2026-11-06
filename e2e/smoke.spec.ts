import { expect, test } from '@playwright/test'

test('@TAN-10 app loads and shows the app shell', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')

  await expect(page).toHaveTitle('TANSA')
  // Home renders inside main once the local database has opened [TAN-17].
  await expect(page.getByRole('main')).toBeVisible()
  // goto() waits for the load event; fonts are the only work still in flight after it, so a
  // font that fails to load is reported before the errors are read [TAN-31].
  await page.evaluate(() => document.fonts.ready)
  expect(errors).toEqual([])
})
