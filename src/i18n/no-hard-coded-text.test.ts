import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// Lints with the repo's real ESLint config, like src/theme/no-hard-coded-colors.test.ts:
// a misconfigured rule passes everything, so the guard needs a test that proves it fires.

const eslint = new ESLint()
// An existing, non-test file: the rule ignores *.test.* and the project service needs a real path.
const filePath = fileURLToPath(new URL('../App.tsx', import.meta.url))
const textMessage = /^No hard-coded UI text/

const declarations = `
  declare function t(key: string): string
  declare const on: boolean
  declare const name: string | undefined
`

async function lint(code: string) {
  const [result] = await eslint.lintText(`${declarations}\n${code}`, { filePath })
  if (!result) throw new Error('ESLint returned no result')
  return result
}

async function textReports(code: string) {
  const result = await lint(code)
  // A snippet that does not parse reports nothing: fail instead of passing quietly.
  expect(result.fatalErrorCount, result.messages[0]?.message).toBe(0)
  return result.messages.filter((message) => textMessage.test(message.message)).length
}

describe('ESLint forbids hard-coded UI text', () => {
  it.each([
    ['JSX text', 'export const A = () => <p>Save</p>'],
    ['JSX text in another script', 'export const A = () => <p>保存</p>'],
    ['a number with a unit', 'export const A = () => <p>60 min</p>'],
    ['text in a fragment', 'export const A = () => <>Save</>'],
    ['a string child', "export const A = () => <p>{'Save'}</p>"],
    ['a template child', 'export const A = () => <p>{`Save`}</p>'],
    ['a ternary branch', "export const A = () => <p>{on ? t('a') : 'Resume'}</p>"],
    ['the right side of &&', "export const A = () => <p>{on && 'Paused'}</p>"],
    ['the right side of ||', "export const A = () => <p>{name || 'Untitled'}</p>"],
    ['the right side of ??', "export const A = () => <p>{name ?? 'Untitled'}</p>"],
    ['aria-label', 'export const A = () => <button aria-label="Close" />'],
    ['aria-description', 'export const A = () => <div aria-description="Timer" />'],
    ['aria-roledescription', 'export const A = () => <div aria-roledescription="Slide" />'],
    ['aria-placeholder', 'export const A = () => <div aria-placeholder="Search" />'],
    ['aria-valuetext', 'export const A = () => <div aria-valuetext="Half" />'],
    ['title', 'export const A = () => <span title="Help" />'],
    ['alt', 'export const A = () => <img alt="Screenshot" />'],
    ['placeholder', 'export const A = () => <input placeholder="Search" />'],
    [
      'label on a component',
      'declare const F: (p: { label: string }) => null\nexport const A = () => <F label="Explore" />',
    ],
    ['an attribute string in braces', "export const A = () => <button aria-label={'Close'} />"],
    ['an attribute template', 'export const A = () => <button aria-label={`Close`} />'],
    [
      'an attribute ternary branch',
      "export const A = () => <button aria-label={on ? 'Pause' : t('b')} />",
    ],
    ['an attribute fallback', "export const A = () => <button title={name ?? 'Help'} />"],
    ['confirm()', "export const a = () => confirm('Delete this note?')"],
    ['window.alert()', "export const a = () => { window.alert('Saved') }"],
    ['prompt() with a template', 'export const a = () => prompt(`Name?`)'],
  ])('@TAN-13 reports %s', async (_kind, code) => {
    expect(await textReports(code)).toBeGreaterThan(0)
  })

  it.each([
    ['text from t()', "export const A = () => <p>{t('nav.history')}</p>"],
    [
      'an accessible name from t()',
      "export const A = () => <button aria-label={t('nav.newSession')}>+</button>",
    ],
    ['a ternary over t()', "export const A = () => <p>{on ? t('a') : t('b')}</p>"],
    ['a middle dot', 'export const A = () => <p>·</p>'],
    ['a bare number', 'export const A = () => <p>60</p>'],
    ['a space', "export const A = () => <p>{' '}</p>"],
    ['an HTML entity', 'export const A = () => <p>&nbsp;</p>'],
    ['class names', 'export const A = () => <div className="pill" />'],
    ['non-text attributes', 'export const A = () => <input type="text" id="note" />'],
    ['an empty element', 'export const A = () => <main />'],
    ['strings outside JSX', "export const a = 'not rendered'"],
  ])('@TAN-13 allows %s', async (_kind, code) => {
    expect(await textReports(code)).toBe(0)
  })

  it('@TAN-13 keeps the color rule in the same run', async () => {
    // Both guards share no-restricted-syntax: a second config block would replace one.
    const result = await lint("export const A = () => <p style={{ color: 'white' }} />")
    expect(result.messages.map((message) => message.message)).toContain(
      'Color properties take a var(--color-*) token or a keyword (transparent, currentColor, inherit, none).',
    )
  })
}, 60_000)
