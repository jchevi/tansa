import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
const port = 4173

export default defineConfig({
  // Only e2e/: without this, Playwright also collects the Vitest files in src/.
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // No retries locally, so a flaky test fails in front of you instead of being hidden.
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Chromium only: Edge, the other target browser, runs the same engine.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Tests run against the production bundle, the same one deployed to previews.
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCI,
  },
})
