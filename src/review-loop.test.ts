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

// The TAN-33 decoy run found a reviewer citing diff-file lines and the two code reviewers
// rating the same hard-coded color differently. CC-5 (PR #11) found that a stale local
// main adds already-merged commits to the review diff [TAN-56].
describe('reviewer citations, severities and diff base', () => {
  const codeReviewers = names.filter((name) => reviewers[name] === 'code')
  const skill = () => read('.claude/skills/review-loop/SKILL.md')

  it.each(codeReviewers)('@TAN-56 %s checks every cited line number against the file', (name) => {
    const howTo = section(agent(name), 'How to work')
    expect(howTo).toContain(
      'Before reporting, check every cited line number against the file itself',
    )
    expect(howTo).toContain("The diff's line numbers are not file lines")
    // The old wording was already there and did not work; it must not stand in for the new one.
    expect(howTo).not.toContain('(not the diff line)')
  })

  it.each(codeReviewers)('@TAN-56 %s reads a diff against an up-to-date origin/main', (name) => {
    const received = section(agent(name), 'What you receive')
    expect(received).toContain('the branch against an up-to-date `origin/main`')
    expect(received).not.toContain('the branch against `main`')
  })

  it('@TAN-56 code-rules-reviewer rates hard-coded colors and UI text as blockers', () => {
    const severity = lines(section(agent('code-rules-reviewer'), 'Severity'))
    const blocker = severity.find((line) => line.startsWith('- **blocker**:'))
    const major = severity.find((line) => line.startsWith('- **major**:'))
    expect(blocker).toContain('a hard-coded color')
    expect(blocker).toContain('a hard-coded UI string')
    expect(major).toBeDefined()
    expect(major).not.toContain('hard-coded')
  })

  it('@TAN-56 the code phase writes the diff against an up-to-date origin/main', () => {
    const codePhase = section(skill(), 'Code phase')
    const fetch = codePhase.indexOf('`git fetch origin main`')
    const diff = codePhase.indexOf('`git diff origin/main...HEAD > .claude/plans/TAN-<n>.diff`')
    expect(fetch).toBeGreaterThan(-1)
    expect(diff).toBeGreaterThan(fetch)
    expect(codePhase).toContain('If the fetch fails, stop and say so')
    expect(skill()).not.toContain('git diff main...HEAD')
  })
})

// In the TAN-102 plan review four minors were fixed in the plan, because a ticket would only
// have said "write it as planned", but the Stop rule had no exception and the two plan
// reviewers read it differently. Plan-phase minors on text the plan already writes may now be
// fixed in place; code-phase minors are still filed [TAN-107].
describe('minors fixed in the plan', () => {
  const skill = () => read('.claude/skills/review-loop/SKILL.md')
  const planReviewers = names.filter((name) => reviewers[name] === 'plan')
  const codeReviewers = names.filter((name) => reviewers[name] === 'code')
  const minorLine = (name: Reviewer) =>
    lines(section(agent(name), 'Severity')).find((line) => line.startsWith('- **minor**:'))

  it('@TAN-107 the Stop rule lets a plan-phase minor on planned text be fixed in the plan', () => {
    const stop = section(skill(), 'Stop rule')
    for (const text of [
      'with one exception: a plan-phase minor whose fix only changes text or a test the plan already writes',
      '(no new file, test case, step or acceptance criterion) may be fixed in the plan',
      'then run one more round on the fixed plan before presenting it',
      'Every other minor becomes a ticket',
    ]) {
      expect(stop).toContain(text)
    }
  })

  it('@TAN-107 the Stop rule says how the review line reports a fixed minor', () => {
    expect(section(skill(), 'Stop rule')).toContain(
      'List it in the review line after "fixed in plan", by finding id',
    )
    const reviewLine = section(skill(), 'Review line')
    expect(reviewLine).toContain(
      'Minors: <ticket keys, then "fixed in plan" and the finding ids, or none>',
    )
    expect(reviewLine).toContain('Minors: TAN-110; fixed in plan PF-2, PT-3')
  })

  it('@TAN-107 the old unconditional wording is gone and fixed minors are checked, not deferred', () => {
    const stop = section(skill(), 'Stop rule')
    expect(stop).not.toContain('- Minors are not fixed in this PR. Create')
    expect(stop).not.toContain('Pass them to the next round as deferred')
    expect(stop).toContain('Pass the filed ones to the next round as deferred')
    expect(stop).toContain(
      'Pass the fixed ones as fixed, so the reviewer checks that the fix holds',
    )
  })

  it.each(planReviewers)('@TAN-107 %s allows a plan minor to be fixed in the plan', (name) => {
    const minor = minorLine(name)
    expect(minor).toBeDefined()
    expect(minor).toContain(
      '(no new file, test case, step or acceptance criterion) may be fixed in the plan',
    )
    expect(minor).toContain('mark it `resolved` if the fix holds')
  })

  it.each(codeReviewers)('@TAN-107 %s keeps every minor as a ticket', (name) => {
    const minor = minorLine(name)
    expect(minor).toBeDefined()
    expect(minor).toContain('they become follow-up tickets the main agent creates')
    expect(minor).not.toContain('fixed in the plan')
  })

  it('@TAN-107 a Process row records the rule and the TAN-55 row points to it', () => {
    const log = lines(read('docs/decisions.md'))
    const row = log.find((line) => line.startsWith('| 2026-11-26 |') && line.includes('(TAN-107)'))
    expect(row).toBeDefined()
    expect(row).toContain('fixed in the plan')
    expect(row).toContain('write it as planned')
    const tan55 = log.find(
      (line) =>
        line.startsWith('| 2026-11-09 |') &&
        line.includes('Claude files every follow-up as a Jira ticket'),
    )
    expect(tan55).toContain('Superseded in part by the TAN-107 row below')
  })
})
