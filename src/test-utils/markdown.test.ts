import { describe, expect, it } from 'vitest'
import { read } from './files'
import { frontmatter, lines, section } from './markdown'

const workflowTests = ['review-loop.test.ts', 'workflow-docs.test.ts']

// Two frontmatter parsers could drift apart, so both workflow test files read it through
// this module [TAN-110].
describe('shared markdown helpers', () => {
  it('@TAN-110 the workflow tests read frontmatter only through test-utils', () => {
    for (const file of workflowTests) {
      const source = read(`src/${file}`)
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

  // The file and section helpers are shared too, so no copy can drift [TAN-111].
  it('@TAN-111 the workflow tests take section, read, lines and fromRoot from test-utils', () => {
    const imports = {
      files: ['read', 'fromRoot'],
      markdown: ['lines', 'section'],
    }
    for (const file of workflowTests) {
      const source = read(`src/${file}`)
      for (const [module, names] of Object.entries(imports)) {
        for (const name of names) {
          expect(source, `${file} imports ${name}`).toMatch(
            new RegExp(
              `^import \\{[^}]*\\b${name}\\b[^}]*\\} from '\\./test-utils/${module}'`,
              'm',
            ),
          )
        }
      }
      expect(source, `${file} own helper`).not.toMatch(
        /(function|const)\s+(section|read|lines|fromRoot)\b/,
      )
    }
  })

  it('@TAN-111 section returns one section and read resolves from the repo root', () => {
    const text = 'a\n## X\nx\n## Y\ny'
    expect(section(text, 'X')).toContain('x')
    expect(section(text, 'X')).not.toContain('y')
    expect(() => section(text, 'Z')).toThrow('## Z')
    expect(read('package.json')).toContain('"name": "tansa"')
    expect(lines('a\r\nb')).toEqual(['a', 'b'])
  })

  // A copy under another name still splits on the frontmatter fence, so the fence itself
  // is the marker. Built from parts so this file never matches itself [TAN-111].
  it('@TAN-111 neither workflow test file parses frontmatter by hand', () => {
    const fence = ["'", '---', "'"].join('')
    for (const file of workflowTests) {
      expect(read(`src/${file}`), `${file} ${fence}`).not.toContain(fence)
    }
  })
})
