import { renderToString } from 'react-dom/server'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createI18n } from './config'

// No import of ./index here: it registers a global instance that useTranslation() would
// fall back to. The app instance is tested in app-instance.test.ts.

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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = renderToString(
      <I18nextProvider i18n={createI18n({ dev: true })}>
        <MissingKeyProbe />
      </I18nextProvider>,
    )
    expect(html).toBe('<p>no.such.key</p>')
    // Our warning, not react-i18next's "no instance" one: the provider's instance was used.
    expect(warn.mock.calls).toEqual([['[i18n] Missing key "no.such.key" (en)']])
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

describe('resources', () => {
  it('@TAN-13 a key returns its English string', () => {
    expect(createI18n({ dev: false }).t('app.name')).toBe('tansa')
  })
})
