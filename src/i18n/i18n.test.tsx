import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'
import { I18nextProvider, useTranslation } from 'react-i18next'
import ts from 'typescript'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createI18n } from './config'
import appI18n from './index'

// Not in en.json. Cast to never so the typed t() accepts it: these tests are about runtime.
const missingKey = 'no.such.key' as never

function MissingKeyProbe() {
  const { t } = useTranslation()
  return <p>{t(missingKey)}</p>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('missing keys', () => {
  it('@TAN-13 a missing key returns the key name in development', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(createI18n({ dev: true }).t(missingKey)).toBe('no.such.key')
  })

  it('@TAN-13 a missing key logs a warning in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // A non-plural key: with { count } i18next reports each plural form separately.
    createI18n({ dev: true }).t(missingKey)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[i18n] Missing key "no.such.key" (en)')
  })

  it('@TAN-13 a missing key does not warn in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(createI18n({ dev: false }).t(missingKey)).toBe('no.such.key')
    expect(warn).not.toHaveBeenCalled()
  })

  it('@TAN-13 a component shows the key name for a missing key', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = renderToString(
      <I18nextProvider i18n={createI18n({ dev: true })}>
        <MissingKeyProbe />
      </I18nextProvider>,
    )
    expect(html).toBe('<p>no.such.key</p>')
  })
})

describe('typed keys', () => {
  it('@TAN-13 an unknown key is a compile error', () => {
    // Checked by `npm run typecheck`, not by Vitest. If the key types in i18next.d.ts stop
    // applying, the directive below is unused and tsc fails with TS2578.
    const i18n = createI18n({ dev: false })
    // Control: a known key compiles and is typed as a string, not any.
    expectTypeOf(i18n.t('app.name')).toEqualTypeOf<string>()
    // @ts-expect-error -- 'no.such.key' is not a key of en.json.
    const unknown = i18n.t('no.such.key')
    expect(unknown).toBe('no.such.key')
  })
})

describe('app instance', () => {
  it('@TAN-13 a key returns its English string', () => {
    expect(createI18n({ dev: false }).t('app.name')).toBe('tansa')
  })

  // Importing ./index registers the app instance with react-i18next for the whole test
  // file. Component tests pass their own instance through I18nextProvider instead.
  it('@TAN-13 the app instance is initialized with English', () => {
    expect(appI18n.isInitialized).toBe(true)
    expect(appI18n.language).toBe('en')
    expect(appI18n.t('app.name')).toBe('tansa')
  })

  it('@TAN-13 main.tsx loads the i18n setup', () => {
    // Parsed, not searched as text, so a commented-out import does not count.
    const path = fileURLToPath(new URL('../main.tsx', import.meta.url))
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest)
    const imports = source.statements
      .filter(ts.isImportDeclaration)
      .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)
    expect(imports).toContain('./i18n')
  })
})
