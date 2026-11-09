import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fromRoot = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url))
const read = (relative: string) => readFileSync(fromRoot(relative), 'utf8')
const lines = (text: string) => text.split(/\r?\n/)

// The text of one "## " section, so a phrase found elsewhere in the file doesn't count.
// Same helper as in workflow-docs.test.ts [TAN-55].
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`)
  if (start === -1) throw new Error(`Section "## ${heading}" not found`)
  const end = markdown.indexOf('\n## ', start + 1)
  return markdown.slice(start, end === -1 ? undefined : end)
}

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

  it('@TAN-36 the skill says how to record a raise and that resumes and stalled rounds count', () => {
    expect(skill()).toContain('record it with `record-override.ts`')
    expect(skill()).toContain('Resuming a reviewer with `SendMessage` counts as a launch')
    expect(skill()).toContain('The missing reviewer of the latest round can still be launched')
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

// Follow-ups used to stay as "notes for new tickets" that nobody filed. Claude files them
// itself. The negative checks matter: adding the new sentence next to the old one must
// fail [TAN-55].
describe('follow-up tickets', () => {
  const skill = () => read('.claude/skills/review-loop/SKILL.md')
  const claude = () => read('CLAUDE.md')
  const oldWording = [
    'once the owner creates the tickets',
    'notes for new tickets',
    'a note for a new ticket',
  ]

  it('@TAN-55 the Stop rule says to create the follow-up tickets before gh pr create', () => {
    const stop = section(skill(), 'Stop rule')
    for (const text of [
      'Create the follow-up tickets yourself in Jira',
      'one ticket per area',
      'File plan minors before presenting the plan',
      'code minors before `gh pr create`',
      'write "Minors: none" only when there are none',
    ]) {
      expect(stop).toContain(text)
    }
  })

  it('@TAN-55 the skill no longer leaves the tickets to the owner', () => {
    expect(section(skill(), 'Stop rule')).toContain('the owner does not create them')
    for (const text of oldWording) expect(skill()).not.toContain(text)
  })

  it('@TAN-55 the skill gives the follow-up ticket shape', () => {
    const shape = section(skill(), 'Follow-up tickets')
    for (const text of [
      '**Goal**',
      '**Why**',
      'the finding ids',
      '**Scope**',
      'acceptance criteria in Gherkin',
      '**Verification**',
      'the epic of the area',
      '`tech-debt`',
      '`a11y`',
      '`build-log`',
      'A defect is a Bug',
      'needs a spec decision',
      'add the PR link',
    ]) {
      expect(shape).toContain(text)
    }
  })

  it('@TAN-55 How to work says out-of-scope work becomes a ticket Claude creates', () => {
    const howTo = section(claude(), 'How to work')
    expect(howTo).toContain('becomes a Jira ticket that Claude creates')
    for (const text of oldWording) expect(howTo).not.toContain(text)
  })

  it('@TAN-55 How to work gives a Definition of Done exception a Process row and a ticket', () => {
    const howTo = section(claude(), 'How to work')
    expect(howTo).toContain('An exception to the Definition of Done')
    expect(howTo).toContain(
      'gets its Process row in `docs/decisions.md` and a ticket in the same session',
    )
  })

  it.each(names)('@TAN-55 %s says minors become follow-up tickets', (name) => {
    const body = agent(name)
    expect(body).toContain('they become follow-up tickets the main agent creates')
    expect(body).toContain('a minor the main agent filed as a follow-up ticket')
    expect(body).toContain('a deferred minor is not reopened')
    for (const text of oldWording) expect(body).not.toContain(text)
  })

  it('@TAN-55 the decision log records who files follow-up tickets', () => {
    const log = lines(read('docs/decisions.md'))
    const row = log.find(
      (line) =>
        line.startsWith('| 2026-11-09 |') &&
        line.includes('Claude files every follow-up as a Jira ticket'),
    )
    expect(row).toBeDefined()
    expect(row).toContain('(TAN-55)')
    const reviewLoopRow = log.find((line) => line.includes('Minors become notes for new tickets'))
    expect(reviewLoopRow).toMatch(
      /^\| 2026-11-04 \| \*\(Superseded in part by the TAN-55 row below/,
    )
    expect(log.some((line) => line.includes('(note for a new ticket)'))).toBe(false)
  })
})
