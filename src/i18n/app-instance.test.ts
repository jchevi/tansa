import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appI18n from './index'

// Importing ./index registers the app instance with react-i18next for this test file.

// Not in en.json. Cast to never so the typed t() accepts it, as in i18n.test.tsx.
const missingKey = 'no.such.key' as never

afterEach(() => {
  vi.restoreAllMocks()
})

describe('app instance', () => {
  it('@TAN-13 the app instance is initialized with English', () => {
    expect(appI18n.isInitialized).toBe(true)
    expect(appI18n.language).toBe('en')
    expect(appI18n.t('app.name')).toBe('tansa')
  })

  it('@TAN-13 the app instance warns about a missing key in development', () => {
    // Vitest runs with import.meta.env.DEV true, like `npm run dev`.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(appI18n.t(missingKey)).toBe('no.such.key')
    expect(warn).toHaveBeenCalledWith('[i18n] Missing key "no.such.key" (en)')
  })

  it('@TAN-13 main.tsx loads the i18n setup before the app', () => {
    // Parsed, not searched as text, so a commented-out import does not count. First, so a
    // t() call at a component's top level never runs before init.
    const path = fileURLToPath(new URL('../main.tsx', import.meta.url))
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest)
    const imports = source.statements
      .filter(ts.isImportDeclaration)
      .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)
    expect(imports).toContain('./i18n')
    expect(imports.indexOf('./i18n')).toBeLessThan(imports.indexOf('./App.tsx'))
  })
})
