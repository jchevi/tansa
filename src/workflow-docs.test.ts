import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// The text of one "## " section, so a word found elsewhere in the file doesn't count.
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`)
  if (start === -1) throw new Error(`Section "## ${heading}" not found`)
  const end = markdown.indexOf('\n## ', start + 1)
  return markdown.slice(start, end === -1 ? undefined : end)
}

describe('workflow docs', () => {
  const claude = read('../CLAUDE.md')
  const decisions = read('../docs/decisions.md')
  const lifecycle = section(claude, 'Ticket lifecycle')

  // One numbered step per stage, in order [TAN-31].
  it.each([
    [1, 'In Progress'],
    [2, 'open the PR'],
    [3, 'QA'],
    [4, 'merge commit'],
    [5, 'Delete the branch'],
    [6, 'Done'],
    [7, 'git pull'],
  ])('@TAN-28 lifecycle step %i mentions "%s"', (step, text) => {
    const line = lifecycle.split(/\r?\n/).find((l) => l.startsWith(`${String(step)}. `))
    expect(line).toContain(text)
  })

  it('@TAN-28 CLAUDE.md and the decision log agree on merge commits', () => {
    expect(lifecycle).toContain('Merge with a merge commit (the only method the repo allows)')
    const decision = decisions.split(/\r?\n/).find((l) => l.includes('Merge commits only'))
    expect(decision).toContain('squash and rebase disabled')
  })

  it('@TAN-31 both docs end the bootstrap at the same ticket', () => {
    const bootstrap = 'TAN-9 to TAN-11 bootstrap'
    expect(section(claude, 'Definition of Done')).toContain(bootstrap)
    expect(decisions).toContain(bootstrap)
    expect(claude).toContain('From TAN-12 on, every ticket meets the full Definition of Done')
  })
})
