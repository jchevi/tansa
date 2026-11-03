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
    ['upper-case RGB()', 'a { color: RGB(0 0 0); }', 'function-disallowed-list'],
    ['device-cmyk()', 'a { color: device-cmyk(0 0 0 1); }', 'function-disallowed-list'],
    ['system color', 'a { color: CanvasText; }', 'declaration-property-value-disallowed-list'],
    [
      'system color in a shorthand',
      'a { border: 1px solid ButtonBorder; }',
      'declaration-property-value-disallowed-list',
    ],
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
        /* A token whose name contains a system color word is not a system color. */
        caret-color: var(--color-field-highlight);
        grid-area: mark;
      }`
    expect(await stylelintRules(code)).toEqual([])
  })

  it.each([
    ['stop-color', 'a { stop-color: Canvas; }'],
    ['flood-color', 'a { flood-color: Canvas; }'],
    ['lighting-color', 'a { lighting-color: Canvas; }'],
    ['-webkit-text-fill-color', 'a { -webkit-text-fill-color: Canvas; }'],
    ['-webkit-text-stroke', 'a { -webkit-text-stroke: 1px Canvas; }'],
    ['a custom property', 'a { --x: Canvas; }'],
  ])('@TAN-29 reports a system color on %s', async (_property, code) => {
    expect(await stylelintRules(code)).toContain('declaration-property-value-disallowed-list')
  })

  // color-named already covered these; kept so a config change can't drop them.
  it.each([
    ['stop-color', 'a { stop-color: white; }'],
    ['a custom property', 'a { --x: white; }'],
  ])('@TAN-29 reports a named color on %s', async (_property, code) => {
    expect(await stylelintRules(code)).toContain('color-named')
  })

  it('@TAN-29 allows a token in a custom property', async () => {
    expect(await stylelintRules('a { --x: var(--color-mark); }')).toEqual([])
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
    ['hex after a quote (inline SVG)', `export const a = "<svg fill='#fff' />"`],
    ['hex after an equals sign', 'export const a = \'<path stroke="#262D3A"\''],
    ['hex in JSX text', 'export const a = <svg><text>#fff</text></svg>'],
    ['a named color on a color property', "export const a = <p style={{ color: 'white' }} />"],
    [
      'a system color on a color property',
      "export const a = { backgroundColor: 'Canvas', fill: 'red' }",
    ],
  ])('@TAN-12 reports %s', async (_kind, code) => {
    expect(await eslintRules(code)).toContain('no-restricted-syntax')
  })

  it('@TAN-12 allows tokens and color keywords on color properties', async () => {
    const code = `export const a = <p style={{
      color: 'var(--color-ink)',
      backgroundColor: 'transparent',
      borderColor: 'currentColor',
      outlineColor: 'inherit',
      fill: 'none',
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-bug) 20%, transparent)',
    }} />`
    expect(await eslintRules(code)).not.toContain('no-restricted-syntax')
  })

  it.each([
    ['a named color in a JSX attribute', 'export const a = <rect fill="red" />'],
    ['a named color in a JSX expression', "export const a = <rect fill={'red'} />"],
    ['a named color in a JSX template', 'export const a = <rect fill={`red`} />'],
    [
      'a named color in a JSX conditional',
      "export const a = (on: boolean) => <rect fill={on ? 'red' : 'none'} />",
    ],
    ['a named color on stopColor', 'export const a = <stop stopColor="white" />'],
    ['a system color on floodColor', 'export const a = <feFlood floodColor="Canvas" />'],
    ['a named color on an SVG color attribute', 'export const a = <svg color="red" />'],
    ['a named color under a quoted key', "export const a = { 'background-color': 'red' }"],
    ['a named color in a template literal', 'export const a = { color: `white` }'],
    [
      'a named color on canvas fillStyle',
      "export const a = (ctx: CanvasRenderingContext2D) => { ctx.fillStyle = 'red' }",
    ],
    [
      'a token string on canvas strokeStyle',
      'export const a = (ctx: CanvasRenderingContext2D) => { ctx.strokeStyle = `var(--color-ink)` }',
    ],
    [
      'a named color in a canvas conditional',
      "export const a = (ctx: CanvasRenderingContext2D, on: boolean, c: string) => { ctx.fillStyle = on ? 'red' : c }",
    ],
    ['named colors in color-mix()', "export const a = 'color-mix(in srgb, white 50%, black)'"],
    [
      'a named color after a percentage in color-mix()',
      "export const a = 'color-mix(in srgb, 20% white, var(--color-ink))'",
    ],
    [
      'a system color after a token in color-mix()',
      "export const a = 'color-mix(in srgb, var(--color-ink) 20%, Canvas)'",
    ],
  ])('@TAN-29 reports %s', async (_kind, code) => {
    expect(await eslintRules(code)).toContain('no-restricted-syntax')
  })

  it.each([
    [
      'keywords and tokens in JSX attributes',
      'export const a = <rect fill="none" stroke="var(--color-ink)" />',
    ],
    [
      'SMIL fill modes',
      'export const a = <svg><animate fill="freeze" /><set fill="remove" /></svg>',
    ],
    [
      'a color prop on a component',
      'const Button = (p: { color: string }) => <b>{p.color}</b>\nexport const a = <Button color="primary" />',
    ],
    [
      'a function call in a JSX attribute',
      "const pick = (name: string) => `var(--color-${name})`\nexport const a = <rect fill={pick('accent')} />",
    ],
    ['a token in a template literal', 'export const a = { color: `var(--color-ink)` }'],
    ['an interpolated template literal', 'export const a = (c: string) => ({ color: `${c}` })'],
    [
      'a variable on canvas fillStyle',
      'export const a = (ctx: CanvasRenderingContext2D, color: string) => { ctx.fillStyle = color }',
    ],
    [
      'color-mix() over tokens in a multi-part shadow',
      "export const a = '0 0 0 2px color-mix(in srgb, var(--color-bug) 20%, transparent), inset 0 0 0 1px var(--color-ink)'",
    ],
    [
      'color-mix() with a hue method',
      "export const a = 'color-mix(in oklch shorter hue, var(--color-ink), var(--color-bug))'",
    ],
  ])('@TAN-29 allows %s', async (_kind, code) => {
    expect(await eslintRules(code)).not.toContain('no-restricted-syntax')
  })
}, 60_000)
