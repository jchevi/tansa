import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceFolders = ['features', 'data', 'i18n', 'theme']
const fromSrc = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

describe('project structure', () => {
  it.each(sourceFolders)('@TAN-9 src/%s exists', (folder) => {
    const path = fromSrc(`./${folder}`)
    expect(existsSync(path) && statSync(path).isDirectory()).toBe(true)
  })

  it.each(sourceFolders)('@TAN-9 README documents src/%s', (folder) => {
    const readmePath = fromSrc('../README.md')
    expect(existsSync(readmePath)).toBe(true)
    expect(readFileSync(readmePath, 'utf8')).toContain(`src/${folder}`)
  })

  it('@TAN-10 README states the test data rule', () => {
    const readme = readFileSync(fromSrc('../README.md'), 'utf8')
    expect(readme).toContain('## Test data')
    expect(readme).toContain('No real client names or data')
  })
})
