import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('workflow docs', () => {
  const claude = read('../CLAUDE.md')
  const decisions = read('../docs/decisions.md')

  it('@TAN-28 CLAUDE.md describes the ticket lifecycle', () => {
    expect(claude).toContain('## Ticket lifecycle')
    for (const step of ['In Progress', 'Delete the branch', 'Done', 'QA', 'git pull']) {
      expect(claude).toContain(step)
    }
  })

  it('@TAN-28 CLAUDE.md and the decision log agree on merge commits', () => {
    expect(claude).toContain('merge commit')
    expect(decisions).toContain('Merge commits only')
  })
})
