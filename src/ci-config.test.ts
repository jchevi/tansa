import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// The lines of one job: from "  <name>:" up to the next job or the end of the file.
// Whole lines, so "npm run test" can't be satisfied by "npm run test:e2e".
function jobLines(workflow: string, job: string): string[] {
  const lines = workflow.split(/\r?\n/)
  const start = lines.indexOf(`  ${job}:`)
  if (start === -1) throw new Error(`Job "${job}" not found in ci.yml`)
  const end = lines.findIndex((line, index) => index > start && /^ {2}[\w-]+:$/.test(line))
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

describe('CI and preview config', () => {
  const ci = read('../.github/workflows/ci.yml')
  const wrangler = read('../wrangler.jsonc')

  it('@TAN-11 CI runs on pull requests', () => {
    expect(ci.split(/\r?\n/)).toContain('  pull_request:')
  })

  it.each([
    ['checks', 'npm run format:check'],
    ['checks', 'npm run lint'],
    ['checks', 'npm run typecheck'],
    ['checks', 'npm run test'],
    ['checks', 'npm run build'],
    ['e2e', 'npm run test:e2e'],
  ])('@TAN-11 the %s job runs %s', (job, script) => {
    expect(jobLines(ci, job)).toContain(`- run: ${script}`)
  })

  it('@TAN-11 CI reads the Node version from .nvmrc', () => {
    expect(jobLines(ci, 'checks')).toContain('node-version-file: .nvmrc')
    expect(jobLines(ci, 'e2e')).toContain('node-version-file: .nvmrc')
  })

  it('@TAN-11 CI keeps the Playwright report as an artifact', () => {
    const e2e = jobLines(ci, 'e2e')
    expect(e2e.some((line) => line.startsWith('- uses: actions/upload-artifact@'))).toBe(true)
    expect(e2e).toContain('path: playwright-report/')
  })

  it('@TAN-11 previews serve the build output as a single-page app', () => {
    const settings = wrangler.split(/\r?\n/).map((line) => line.trim())
    expect(settings).toContain('"directory": "./dist",')
    expect(settings).toContain('"not_found_handling": "single-page-application",')
    expect(settings).toContain('"preview_urls": true,')
    expect(settings).toContain('"previews": {},')
  })

  // A tag like @v7 can be moved to other code; a commit SHA can't [TAN-31].
  it('@TAN-31 every action is pinned to a commit SHA', () => {
    const uses = ci
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- uses:'))
    expect(uses.length).toBeGreaterThan(0)
    for (const line of uses) {
      expect(line).toMatch(/^- uses: [\w-]+\/[\w-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/)
    }
  })

  it('@TAN-31 only pull request runs are cancelled by a newer push', () => {
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })

  it('@TAN-31 Dependabot keeps the pinned actions up to date', () => {
    const dependabot = read('../.github/dependabot.yml')
    expect(dependabot).toContain('package-ecosystem: github-actions')
  })
})
