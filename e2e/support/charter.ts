import type { Page } from '@playwright/test'

// The New session form, located by what a user sees: labels, the button name and the
// status line under the form [TAN-18].
export const exploreField = (page: Page) => page.getByRole('textbox', { name: 'Explore' })
export const withField = (page: Page) => page.getByRole('textbox', { name: 'With' })
export const discoverField = (page: Page) => page.getByRole('textbox', { name: 'To discover' })

export const startButton = (page: Page) => page.getByRole('button', { name: 'Start session' })

export const charterStatus = (page: Page) => page.getByRole('status')

export const inProgressNotice = (page: Page) =>
  page.getByText('A session is already in progress', { exact: false })

// The Charter section of the Session screen.
export const charterSection = (page: Page) => page.getByRole('region', { name: 'Charter' })

export interface CharterValues {
  explore: string
  with: string
  discover: string
}

export const sampleCharter: CharterValues = {
  explore: 'the cart and promo codes',
  with: 'valid, expired and stacked codes',
  discover: 'errors when applying or stacking discounts',
}

export async function fillCharter(page: Page, values: CharterValues): Promise<void> {
  await exploreField(page).fill(values.explore)
  await withField(page).fill(values.with)
  await discoverField(page).fill(values.discover)
}
