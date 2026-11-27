import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { frontmatter } from './markdown'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// Two frontmatter parsers could drift apart, so both workflow test files read it through
// this module [TAN-110].
describe('shared markdown helpers', () => {
  it('@TAN-110 the workflow tests read frontmatter only through test-utils', () => {
    for (const file of ['review-loop.test.ts', 'workflow-docs.test.ts']) {
      const source = read(`../${file}`)
      expect(source, `${file} import`).toMatch(
        /^import \{[^}]*\bfrontmatter(Field)?\b[^}]*\} from '\.\/test-utils\/markdown'/m,
      )
      expect(source, `${file} own parser`).not.toMatch(/(function|const)\s+frontmatter(Field)?\b/)
    }
  })

  it('@TAN-110 frontmatter reads every field and names a missing or unclosed block', () => {
    expect(frontmatter('---\nname: x\nargument-hint: plan | code\n---\n')).toEqual({
      name: 'x',
      'argument-hint': 'plan | code',
    })
    expect(frontmatter('---\r\nname: x\r\n---\r\n')).toEqual({ name: 'x' })
    expect(() => frontmatter('name: x\n')).toThrow('Frontmatter not found')
    expect(() => frontmatter('---\nname: x\n')).toThrow('Unclosed frontmatter')
  })
})
