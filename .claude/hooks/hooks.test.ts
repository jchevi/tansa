import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { classifyPath, findsPrCommand } from './lib.ts'
import {
  buildTemplate,
  copyRepo,
  git,
  removeScratch,
  runHook,
  writeFile,
  type HookResult,
} from './test-repo.ts'

// Each test spawns node and git a few times; on Windows that is slower than the default.
const timeout = 30_000

const phaseOf = {
  'plan-fidelity-reviewer': 'plan',
  'plan-testability-reviewer': 'plan',
  'code-correctness-reviewer': 'code',
  'code-rules-reviewer': 'code',
} as const
type Reviewer = keyof typeof phaseOf
const planReviewers: Reviewer[] = ['plan-fidelity-reviewer', 'plan-testability-reviewer']
const codeReviewers: Reviewer[] = ['code-correctness-reviewer', 'code-rules-reviewer']
const allHooks = ['record-verdict', 'gate-edits', 'gate-pr', 'gate-rounds']

// The skill's plan hash, computed here and not with lib.ts, so a wrong hash in lib.ts
// cannot agree with itself: sha256 of the plan with CRLF turned into LF.
const hashOf = (text: string) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
const planText = '# TAN-20 plan\n\nFiles: src/a.ts\n'
const planFile = '.claude/plans/TAN-20.md'
const logFile = '.claude/reviews/TAN-20.jsonl'

let template = ''
beforeAll(() => {
  template = buildTemplate()
})
afterAll(() => {
  removeScratch()
})
const repo = () => copyRepo(template)

function verdict(reviewer: Reviewer, ref: string, status: 'clean' | 'open' = 'clean'): string {
  return JSON.stringify({
    type: 'verdict',
    ticket: 'TAN-20',
    phase: phaseOf[reviewer],
    reviewer,
    round: 1,
    ref,
    status,
    blockers: 0,
    majors: status === 'open' ? 1 : 0,
    minors: 0,
    time: '2026-11-04T12:00:00Z',
  })
}
const reset = (phase: 'plan' | 'code') =>
  JSON.stringify({ type: 'owner-reset', phase, time: '2026-11-04T12:00:00Z' })

// One round: both reviewers of the phase on one ref.
const round = (reviewers: Reviewer[], ref: string, status: 'clean' | 'open') =>
  reviewers.map((reviewer) => verdict(reviewer, ref, status))

function writeLog(dir: string, ...lines: string[]): void {
  writeFile(dir, logFile, lines.map((line) => `${line}\n`).join(''))
}
function readLogLines(dir: string): Record<string, unknown>[] {
  const file = path.join(dir, logFile)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

// A plan reviewed clean by both plan reviewers.
function planned(dir: string): void {
  writeFile(dir, planFile, planText)
  writeLog(dir, ...round(planReviewers, hashOf(planText), 'clean'))
}
// HEAD reviewed clean by both code reviewers.
function reviewedHead(dir: string, ...earlier: string[]): void {
  writeLog(dir, ...earlier, ...round(codeReviewers, git(dir, 'rev-parse', 'HEAD'), 'clean'))
}
function commit(dir: string, file: string, text: string): void {
  writeFile(dir, file, text)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', `change ${file}`)
}

const edit = (cwd: string, file: string, tool = 'Write') => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: tool,
  tool_input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file },
})
const shell = (cwd: string, command: string, tool = 'Bash') => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: tool,
  tool_input: { command },
})
const launch = (cwd: string, agent: string) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Agent',
  tool_input: { subagent_type: agent, description: 'Review', prompt: 'Review the plan.' },
})
const stop = (cwd: string, reviewer: string, message: string, active = false) => ({
  hook_event_name: 'SubagentStop',
  cwd,
  agent_type: reviewer,
  agent_id: 'a1',
  stop_hook_active: active,
  last_assistant_message: message,
})
const verdictLine = (phase: string, status = 'clean', majors = 0) =>
  `VERDICT phase=${phase} status=${status} blockers=0 majors=${String(majors)} minors=1`
const review = (phase: string, status = 'clean', majors = 0) =>
  `### Findings\n\nNone open.\n\n${verdictLine(phase, status, majors)}`

// A deny only counts in this exact shape: Claude Code ignores a decision anywhere else.
function expectDenied(result: HookResult, reason: string): void {
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: expect.stringContaining(reason) as unknown,
    },
  })
}
function expectAllowed(result: HookResult): void {
  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toBe('')
}
function expectBlocked(result: HookResult, reason: string): void {
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    decision: 'block',
    reason: expect.stringContaining(reason) as unknown,
  })
}

describe('gate-edits', { timeout }, () => {
  it('@TAN-34 a src/ write is denied when no plan review exists', () => {
    const dir = repo()
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), '/review-loop plan')
    writeFile(dir, planFile, planText)
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), '/review-loop plan')
  })

  it('@TAN-34 a src/ write is denied on a branch with no key', () => {
    const dir = repo()
    git(dir, 'checkout', '-q', '-b', 'feature-x')
    planned(dir)
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), 'TAN-<n>')
  })

  it('@TAN-34 a src/ write is denied when only one plan reviewer is clean', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    writeLog(dir, verdict('plan-fidelity-reviewer', hashOf(planText)))
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), '/review-loop plan')
    writeLog(
      dir,
      verdict('plan-fidelity-reviewer', hashOf(planText)),
      verdict('plan-testability-reviewer', hashOf(planText), 'open'),
    )
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), '/review-loop plan')
  })

  it.each([
    ['Write', 'src/a.ts'],
    ['Edit', 'e2e/a.spec.ts'],
    ['MultiEdit', 'src/b.ts'],
    ['NotebookEdit', 'src/n.ipynb'],
  ])(
    '@TAN-34 a %s under src/ or e2e/ is allowed when both plan reviewers are clean on the current plan hash',
    (tool, file) => {
      const dir = repo()
      planned(dir)
      expectAllowed(runHook('gate-edits', edit(dir, file, tool)))
    },
  )

  it('@TAN-34 changing the plan after a clean review denies src/ edits again', () => {
    const dir = repo()
    planned(dir)
    writeFile(dir, planFile, planText.replace(/\n/g, '\r\n'))
    // A line-ending change is not a content change.
    expectAllowed(runHook('gate-edits', edit(dir, 'src/a.ts')))
    writeFile(dir, planFile, `${planText}\nAlso: src/b.ts\n`)
    expectDenied(runHook('gate-edits', edit(dir, 'src/a.ts')), '/review-loop plan')
  })

  it('@TAN-34 a docs/ edit is allowed with no plan review', () => {
    const dir = repo()
    expectAllowed(runHook('gate-edits', edit(dir, 'docs/spec.md', 'Edit')))
  })

  it.each(['Write', 'Edit', 'MultiEdit'])('@TAN-34 %s under .claude/reviews/ is denied', (tool) => {
    const dir = repo()
    planned(dir)
    expectDenied(runHook('gate-edits', edit(dir, logFile, tool)), 'record-verdict')
    git(dir, 'checkout', '-q', '-b', 'feature-x')
    expectDenied(runHook('gate-edits', edit(dir, logFile, tool)), 'record-verdict')
  })

  it('@TAN-34 a relative path is resolved from a cwd inside the repo', () => {
    const dir = repo()
    mkdirSync(path.join(dir, 'docs'))
    const cwd = path.join(dir, 'docs')
    expectDenied(runHook('gate-edits', edit(cwd, '../src/a.ts')), '/review-loop plan')
    expectAllowed(runHook('gate-edits', edit(cwd, 'guide.md')))
  })

  it('@TAN-34 a hook importing lib.ts runs under node', () => {
    const result = runHook('gate-edits', edit(repo(), 'README.md'))
    expectAllowed(result)
  })
})

describe('path classification', () => {
  it.each([
    ['posix', 'src/a.ts', 'gated'],
    ['posix', 'e2e/a.spec.ts', 'gated'],
    ['posix', 'docs/../src/a.ts', 'gated'],
    ['posix', '/repo/src/a.ts', 'gated'],
    ['posix', '.claude/reviews/TAN-20.jsonl', 'log'],
    ['posix', 'srcfoo/x.ts', 'free'],
    ['posix', 'src2/x.ts', 'free'],
    ['posix', 'docs/src/a.ts', 'free'],
    ['posix', 'README.md', 'free'],
    ['posix', '/elsewhere/src/a.ts', 'free'],
    ['posix', '../src/a.ts', 'free'],
    ['win32', 'src\\a.ts', 'gated'],
    ['win32', 'C:\\repo\\src\\a.ts', 'gated'],
    ['win32', 'C:/repo/e2e/a.spec.ts', 'gated'],
    // Windows paths are case-insensitive, so these name the same folders.
    ['win32', 'SRC\\a.ts', 'gated'],
    ['win32', '.Claude\\Reviews\\x.jsonl', 'log'],
    ['win32', 'srcfoo\\x.ts', 'free'],
    ['win32', 'D:\\repo\\src\\a.ts', 'free'],
  ] as const)('@TAN-34 classifies a %s path %s as %s', (platform, file, kind) => {
    const p = path[platform]
    const root = platform === 'win32' ? 'C:\\repo' : '/repo'
    expect(classifyPath(p, root, root, file)).toBe(kind)
  })
})

describe('gate-pr', { timeout }, () => {
  it('@TAN-34 gh pr merge is denied when the clean code review is for an older SHA', () => {
    const dir = repo()
    reviewedHead(dir)
    commit(dir, 'docs/a.md', 'later\n')
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr merge 12 --merge')), '/review-loop code')
  })

  it.each(['Bash', 'PowerShell'])(
    '@TAN-34 gh pr merge is allowed from %s when HEAD is reviewed clean',
    (tool) => {
      const dir = repo()
      reviewedHead(dir)
      expectAllowed(runHook('gate-pr', shell(dir, 'gh pr merge 12 --merge', tool)))
    },
  )

  it('@TAN-34 gh pr merge is denied with a modified tracked file', () => {
    const dir = repo()
    reviewedHead(dir)
    writeFile(dir, 'README.md', '# Changed\n')
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr create --fill')), 'Commit')
  })

  it('@TAN-34 gh pr merge is denied with an untracked file the review never saw', () => {
    const dir = repo()
    reviewedHead(dir)
    writeFile(dir, 'src/new.ts', 'export {}\n')
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr merge 12')), 'untracked')
  })

  it('@TAN-34 gh pr merge is denied when only one code reviewer is clean on HEAD', () => {
    const dir = repo()
    const head = git(dir, 'rev-parse', 'HEAD')
    writeLog(dir, verdict('code-correctness-reviewer', head))
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr merge 12')), '/review-loop code')
    writeLog(
      dir,
      verdict('code-correctness-reviewer', head),
      verdict('code-rules-reviewer', head, 'open'),
    )
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr merge 12')), '/review-loop code')
  })

  it('@TAN-34 a command without gh pr create or merge is allowed with no review', () => {
    expectAllowed(runHook('gate-pr', shell(repo(), 'ls -la && git status')))
  })
})

describe('command matching', () => {
  it.each([
    'gh pr merge',
    'gh pr create --fill',
    'npm test && gh pr merge 12',
    'npm test; gh pr merge 12',
    'false || gh pr create',
    'echo y | gh pr merge 12',
    'npm test\ngh pr merge 12',
    'gh.exe pr merge 12',
    '& gh pr merge 12',
    '& "gh" pr merge 12',
    '& "C:\\Program Files\\GitHub CLI\\gh.exe" pr create',
    'gh -R owner/repo pr merge 12',
    'gh --repo=owner/repo pr create',
  ])('@TAN-34 finds gh pr create or merge in %j', (command) => {
    expect(findsPrCommand(command)).toBe(true)
  })

  it.each(['gh pr list', 'echo gh pr merge', 'gh prs', 'ghx pr merge', 'gh pr view 12', 'ls'])(
    '@TAN-34 does not match %j',
    (command) => {
      expect(findsPrCommand(command)).toBe(false)
    },
  )
})

describe('gate-rounds', { timeout }, () => {
  const openRounds = (reviewers: Reviewer[], count: number) =>
    Array.from({ length: count }, (_, n) => round(reviewers, `ref-${String(n)}`, 'open')).flat()

  it.each([
    ['plan', planReviewers],
    ['code', codeReviewers],
  ] as const)(
    '@TAN-34 a %s reviewer launch is denied after three consecutive open rounds',
    (_phase, reviewers) => {
      const dir = repo()
      writeLog(dir, ...openRounds(reviewers, 3))
      expectDenied(runHook('gate-rounds', launch(dir, reviewers[0] ?? '')), 'ask the owner')
    },
  )

  it('@TAN-34 two open rounds still allow a reviewer launch', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(planReviewers, 2))
    expectAllowed(runHook('gate-rounds', launch(dir, 'plan-fidelity-reviewer')))
  })

  it('@TAN-34 an incomplete round after three open rounds does not restart the count', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(planReviewers, 3), verdict('plan-fidelity-reviewer', 'ref-x'))
    expectDenied(runHook('gate-rounds', launch(dir, 'plan-fidelity-reviewer')), 'ask the owner')
  })

  it('@TAN-34 an incomplete round is not counted as open', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(planReviewers, 2), verdict('plan-fidelity-reviewer', 'ref-x'))
    expectAllowed(runHook('gate-rounds', launch(dir, 'plan-fidelity-reviewer')))
  })

  it('@TAN-34 relaunching reviewers on the same ref stays in the same round', () => {
    const dir = repo()
    writeLog(
      dir,
      ...openRounds(planReviewers, 2),
      ...round(planReviewers, 'ref-1', 'open'),
      ...round(planReviewers, 'ref-1', 'open'),
      ...round(planReviewers, 'ref-1', 'open'),
    )
    expectAllowed(runHook('gate-rounds', launch(dir, 'plan-testability-reviewer')))
  })

  it('@TAN-34 a clean round restarts the count', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(planReviewers, 3), ...round(planReviewers, 'ref-c', 'clean'))
    expectAllowed(runHook('gate-rounds', launch(dir, 'plan-fidelity-reviewer')))
  })

  it('@TAN-34 an owner-reset line restarts the count', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(codeReviewers, 3), reset('code'))
    expectAllowed(runHook('gate-rounds', launch(dir, 'code-rules-reviewer')))
  })

  it('@TAN-34 a launch that is not a reviewer is allowed after three open rounds', () => {
    const dir = repo()
    writeLog(dir, ...openRounds(planReviewers, 3))
    expectAllowed(runHook('gate-rounds', launch(dir, 'Explore')))
  })
})

describe('no key on the branch', { timeout }, () => {
  it('@TAN-34 gh pr merge and a reviewer launch are denied on a branch with no key', () => {
    const dir = repo()
    git(dir, 'checkout', '-q', 'main')
    expectDenied(runHook('gate-pr', shell(dir, 'gh pr merge 12')), 'TAN-<n>')
    expectDenied(runHook('gate-rounds', launch(dir, 'code-rules-reviewer')), 'TAN-<n>')
  })
})

describe('record-verdict', { timeout }, () => {
  it.each([
    ['plain', review('plan', 'open', 1)],
    ['trailing spaces', `${review('plan', 'open', 1)}   `],
    ['CRLF', `${review('plan', 'open', 1)}\r\n`.replace(/\n/g, '\r\n')],
  ])('@TAN-34 a valid verdict is appended to the log (%s)', (_kind, message) => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    expectAllowed(runHook('record-verdict', stop(dir, 'plan-fidelity-reviewer', message)))
    expect(readLogLines(dir)).toEqual([
      {
        type: 'verdict',
        ticket: 'TAN-20',
        phase: 'plan',
        reviewer: 'plan-fidelity-reviewer',
        round: 1,
        ref: hashOf(planText),
        status: 'open',
        blockers: 0,
        majors: 1,
        minors: 1,
        time: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) as unknown,
      },
    ])
  })

  it('@TAN-34 relaunching reviewers on the same plan hash stores the same round', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    for (const reviewer of planReviewers) {
      runHook('record-verdict', stop(dir, reviewer, review('plan', 'open', 1)))
    }
    runHook('record-verdict', stop(dir, 'plan-fidelity-reviewer', review('plan', 'open', 1)))
    writeFile(dir, planFile, `${planText}\nChanged.\n`)
    runHook('record-verdict', stop(dir, 'plan-fidelity-reviewer', review('plan')))
    expect(readLogLines(dir).map((line) => line.round)).toEqual([1, 1, 1, 2])
  })

  // In the desktop app a subagent ends by calling SubagentHandback with its report, so
  // last_assistant_message is empty and the verdict is only in the agent's transcript.
  const transcript = (dir: string, ...content: unknown[]) => {
    const file = path.join(dir, 'agent-transcript.jsonl')
    writeFile(
      dir,
      'agent-transcript.jsonl',
      content
        .map((block) =>
          JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [block] } }),
        )
        .join('\n'),
    )
    return file
  }
  const handback = (message: string) => ({
    type: 'tool_use',
    name: 'SubagentHandback',
    input: { message },
  })

  it('@TAN-34 a verdict handed back through SubagentHandback is read from the agent transcript', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    const file = transcript(
      dir,
      { type: 'text', text: 'Reading the plan.' },
      { type: 'thinking', thinking: 'VERDICT phase=plan status=open blockers=9 majors=9 minors=9' },
      handback(review('plan')),
    )
    const input = { ...stop(dir, 'plan-fidelity-reviewer', ''), agent_transcript_path: file }
    expectAllowed(runHook('record-verdict', input))
    expect(readLogLines(dir)).toMatchObject([{ status: 'clean', ref: hashOf(planText) }])
  })

  it('@TAN-34 a transcript without a verdict still blocks the reviewer', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    const file = transcript(dir, handback('Done, no verdict.'))
    const input = { ...stop(dir, 'plan-fidelity-reviewer', ''), agent_transcript_path: file }
    expectBlocked(runHook('record-verdict', input), 'VERDICT phase=plan status=<clean|open>')
    expect(readLogLines(dir)).toEqual([])
  })

  it('@TAN-34 a code verdict is recorded on the HEAD SHA', () => {
    const dir = repo()
    runHook('record-verdict', stop(dir, 'code-rules-reviewer', review('code')))
    expect(readLogLines(dir)[0]).toMatchObject({
      phase: 'code',
      ref: git(dir, 'rev-parse', 'HEAD'),
      status: 'clean',
    })
  })

  it.each([
    ['no verdict', '### Findings\n\nNone.'],
    ['a fence after the verdict', `\`\`\`\n${verdictLine('plan')}\n\`\`\``],
    ['text after the verdict', `${verdictLine('plan')}\n\nThanks.`],
    ['the wrong phase', review('code')],
    ['two verdict lines', `${verdictLine('plan', 'open', 1)}\n${verdictLine('plan')}`],
    ['a clean status with majors', review('plan', 'clean', 2)],
  ])('@TAN-34 a review with %s blocks the reviewer once', (_kind, message) => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    expectBlocked(
      runHook('record-verdict', stop(dir, 'plan-fidelity-reviewer', message)),
      'VERDICT phase=plan status=<clean|open>',
    )
    expect(readLogLines(dir)).toEqual([])
  })

  it('@TAN-34 a second stop with stop_hook_active does not block again', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    const result = runHook(
      'record-verdict',
      stop(dir, 'plan-fidelity-reviewer', 'No verdict.', true),
    )
    expectAllowed(result)
    expect(result.stderr).toContain('not logged')
    expect(readLogLines(dir)).toEqual([])
  })

  it('@TAN-34 a subagent that is not a reviewer is left alone', () => {
    const dir = repo()
    expectAllowed(runHook('record-verdict', stop(dir, 'Explore', 'Done.')))
    expect(readLogLines(dir)).toEqual([])
  })
})

describe('end to end inside Vitest', { timeout }, () => {
  it('@TAN-34 verdicts recorded by record-verdict open the gates', () => {
    const dir = repo()
    writeFile(dir, planFile, planText)
    runHook('record-verdict', stop(dir, 'plan-fidelity-reviewer', review('plan', 'open', 1)))
    for (const reviewer of planReviewers) {
      expectAllowed(runHook('record-verdict', stop(dir, reviewer, review('plan'))))
    }
    expectAllowed(runHook('gate-edits', edit(dir, 'src/a.ts')))

    commit(dir, 'src/a.ts', 'export const a = 1\n')
    for (const reviewer of codeReviewers) {
      expectAllowed(runHook('record-verdict', stop(dir, reviewer, review('code'))))
    }
    expectAllowed(runHook('gate-pr', shell(dir, 'gh pr create --fill')))
  })
})

describe('fails closed', { timeout }, () => {
  it.each(allHooks.flatMap((hook) => ['{not json', '', '[1]'].map((input) => [hook, input])))(
    '@TAN-34 %s exits 2 on malformed input %j',
    (hook, input) => {
      expect(runHook(hook, input).status).toBe(2)
    },
  )

  // Each gate reads the log first, so a broken line blocks even an input it would let through.
  const inputs = [
    ['gate-edits', 'a src/ write', (dir: string) => edit(dir, 'src/a.ts')],
    ['gate-edits', 'a docs/ edit', (dir: string) => edit(dir, 'docs/a.md')],
    ['gate-pr', 'gh pr merge', (dir: string) => shell(dir, 'gh pr merge 12')],
    ['gate-pr', 'ls', (dir: string) => shell(dir, 'ls')],
    ['gate-rounds', 'a reviewer launch', (dir: string) => launch(dir, 'plan-fidelity-reviewer')],
    ['gate-rounds', 'an Explore launch', (dir: string) => launch(dir, 'Explore')],
    [
      'record-verdict',
      'a valid verdict',
      (dir: string) => stop(dir, 'plan-fidelity-reviewer', review('plan')),
    ],
  ] as const
  it.each(
    inputs.flatMap(([hook, what, input]) =>
      ['{not json', '{"type":"verdict"}'].map((line) => [hook, what, line, input] as const),
    ),
  )('@TAN-34 %s exits 2 on %s with the broken log line %j', (hook, _what, line, input) => {
    const dir = repo()
    planned(dir)
    reviewedHead(dir, ...round(planReviewers, hashOf(planText), 'clean'))
    appendFileSync(path.join(dir, logFile), `${line}\n`)
    expect(runHook(hook, input(dir)).status).toBe(2)
  })
})

describe('settings.json', () => {
  const settingsPath = path.resolve(import.meta.dirname, '..', 'settings.json')
  type Hook = { type: string; command: string; args: string[]; onFailure?: string }
  type Settings = { hooks: Record<string, { matcher: string; hooks: Hook[] }[]> }
  const settings = () => JSON.parse(readFileSync(settingsPath, 'utf8')) as Settings

  it.each([
    ['SubagentStop', Object.keys(phaseOf).join('|'), 'record-verdict'],
    ['PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit', 'gate-edits'],
    ['PreToolUse', 'Bash|PowerShell', 'gate-pr'],
    ['PreToolUse', 'Agent|Task', 'gate-rounds'],
  ])(
    '@TAN-34 settings.json registers %s %s with %s and onFailure block',
    (event, matcher, hook) => {
      const entry = settings().hooks[event]?.find((candidate) => candidate.matcher === matcher)
      expect(entry?.hooks).toEqual([
        {
          type: 'command',
          command: 'node',
          args: [`\${CLAUDE_PROJECT_DIR}/.claude/hooks/${hook}.ts`],
          onFailure: 'block',
        },
      ])
      expect(existsSync(path.resolve(import.meta.dirname, `${hook}.ts`))).toBe(true)
    },
  )
})
