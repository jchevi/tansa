import type { Page } from '@playwright/test'

// The optional Context fields on New session, found inside their group, so the tests also
// prove the fieldset and its legend [TAN-19].
export const contextGroup = (page: Page) => page.getByRole('group', { name: 'Context' })

export const environmentField = (page: Page) =>
  contextGroup(page).getByRole('textbox', { name: 'Environment' })
export const buildField = (page: Page) =>
  contextGroup(page).getByRole('textbox', { name: 'Build or version' })
export const areasField = (page: Page) => contextGroup(page).getByRole('textbox', { name: 'Areas' })
export const testDataField = (page: Page) =>
  contextGroup(page).getByRole('textbox', { name: 'Test data' })

// The Context chips on the Session screen. Terms and chips are found by role, not by CSS,
// so a term removed from the accessibility tree (display: none) is not found.
export const contextRegion = (page: Page) =>
  page.getByRole('region', { name: 'Context', exact: true })
export const contextChips = (page: Page) => contextRegion(page).getByRole('definition')
export const contextTerms = (page: Page) => contextRegion(page).getByRole('term')

export interface ContextValues {
  environment?: string
  build?: string
  areas?: string
  testData?: string
}

export async function fillContext(page: Page, values: ContextValues): Promise<void> {
  if (values.environment !== undefined) await environmentField(page).fill(values.environment)
  if (values.build !== undefined) await buildField(page).fill(values.build)
  if (values.areas !== undefined) await areasField(page).fill(values.areas)
  if (values.testData !== undefined) await testDataField(page).fill(values.testData)
}
