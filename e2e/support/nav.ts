import type { Page } from '@playwright/test'

// Declared once, so the locators that prove the navigation is absent on Home are the same
// ones shown to match on other screens [TAN-17].
export const mainMenu = (page: Page) =>
  page.getByRole('navigation', { name: 'Main menu', exact: true })

export const mainNavigation = (page: Page) =>
  page.getByRole('navigation', { name: 'Main navigation', exact: true })

export const preferences = (page: Page) =>
  page.getByRole('navigation', { name: 'Preferences', exact: true })

export const logoLink = (page: Page) =>
  mainNavigation(page).getByRole('link', { name: 'tansa · Home', exact: true })

// The first link in the Home menu is the main button.
export const mainButton = (page: Page) => mainMenu(page).getByRole('link').first()

// The session timer and End session, in the header (the banner landmark) [TAN-21].
export const sessionTimer = (page: Page) =>
  page.getByRole('banner').getByRole('group', { name: 'Session time', exact: true })

export const endSessionButton = (page: Page) =>
  page.getByRole('button', { name: 'End session', exact: true })
