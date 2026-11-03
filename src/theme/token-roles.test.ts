import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseColorTokens } from './read-tokens.ts'
import { decorative, nonTextPairs, textPairs } from './token-roles.ts'

const defined = [
  ...parseColorTokens(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')).keys(),
]
const classified = new Set<string>([...textPairs.flat(), ...nonTextPairs.flat(), ...decorative])

describe('token roles', () => {
  // A new token must be classified, so a text color can't skip the contrast check.
  it.each(defined)('@TAN-12 %s is classified as text, non-text or decorative', (token) => {
    expect(classified).toContain(token)
  })

  // Catches typos and renames in token-roles.ts.
  it.each([...classified])('@TAN-12 %s in token-roles exists in tokens.css', (token) => {
    expect(defined).toContain(token)
  })
})
