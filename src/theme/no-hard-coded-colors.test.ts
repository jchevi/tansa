import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'

// These tests lint with the repo's real configs. A misconfigured rule passes everything,
// so the guard itself needs a test that proves it fires.

const fromHere = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const tokensPath = fromHere('./tokens.css')

async function stylelintRules(code: string, codeFilename = fromHere('./sample.css')) {
  const { results } = await stylelint.lint({ code, codeFilename })
  return (results[0]?.warnings ?? []).map((warning) => warning.rule)
}

const eslint = new ESLint()

async function eslintRules(code: string) {
  // An existing file path, so typescript-eslint's project service accepts the text.
  const [result] = await eslint.lintText(code, { filePath: fromHere('../App.tsx') })
  return (result?.messages ?? []).map((message) => message.ruleId)
}

describe('stylelint forbids colors outside tokens.css', () => {
  it.each([
    ['hex', 'a { color: #fff; }', 'color-no-hex'],
    ['named color', 'a { color: white; }', 'color-named'],
    ['rgb()', 'a { color: rgb(0 0 0); }', 'function-disallowed-list'],
    ['rgba()', 'a { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }', 'function-disallowed-list'],
    ['hsla()', 'a { color: hsla(0, 0%, 0%, 0.5); }', 'function-disallowed-list'],
    ['oklch()', 'a { color: oklch(70% 0.1 40); }', 'function-disallowed-list'],
  ])('@TAN-12 reports a %s', async (_kind, code, rule) => {
    expect(await stylelintRules(code)).toContain(rule)
  })

  it('@TAN-12 allows keywords, tokens and color-mix over tokens', async () => {
    const code = `
      a {
        color: var(--color-ink);
        background: transparent;
        border-color: currentColor;
        outline-color: inherit;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-bug) 20%, transparent);
      }`
    expect(await stylelintRules(code)).toEqual([])
  })

  it('@TAN-12 exempts only tokens.css', async () => {
    expect(await stylelintRules(readFileSync(tokensPath, 'utf8'), tokensPath)).toEqual([])
  })
})

describe('eslint forbids colors in TS/TSX', () => {
  it.each([
    ['hex in a JSX style', "export const a = <p style={{ color: '#fff' }} />"],
    ['hex inside a longer string', "export const a = '1px solid #262D3A'"],
    ['hex after a colon', "export const a = 'color:#fff'"],
    ['rgba() in a template literal', 'export const a = `0 1px 2px rgba(0, 0, 0, 0.1)`'],
  ])('@TAN-12 reports %s', async (_kind, code) => {
    expect(await eslintRules(code)).toContain('no-restricted-syntax')
  })

  it('@TAN-12 allows token references', async () => {
    expect(await eslintRules("export const a = 'var(--color-ink)'")).not.toContain(
      'no-restricted-syntax',
    )
  })
}, 60_000)
