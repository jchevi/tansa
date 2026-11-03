// Reads the --color-* tokens from the text of tokens.css. Pure (no file access), so both
// Vitest and Playwright can use it.

// The last declaration of a block may end in } instead of ;.
const DECLARATION = /(--color-[\w-]+)\s*:\s*([^;}]+)[;}]/g
const HEX6 = /^#[0-9a-f]{6}$/i

export function parseColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>()
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')

  for (const [, name = '', rawValue = ''] of withoutComments.matchAll(DECLARATION)) {
    const value = rawValue.trim()
    // Fail loudly: a value the contrast test can't measure must not be skipped silently.
    if (!HEX6.test(value)) {
      throw new Error(
        `${name} must be a #RRGGBB color so its contrast can be checked, got "${value}"`,
      )
    }
    if (tokens.has(name)) {
      throw new Error(`${name} is defined more than once; the parser reads a single theme`)
    }
    tokens.set(name, value)
  }

  return tokens
}
