import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resources } from './config'
import { compareLocales, type Messages } from './locale-parity'

const noDifferences = { missing: [], extra: [], pluralForms: [], placeholders: [] }

describe('compareLocales', () => {
  it('@TAN-13 passes equal locales', () => {
    const en = { nav: { history: 'History' } }
    expect(compareLocales(en, { nav: { history: 'Historial' } }, 'es')).toEqual(noDifferences)
  })

  it('@TAN-13 reports a missing key, with its nested path', () => {
    const en = { nav: { history: 'History', session: 'Session' } }
    expect(compareLocales(en, { nav: { history: 'Historial' } }, 'es').missing).toEqual([
      'nav.session',
    ])
  })

  it('@TAN-13 reports an extra key', () => {
    expect(compareLocales({ a: 'A' }, { a: 'A', b: 'B' }, 'es').extra).toEqual(['b'])
  })

  it('@TAN-13 compares plural keys by their base name', () => {
    // Spanish has a "many" form that English lacks: not an extra key.
    const en = { notes_one: '{{count}} note', notes_other: '{{count}} notes' }
    const es = {
      notes_one: '{{count}} nota',
      notes_many: '{{count}} de notas',
      notes_other: '{{count}} notas',
    }
    expect(compareLocales(en, es, 'es')).toEqual(noDifferences)
  })

  it('@TAN-13 reports a missing plural form for the language', () => {
    const en = { notes_one: '{{count}} note', notes_other: '{{count}} notes' }
    const es = { notes_one: '{{count}} nota', notes_other: '{{count}} notas' }
    expect(compareLocales(en, es, 'es').pluralForms).toEqual(['notes_many'])
  })

  it('@TAN-13 accepts an optional zero form', () => {
    const en = { notes_one: '{{count}} note', notes_other: '{{count}} notes' }
    const withZero = { ...en, notes_zero: 'No notes' }
    expect(compareLocales(en, withZero, 'en')).toEqual(noDifferences)
  })

  it('@TAN-13 checks ordinal plural forms separately', () => {
    const en = { place_ordinal_one: '{{count}}st', place_ordinal_other: '{{count}}th' }
    expect(compareLocales(en, en, 'en').pluralForms).toEqual([
      'place_ordinal_few',
      'place_ordinal_two',
    ])
  })

  it('@TAN-13 reads a key ending in a plural suffix as a plural', () => {
    // Documented rule: a non-plural key must not end in _one, _other and so on.
    expect(
      compareLocales({ show_other: 'Other' }, { show_other: 'Otro' }, 'es').pluralForms,
    ).toEqual(['show_many', 'show_one'])
  })

  it('@TAN-13 reports a placeholder mismatch, including formatted ones', () => {
    const en = { left: '{{minutes, number}} min left' }
    expect(compareLocales(en, { left: 'Quedan {{mins}} min' }, 'es').placeholders).toEqual([
      'left: expected {{minutes}}, found {{mins}}',
    ])
  })
})

const localesDir = fileURLToPath(new URL('./locales', import.meta.url))
const languages = readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .sort()
const readLocale = (language: string) =>
  JSON.parse(readFileSync(join(localesDir, `${language}.json`), 'utf8')) as Messages

describe('locale files', () => {
  it('@TAN-13 the locale files are exactly en', () => {
    // With one file the parity check below compares en with itself. Update this list
    // when es.json lands, so the comparison becomes real.
    expect(languages).toEqual(['en'])
  })

  it('@TAN-13 every locale file is registered in the i18n resources', () => {
    expect(languages).toEqual(Object.keys(resources).sort())
  })

  it.each(languages)('@TAN-13 %s has the same keys as en', (language) => {
    expect(compareLocales(readLocale('en'), readLocale(language), language)).toEqual(noDifferences)
  })

  // Written out here, not read from en.json: SBTM terms stay in English in every language.
  const sbtmTerms = {
    charter: 'Charter',
    explore: 'Explore',
    with: 'With',
    toDiscover: 'To discover',
    note: 'Note',
    bug: 'Bug',
    issue: 'Issue',
    proof: 'PROOF',
    tbs: 'TBS',
  }

  it.each(languages)('@TAN-13 SBTM terms are not translated in %s', (language) => {
    expect(readLocale(language).sbtm).toEqual(sbtmTerms)
  })
})
