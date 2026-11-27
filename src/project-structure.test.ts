import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromRoot, read } from './test-utils/files'
import { lines } from './test-utils/markdown'

const sourceFolders = ['features', 'data', 'i18n', 'theme']

describe('project structure', () => {
  it.each(sourceFolders)('@TAN-9 src/%s exists', (folder) => {
    const path = fromRoot(`src/${folder}`)
    expect(existsSync(path) && statSync(path).isDirectory()).toBe(true)
  })

  it.each(sourceFolders)('@TAN-9 README documents src/%s', (folder) => {
    expect(existsSync(fromRoot('README.md'))).toBe(true)
    expect(read('README.md')).toContain(`src/${folder}`)
  })

  it('@TAN-31 README says lint also runs Stylelint', () => {
    const lintRow = lines(read('README.md')).find((line) => line.startsWith('| `npm run lint`'))
    expect(lintRow).toContain('Stylelint')
  })

  it('@TAN-10 README states the test data rule', () => {
    const readme = read('README.md')
    expect(readme).toContain('## Test data')
    expect(readme).toContain('No real client names or data')
  })
})
