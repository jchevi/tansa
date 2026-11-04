import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fromRoot = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url))
const read = (relative: string) => readFileSync(fromRoot(relative), 'utf8')
const lines = (text: string) => text.split(/\r?\n/)

// The verdict line every reviewer ends with. TAN-34's SubagentStop hook parses this exact
// shape, so changing it here means changing the hook too [TAN-33].
const verdictTemplate =
  'VERDICT phase=<plan|code> status=<clean|open> blockers=<n> majors=<n> minors=<n>'

const reviewers = {
  'plan-fidelity-reviewer': 'plan',
  'plan-testability-reviewer': 'plan',
  'code-correctness-reviewer': 'code',
  'code-rules-reviewer': 'code',
} as const
type Reviewer = keyof typeof reviewers

// CLAUDE.md had 68 lines before TAN-33, which may add at most 6. Raising this budget is
// a deliberate decision, not a side effect of another change [TAN-33].
const claudeMdLineBudget = 68 + 6

function frontmatter(markdown: string): Record<string, string> {
  const [first, ...rest] = lines(markdown)
  if (first !== '---') throw new Error('Missing frontmatter')
  const end = rest.indexOf('---')
  if (end === -1) throw new Error('Unclosed frontmatter')
  const fields: Record<string, string> = {}
  for (const line of rest.slice(0, end)) {
    const match = /^([a-zA-Z-]+):\s*(.*)$/.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) fields[match[1]] = match[2].trim()
  }
  return fields
}

const agent = (name: Reviewer) => read(`.claude/agents/${name}.md`)
const names = Object.keys(reviewers) as Reviewer[]

describe('review loop agents', () => {
  it('@TAN-33 the agents folder holds exactly the four reviewers', () => {
    const files = readdirSync(fromRoot('.claude/agents')).filter((file) => file.endsWith('.md'))
    expect(files.sort()).toEqual(names.map((name) => `${name}.md`).sort())
  })

  it.each(names)('@TAN-33 %s is named after its file', (name) => {
    expect(frontmatter(agent(name)).name).toBe(name)
  })

  // Omitting `tools` inherits every tool, Write and Bash included, so the list must exist
  // and hold only read tools. Code reviewers read the diff file the skill writes instead
  // of running git, because a subagent cannot allow only some Bash commands.
  it.each(names)('@TAN-33 %s can only read files', (name) => {
    const tools = frontmatter(agent(name)).tools
    expect(tools).toBeDefined()
    const list = (tools ?? '').split(',').map((tool) => tool.trim())
    expect(list.length).toBeGreaterThan(0)
    for (const tool of list) expect(['Read', 'Grep', 'Glob']).toContain(tool)
  })

  it.each(names)('@TAN-33 %s requires the finding format and the verdict line', (name) => {
    const body = agent(name)
    for (const field of ['**id**', '**severity**', '**evidence**', '**fix**']) {
      expect(body).toContain(field)
    }
    expect(body).toContain('blocker / major / minor')
    // The template alone is not a requirement: the instruction to end with it must be there.
    expect(body).toContain('End with exactly one verdict line, and nothing after it')
    expect(body).toContain(verdictTemplate)
    expect(body).toContain(`phase=${reviewers[name]}`)
    // Without `deferred`, a minor kept as a note reads as reopened and would escalate
    // falsely after two rounds (found in this ticket's own code review).
    expect(body).toContain('`<id>: resolved | reopened | deferred (reason)`')
  })
})

describe('review-loop skill', () => {
  // Read inside each test, so a missing file fails the tests instead of the whole file.
  const skill = () => read('.claude/skills/review-loop/SKILL.md')

  it('@TAN-33 the skill is named review-loop and takes plan or code', () => {
    const fields = frontmatter(skill())
    expect(fields.name).toBe('review-loop')
    expect(fields['argument-hint']).toBe('plan | code')
    expect(skill()).toContain('$ARGUMENTS')
  })

  it.each([
    ['round', 'A round is each distinct plan hash or HEAD SHA within a phase'],
    ['relaunch', 'Relaunching with no change is the same round'],
    ['clean round', 'A round is clean when neither reviewer reports an open blocker or major'],
    ['limit', 'After 3 consecutive open rounds in a phase, stop and ask the owner'],
    ['reset by clean', 'A clean round resets the count'],
    ['owner reset', '`owner-reset`'],
    ['log kept', 'Never delete the log'],
    ['escalation', 'A finding reopened twice'],
    ['deferred', 'deferred minors are not reopened and do not count toward escalation'],
    ['PR line', 'Plan review: <n> rounds, <n> open. Code review: <n> rounds, <n> open.'],
    ['verdict', verdictTemplate],
  ])('@TAN-33 the skill states the %s rule', (_rule, text) => {
    expect(skill()).toContain(text)
  })

  it.each(names)('@TAN-33 the skill launches %s', (name) => {
    expect(skill()).toContain(`\`${name}\``)
  })

  it('@TAN-33 plan and diff files are git-ignored', () => {
    expect(lines(read('.gitignore'))).toContain('.claude/plans/')
  })

  it('@TAN-34 the review log is git-ignored', () => {
    expect(lines(read('.gitignore'))).toContain('.claude/reviews/')
  })

  // Files never added are not in the review diff, so they must count as uncommitted, the
  // same check gate-pr makes (TAN-33 code review minor).
  it('@TAN-34 the code phase checks untracked files too', () => {
    expect(skill()).toContain('`git status --porcelain` must print nothing')
    expect(skill()).not.toContain('--untracked-files=no')
  })

  it('@TAN-34 the skill says the hooks write the log and that a return to an old ref is a new round', () => {
    expect(skill()).toContain(
      'The `SubagentStop` hook (TAN-34) appends one line per reviewer verdict',
    )
    expect(skill()).not.toContain("Until TAN-34's hooks are registered")
    expect(skill()).toContain(
      'Returning to an earlier hash or SHA after a different one starts a new round',
    )
  })
})

describe('workflow docs for the review loop', () => {
  const claude = read('CLAUDE.md')

  it('@TAN-33 CLAUDE.md names both review phases', () => {
    expect(claude).toContain('/review-loop plan')
    expect(claude).toContain('/review-loop code')
  })

  it('@TAN-33 CLAUDE.md stays within its line budget', () => {
    expect(lines(claude.trimEnd()).length).toBeLessThanOrEqual(claudeMdLineBudget)
  })

  it('@TAN-33 the decision log records no AI attribution', () => {
    const row = lines(read('docs/decisions.md')).find((line) =>
      line.includes('No AI attribution in commits or PRs'),
    )
    expect(row).toMatch(/^\| 2026-11-03 \|/)
  })
})
