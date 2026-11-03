// Compares a language file with en.json [TAN-13]. Used by locale-parity.test.ts.

export interface Messages {
  [key: string]: string | Messages
}

export interface LocaleDifferences {
  missing: string[]
  extra: string[]
  pluralForms: string[]
  placeholders: string[]
}

// i18next plural keys end in _one, _other... (cardinal) or _ordinal_one... (ordinal).
// A non-plural key must not end in one of these suffixes, or it is read as a plural.
const pluralSuffix = /_(ordinal_)?(zero|one|two|few|many|other)$/
// {{minutes}} and {{minutes, number}} both name the placeholder "minutes".
const placeholder = /\{\{\s*([^,}\s]+)[^}]*\}\}/g

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix + key
    if (typeof value === 'string') entries.set(path, value)
    else for (const entry of flatten(value, `${path}.`)) entries.set(...entry)
  }
  return entries
}

// Groups flattened keys by base name, so notes_one and notes_other are one key: notes.
function byBaseKey(messages: Messages) {
  const groups = new Map<string, { values: string[]; forms: Set<string> }>()
  for (const [key, value] of flatten(messages)) {
    const match = pluralSuffix.exec(key)
    const base = match ? key.slice(0, match.index) : key
    const group = groups.get(base) ?? { values: [], forms: new Set<string>() }
    group.values.push(value)
    if (match) group.forms.add(match[0])
    groups.set(base, group)
  }
  return groups
}

function placeholdersOf(values: string[]) {
  const names = values.flatMap((value) => [...value.matchAll(placeholder)].map((m) => m[1] ?? ''))
  return [...new Set(names)].sort()
}

// Plural forms each language needs, from the browser's own plural rules (CLDR). Spanish
// needs _many and English doesn't. _zero is never required: i18next uses it if present.
function requiredForms(forms: Set<string>, language: string) {
  const required: string[] = []
  for (const type of ['cardinal', 'ordinal'] as const) {
    const prefix = type === 'ordinal' ? '_ordinal_' : '_'
    const used = [...forms].some((form) => form.startsWith('_ordinal_') === (type === 'ordinal'))
    if (!used) continue
    const categories = new Intl.PluralRules(language, { type }).resolvedOptions().pluralCategories
    required.push(...categories.filter((c) => c !== 'zero').map((c) => prefix + c))
  }
  return required
}

export function compareLocales(base: Messages, other: Messages, language: string) {
  const baseKeys = byBaseKey(base)
  const otherKeys = byBaseKey(other)
  const differences: LocaleDifferences = {
    missing: [],
    extra: [],
    pluralForms: [],
    placeholders: [],
  }
  for (const key of baseKeys.keys()) if (!otherKeys.has(key)) differences.missing.push(key)
  for (const [key, group] of otherKeys) {
    const baseGroup = baseKeys.get(key)
    if (!baseGroup) {
      differences.extra.push(key)
      continue
    }
    for (const form of requiredForms(group.forms, language)) {
      if (!group.forms.has(form)) differences.pluralForms.push(key + form)
    }
    const expected = placeholdersOf(baseGroup.values)
    const found = placeholdersOf(group.values)
    if (expected.join() !== found.join()) {
      const list = (names: string[]) => names.map((name) => `{{${name}}}`).join(' ') || 'none'
      differences.placeholders.push(`${key}: expected ${list(expected)}, found ${list(found)}`)
    }
  }
  const { missing, extra, pluralForms, placeholders } = differences
  for (const list of [missing, extra, pluralForms, placeholders]) list.sort()
  return differences
}
