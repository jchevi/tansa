import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromRoot, read } from './files'
import { frontmatter, lines, section } from './markdown'

const workflowTests = ['review-loop.test.ts', 'workflow-docs.test.ts']
// The repo-level tests: every test file directly in src/ [TAN-113].
const topTests = readdirSync(fromRoot('src')).filter((file) => file.endsWith('.test.ts'))

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
  // is the marker. This file is not scanned, so the literal can be written plainly
  // [TAN-111, TAN-113].
  it('@TAN-111 neither workflow test file parses frontmatter by hand', () => {
    const fence = "'---'"
    for (const file of workflowTests) {
      expect(read(`src/${file}`), `${file} ${fence}`).not.toContain(fence)
    }
  })

  // The repo-level tests read every file the same way, from the repo root [TAN-113].
  it('@TAN-113 the top-level test files read files only through test-utils', () => {
    expect(topTests).toHaveLength(5)
    for (const file of topTests) {
      const source = read(`src/${file}`)
      expect(source, `${file} import.meta.url`).not.toContain('import.meta.url')
      expect(source, `${file} readFileSync`).not.toContain('readFileSync')
      expect(source, `${file} readFile`).not.toMatch(/\breadFile\b|node:fs\/promises/)
      expect(source, `${file} own helper`).not.toMatch(
        /(function|const)\s+(section|read|readBytes|lines|fromRoot|fromSrc)\b/,
      )
    }
  })

  // Only the fixture strings of the frontmatterField test may hold a fence, so a parser
  // splitting on '---', `---` or /^---$/ fails [TAN-113].
  it('@TAN-113 no workflow test file has a frontmatter fence outside the fixture', () => {
    const fixture = "'---\\nname: x\\n---\\n'"
    for (const file of workflowTests) {
      expect(read(`src/${file}`).replaceAll(fixture, ''), file).not.toContain('---')
    }
  })

  it('@TAN-113 the start-of-chat skill, its Steps and the Order line are read in one place', () => {
    const sources = workflowTests.map((file) => read(`src/${file}`)).join('\n')
    const count = (pattern: RegExp) => sources.match(pattern)?.length ?? 0
    expect(count(/start-of-chat\/SKILL\.md/g), 'skill path').toBe(1)
    expect(count(/['"`](## )?Steps['"`]/g), 'Steps').toBe(1)
    for (const text of ['startOfChat().', 'lines(startOfChat())', '= startOfChat()']) {
      expect(sources, text).not.toContain(text)
    }
    expect(count(/(?<!!\w+\.)startsWith\(orderPrefix\)/g), 'startsWith(orderPrefix)').toBe(0)
  })

  // lines() splits on LF and CRLF; a hand split on '\n' leaves a '\r' on every line on
  // Windows [TAN-113].
  it('@TAN-113 no top-level test file splits lines by hand', () => {
    for (const file of topTests) {
      expect(read(`src/${file}`), file).not.toMatch(/\.split\(\s*(['"`][^'"`]*\\n|\/[^/]*\\n)/)
    }
  })
})
