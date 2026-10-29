import { expect, test } from '@playwright/test'

test('@TAN-10 app loads and shows the app shell', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')

  await expect(page).toHaveTitle('TANSA')
  // Attached, not visible: the shell has no content until Home exists, so it has no size.
  await expect(page.getByRole('main')).toBeAttached()
  expect(errors).toEqual([])
})
