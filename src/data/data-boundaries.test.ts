import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// Lints with the repo's real config. The file paths are existing files, so
// typescript-eslint's project service accepts the text; the path decides
// which config blocks apply.
const eslint = new ESLint()
const dataFile = fileURLToPath(new URL('./sessions.ts', import.meta.url))
const appFile = fileURLToPath(new URL('../App.tsx', import.meta.url))

// Asserted by ruleId, never by message count: strictTypeChecked already
// reports a bare fetch('x') as a floating promise, so a count would pass with
// the guard removed.
async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return {
    rules: (result?.messages ?? []).map((message) => message.ruleId),
    fatal: result?.fatalErrorCount ?? 0,
  }
}

const guardRules = ['no-restricted-globals', 'no-restricted-properties', 'no-restricted-imports']

describe('no network in src/data', () => {
  it.each([
    ['fetch', "export const r = fetch('x')", 'no-restricted-globals'],
    ['WebSocket', "export const w = new WebSocket('x')", 'no-restricted-globals'],
    [
      'navigator.sendBeacon',
      "export const b = navigator.sendBeacon('x')",
      'no-restricted-properties',
    ],
    ['window.fetch', "export const f = window.fetch('x')", 'no-restricted-properties'],
    ['a network library', "export { default } from 'axios'", 'no-restricted-imports'],
  ])('@TAN-14 reports %s', async (_name, code, ruleId) => {
    expect((await lint(code, dataFile)).rules).toContain(ruleId)
  })

  it.each([
    ['idb', "export { openDB } from 'idb'"],
    ['a relative module', "export { RecordNotFoundError } from './errors'"],
  ])('@TAN-14 allows importing %s', async (_name, code) => {
    const { rules, fatal } = await lint(code, dataFile)
    expect(fatal).toBe(0)
    for (const rule of guardRules) expect(rules).not.toContain(rule)
  })

  it('@TAN-14 keeps the color guard in data files', async () => {
    expect((await lint("export const c = '#ff0000'", dataFile)).rules).toContain(
      'no-restricted-syntax',
    )
  })
}, 60_000)

describe('IndexedDB only through src/data', () => {
  it('@TAN-14 reports the indexedDB global outside src/data', async () => {
    expect((await lint("export const o = indexedDB.open('x')", appFile)).rules).toContain(
      'no-restricted-globals',
    )
  })

  it('@TAN-14 reports importing idb outside src/data', async () => {
    expect((await lint("export { openDB } from 'idb'", appFile)).rules).toContain(
      'no-restricted-imports',
    )
  })

  it('@TAN-14 allows importing the data layer', async () => {
    const { rules, fatal } = await lint("export { getSession } from './data'", appFile)
    expect(fatal).toBe(0)
    for (const rule of guardRules) expect(rules).not.toContain(rule)
  })
}, 60_000)
