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
// {{minutes}}, {{minutes, number}} and the unescaped {{- minutes}} all name "minutes".
const placeholder = /\{\{-?\s*([^,}\s]+)[^}]*\}\}/g

// Throws on anything i18next would misread, so a bad file fails the test loudly.
function flatten(messages: Messages, prefix = '', entries = new Map<string, string>()) {
  for (const [key, value] of Object.entries(messages) as [string, unknown][]) {
    const path = prefix + key
    if (entries.has(path)) throw new Error(`${path}: the key appears twice (a dotted key?)`)
    if (typeof value === 'string') entries.set(path, value)
    else if (typeof value === 'object' && value !== null) {
      flatten(value as Messages, `${path}.`, entries)
    } else throw new Error(`${path}: expected a string or an object, found ${String(value)}`)
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
    // A plural in en stays a plural: a flat '{{count}} notas' would read "1 notas".
    const forms = new Set([...baseGroup.forms, ...group.forms])
    for (const form of requiredForms(forms, language)) {
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
