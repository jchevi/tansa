import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('CI and preview config', () => {
  const ci = read('../.github/workflows/ci.yml')
  const wrangler = read('../wrangler.jsonc')

  it('@TAN-11 CI runs every check on pull requests', () => {
    expect(ci).toContain('pull_request:')
    for (const script of [
      'npm run format:check',
      'npm run lint',
      'npm run typecheck',
      'npm run test',
      'npm run build',
      'npm run test:e2e',
    ]) {
      expect(ci).toContain(script)
    }
  })

  it('@TAN-11 CI reads the Node version from .nvmrc', () => {
    expect(ci).toContain('node-version-file: .nvmrc')
  })

  it('@TAN-11 CI keeps the Playwright report as an artifact', () => {
    expect(ci).toContain('actions/upload-artifact')
    expect(ci).toContain('path: playwright-report/')
  })

  it('@TAN-11 previews serve the build output as a single-page app', () => {
    expect(wrangler).toContain('"directory": "./dist"')
    expect(wrangler).toContain('"not_found_handling": "single-page-application"')
    expect(wrangler).toContain('"previews"')
  })
})
