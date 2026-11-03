import { describe, expect, it } from 'vitest'
import { parseColorTokens } from './read-tokens.ts'

describe('parseColorTokens', () => {
  it('@TAN-12 reads 6-digit hex color tokens and ignores other tokens and comments', () => {
    const css = `
      :root {
        /* --color-old: #000000; */
        --color-bg: #F3EFE6;
        --color-ink:#262d3a;
        --font-ui: 'Zen Kaku Gothic New', sans-serif;
      }`
    expect(Object.fromEntries(parseColorTokens(css))).toEqual({
      '--color-bg': '#F3EFE6',
      '--color-ink': '#262d3a',
    })
  })

  // Skipping a value it can't measure would let a failing pair pass silently.
  it.each([
    ['an alias', 'var(--color-ink)'],
    ['color-mix', 'color-mix(in srgb, var(--color-bug) 20%, transparent)'],
    ['3-digit hex', '#FFF'],
    ['8-digit hex with alpha', '#E9673A80'],
    ['a color function', 'rgb(0, 0, 0)'],
    ['a named color', 'white'],
  ])('@TAN-12 fails loudly on %s', (_kind, value) => {
    expect(() => parseColorTokens(`:root { --color-x: ${value}; }`)).toThrow('--color-x')
  })

  it('@TAN-12 reads the last declaration of a block even without a semicolon', () => {
    expect([
      ...parseColorTokens(':root { --color-a: #000000; --color-b: #C9532B }').keys(),
    ]).toEqual(['--color-a', '--color-b'])
  })

  it('@TAN-12 fails loudly when a token is defined twice', () => {
    expect(() => parseColorTokens(':root { --color-x: #000000; --color-x: #FFFFFF; }')).toThrow(
      '--color-x',
    )
  })
})
