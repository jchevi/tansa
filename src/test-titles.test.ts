import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// Lints with the repo's real config, so the rule is proven to fire on Vitest files too.
const eslint = new ESLint()
// An existing test file, so typescript-eslint's project service accepts the text.
const testFile = fileURLToPath(new URL('./ci-config.test.ts', import.meta.url))

async function rules(code: string) {
  const [result] = await eslint.lintText(code, { filePath: testFile })
  return (result?.messages ?? []).map((message) => message.ruleId)
}

describe('Vitest test titles', () => {
  it.each([
    ['it', "import { it } from 'vitest'\nit('adds two numbers', () => {})"],
    ['test', "import { test } from 'vitest'\ntest('adds two numbers', () => {})"],
    ['it.each', "import { it } from 'vitest'\nit.each([1])('adds %s', () => {})"],
  ])('@TAN-31 reports a %s title without the Jira key', async (_kind, code) => {
    expect(await rules(code)).toContain('vitest/valid-title')
  })

  it('@TAN-31 accepts a title that starts with the Jira key', async () => {
    const code =
      "import { describe, it } from 'vitest'\ndescribe('math', () => { it('@TAN-31 adds', () => {}) })"
    expect(await rules(code)).not.toContain('vitest/valid-title')
  })
}, 60_000)
