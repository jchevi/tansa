import type { Page } from '@playwright/test'

// The Duration choice on New session, found by role inside its group, so the tests also
// prove the fieldset, its legend and that the radios stay in the accessibility tree [TAN-20].
export const durationGroup = (page: Page) => page.getByRole('group', { name: 'Duration' })

export const durationOption = (page: Page, minutes: number) =>
  durationGroup(page).getByRole('radio', { name: `${String(minutes)} min`, exact: true })

export const durationOptions = (page: Page) => durationGroup(page).getByRole('radio')
