// Shared code for the review-loop hooks (TAN-34). The rules they enforce live in
// .claude/skills/review-loop/SKILL.md and docs/decisions.md. Every hook runs through run(),
// so any error exits 2 and, with onFailure "block", blocks the action (fail closed).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// Each reviewer and the phase it reviews; the agents live in .claude/agents [TAN-33].
export const reviewers = {
  'plan-fidelity-reviewer': 'plan',
  'plan-testability-reviewer': 'plan',
  'code-correctness-reviewer': 'code',
  'code-rules-reviewer': 'code',
} as const
export type Reviewer = keyof typeof reviewers
export type Phase = (typeof reviewers)[Reviewer]

export function isReviewer(name: unknown): name is Reviewer {
  return typeof name === 'string' && Object.hasOwn(reviewers, name)
}
const reviewersOf = (phase: Phase) =>
  (Object.keys(reviewers) as Reviewer[]).filter((reviewer) => reviewers[reviewer] === phase)

// --- Hook input and output ---

export type HookInput = Record<string, unknown>

export function readInput(): HookInput {
  const parsed: unknown = JSON.parse(readFileSync(0, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Hook input is not a JSON object')
  }
  return parsed as HookInput
}

export function toolInput(input: HookInput): Record<string, unknown> {
  const value = input.tool_input
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Hook input has no tool_input object')
  }
  return value as Record<string, unknown>
}

// Claude Code reads a PreToolUse deny only in this shape.
export function deny(reason: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

export function run(main: () => void): void {
  try {
    main()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Review hook failed closed: ${message}\n`)
    // exitCode instead of exit(), so stdout and stderr are flushed first.
    process.exitCode = 2
  }
}

// --- Git and files ---

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export const headSha = (root: string) => git(root, ['rev-parse', 'HEAD'])

// Untracked, non-ignored files count too: the review diff never showed them (TAN-33 minor).
export const isDirty = (root: string) => git(root, ['status', '--porcelain']) !== ''

export function ticketKey(root: string): string | null {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return /^(TAN-\d+)-/.exec(branch)?.[1] ?? null
}

// sha256 of the plan with CRLF turned into LF, as the skill defines it.
export function planHash(root: string, key: string): string | null {
  const file = path.join(root, '.claude', 'plans', `${key}.md`)
  if (!existsSync(file)) return null
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(text).digest('hex')
}

// --- The log: .claude/reviews/TAN-<n>.jsonl, append-only ---

export type Verdict = {
  type: 'verdict'
  ticket: string
  phase: Phase
  reviewer: Reviewer
  round: number
  ref: string
  status: 'clean' | 'open'
  blockers: number
  majors: number
  minors: number
  time: string
  // The reviewer's id, so a SendMessage resume can be recognised (TAN-36). Optional: TAN-34
  // logs have none.
  agent_id?: string
}
export type OwnerReset = { type: 'owner-reset'; phase: Phase; time: string }
// A finding the main agent raised to blocker or major after verifying it (TAN-36). Written
// only by record-override.ts; it makes the round it is recorded in open.
export type Override = {
  type: 'override'
  ticket: string
  phase: Phase
  round: number
  ref: string
  finding: string
  severity: 'blocker' | 'major'
  reason: string
  time: string
}
export type LogLine = Verdict | OwnerReset | Override

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

function toLogLine(value: unknown): LogLine | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const line = value as Record<string, unknown>
  const { type, phase, time } = line
  if ((phase !== 'plan' && phase !== 'code') || typeof time !== 'string') return null
  if (type === 'owner-reset') return { type, phase, time }
  const { ticket, round, ref } = line
  if (typeof ticket !== 'string' || !/^TAN-\d+$/.test(ticket)) return null
  if (!isCount(round) || round < 1 || !isText(ref)) return null
  if (type === 'override') {
    const { finding, severity, reason } = line
    if (!isText(finding) || !isText(reason)) return null
    if (severity !== 'blocker' && severity !== 'major') return null
    return { type, ticket, phase, round, ref, finding, severity, reason, time }
  }
  if (type !== 'verdict') return null
  const { reviewer, status, blockers, majors, minors, agent_id: agentId } = line
  if (!isReviewer(reviewer) || reviewers[reviewer] !== phase) return null
  if (status !== 'clean' && status !== 'open') return null
  if (!isCount(blockers) || !isCount(majors) || !isCount(minors)) return null
  if ((status === 'clean') !== (blockers === 0 && majors === 0)) return null
  if (agentId !== undefined && !isText(agentId)) return null
  const verdict: Verdict = {
    type,
    ticket,
    phase,
    reviewer,
    round,
    ref,
    status,
    blockers,
    majors,
    minors,
    time,
  }
  return agentId === undefined ? verdict : { ...verdict, agent_id: agentId }
}

// Any line that is not JSON or does not match the schema throws, so every gate exits 2.
export function parseLog(text: string): LogLine[] {
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  return lines.map((text, index) => {
    const number = String(index + 1)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`Review log line ${number} is not JSON`)
    }
    const line = toLogLine(parsed)
    if (line === null) throw new Error(`Review log line ${number} does not match the log schema`)
    return line
  })
}

const logPath = (root: string, key: string) => path.join(root, '.claude', 'reviews', `${key}.jsonl`)

export function readLog(root: string, key: string): LogLine[] {
  const file = logPath(root, key)
  return existsSync(file) ? parseLog(readFileSync(file, 'utf8')) : []
}

export function appendLog(root: string, key: string, line: LogLine): void {
  const file = logPath(root, key)
  mkdirSync(path.dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(line)}\n`)
}

// Where the hook runs: the repo, its ticket key and its log, read and checked first.
export type Context = { cwd: string; root: string; key: string | null; log: LogLine[] }

export function context(input: HookInput): Context {
  if (typeof input.cwd !== 'string') throw new Error('Hook input has no cwd')
  const cwd = realpathSync.native(input.cwd)
  const root = realpathSync.native(git(cwd, ['rev-parse', '--show-toplevel']))
  const key = ticketKey(root)
  return { cwd, root, key, log: key === null ? [] : readLog(root, key) }
}

// --- Rounds ---

// A round is a run of verdicts on one ref (plan hash or HEAD SHA) within a phase. A new
// round starts whenever the ref changes, so A, B, A is three rounds. Each reviewer's
// latest verdict in the round counts: any open makes it open; both reviewers clean make it
// clean; anything else (one clean verdict so far) is incomplete. An override marks the
// round current at its place in the log as open, so it never reaches a later round on the
// same ref (TAN-36).
export type Round = {
  ref: string
  status: 'clean' | 'open' | 'incomplete'
  reviewed: Reviewer[]
}

export function rounds(lines: LogLine[], phase: Phase): Round[] {
  const groups: { ref: string; latest: Map<Reviewer, Verdict['status']>; overridden: boolean }[] =
    []
  for (const line of lines) {
    if (line.type === 'owner-reset' || line.phase !== phase) continue
    let group = groups.at(-1)
    if (group?.ref !== line.ref) {
      group = { ref: line.ref, latest: new Map(), overridden: false }
      groups.push(group)
    }
    if (line.type === 'override') group.overridden = true
    else group.latest.set(line.reviewer, line.status)
  }
  return groups.map(({ ref, latest, overridden }) => {
    const reviewed = [...latest.keys()]
    if (overridden || [...latest.values()].includes('open')) {
      return { ref, status: 'open', reviewed }
    }
    const clean = reviewersOf(phase).every((reviewer) => latest.get(reviewer) === 'clean')
    return { ref, status: clean ? 'clean' : 'incomplete', reviewed }
  })
}

// The ref a new verdict would be recorded on: the plan hash or HEAD. null with no plan file.
export function currentRef(root: string, key: string, phase: Phase): string | null {
  return phase === 'plan' ? planHash(root, key) : headSha(root)
}

// The missing reviewer of the latest round may finish it while its ref is current, even at
// the round limit: a relaunch with no change is the same round (TAN-36).
export function canFinishRound(
  lines: LogLine[],
  phase: Phase,
  reviewer: Reviewer,
  ref: string | null,
): boolean {
  const last = rounds(lines, phase).at(-1)
  return ref !== null && last?.ref === ref && !last.reviewed.includes(reviewer)
}

// The reviewer a SendMessage target names, from the agent_id record-verdict stored. The
// target may carry a " [ref]" suffix, as SendMessage allows.
export function reviewerFor(lines: LogLine[], to: unknown): Reviewer | null {
  if (typeof to !== 'string') return null
  const id = to.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
  const line = lines.findLast((entry) => entry.type === 'verdict' && entry.agent_id === id)
  return line?.type === 'verdict' ? line.reviewer : null
}

// The reviewer's id: agent_id from the hook input, or the id in agent-<id>.jsonl.
export function agentIdOf(input: HookInput): string | null {
  if (isText(input.agent_id)) return input.agent_id
  const file = input.agent_transcript_path
  if (typeof file !== 'string') return null
  return /agent-([^\\/]+)\.jsonl$/.exec(file)?.[1] ?? null
}

export const latestRound = (lines: LogLine[], phase: Phase) => rounds(lines, phase).at(-1)

// Open rounds since the last clean round or owner-reset line; incomplete rounds are skipped.
export function consecutiveOpen(lines: LogLine[], phase: Phase): number {
  const lastReset = lines.findLastIndex(
    (line) => line.type === 'owner-reset' && line.phase === phase,
  )
  let count = 0
  for (const round of rounds(lines.slice(lastReset + 1), phase).reverse()) {
    if (round.status === 'clean') break
    if (round.status === 'open') count += 1
  }
  return count
}

// The round number stored with a new verdict, for the PR line and the build diary.
export function roundNumber(lines: LogLine[], phase: Phase, ref: string): number {
  const all = rounds(lines, phase)
  return all.at(-1)?.ref === ref ? all.length : all.length + 1
}

// --- Verdict line ---

const verdictPattern =
  /^VERDICT phase=(plan|code) status=(clean|open) blockers=(\d+) majors=(\d+) minors=(\d+)$/

export const verdictShape =
  'VERDICT phase=<plan|code> status=<clean|open> blockers=<n> majors=<n> minors=<n>'

// The last non-empty line, trimmed, must be the only verdict line, for this reviewer's phase,
// with status=clean exactly when blockers and majors are both 0.
export function parseVerdict(
  message: string,
  phase: Phase,
): Pick<Verdict, 'status' | 'blockers' | 'majors' | 'minors'> | null {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  if (lines.filter((line) => line.startsWith('VERDICT')).length !== 1) return null
  const match = verdictPattern.exec(lines.at(-1) ?? '')
  if (match?.[1] !== phase) return null
  const status = match[2] === 'clean' ? 'clean' : 'open'
  const blockers = Number(match[3])
  const majors = Number(match[4])
  const minors = Number(match[5])
  if ((status === 'clean') !== (blockers === 0 && majors === 0)) return null
  return { status, blockers, majors, minors }
}

// The reviewer's final report as its transcript holds it. In the desktop app a subagent
// ends by calling the SubagentHandback tool with its report, so last_assistant_message has
// no text: the report is the last assistant text, or the last handback message, in
// agent_transcript_path (found in the TAN-34 live run). Thinking blocks never count.
// A reviewer resumed with SendMessage appends to the same file, so only what it wrote after
// the last real user turn (text, not a tool_result) is its report: an earlier run's verdict
// is never reused (TAN-36).
export function transcriptReport(input: HookInput): string {
  const file = input.agent_transcript_path
  if (typeof file !== 'string' || file === '') return ''
  const resolved = file.startsWith('~') ? path.join(homedir(), file.slice(1)) : file
  if (!existsSync(resolved)) return ''
  let report = ''
  for (const line of readFileSync(resolved, 'utf8').split(/\r?\n/)) {
    if (line.trim() === '') continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (isUserTurn(entry)) {
      report = ''
      continue
    }
    const texts = assistantBlocks(entry).flatMap((block) => {
      if (block.type === 'text' && typeof block.text === 'string') return [block.text]
      const message = (block.input as Record<string, unknown> | undefined)?.message
      if (
        block.type === 'tool_use' &&
        block.name === 'SubagentHandback' &&
        typeof message === 'string'
      ) {
        return [message]
      }
      return []
    })
    if (texts.length > 0) report = texts.join('\n')
  }
  return report
}

// A prompt or a SendMessage resume: a user message whose content is text. A tool_result is
// also a user message, but not a turn.
function isUserTurn(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false
  const message = (entry as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return false
  const { role, content } = message as { role?: unknown; content?: unknown }
  if (role !== 'user') return false
  if (typeof content === 'string') return true
  if (!Array.isArray(content)) return false
  const types = content.map((block) => (block as { type?: unknown } | null)?.type)
  return types.includes('text') && !types.includes('tool_result')
}

function assistantBlocks(entry: unknown): Record<string, unknown>[] {
  if (typeof entry !== 'object' || entry === null) return []
  const message = (entry as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return []
  const { role, content } = message as { role?: unknown; content?: unknown }
  if (role !== 'assistant' || !Array.isArray(content)) return []
  return content.filter(
    (block): block is Record<string, unknown> => typeof block === 'object' && block !== null,
  )
}

// --- Paths and commands ---

export type PathKind = 'gated' | 'log' | 'free'

// Pure, with the path module passed in, so Windows paths are tested on Linux too.
export function classifyPath(p: typeof path.posix, root: string, cwd: string, file: string) {
  const relative = p.relative(root, p.resolve(cwd, file))
  const outside =
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${p.sep}`) ||
    p.isAbsolute(relative)
  if (outside) return 'free' satisfies PathKind
  // Windows paths are case-insensitive: SRC\a.ts is src/a.ts.
  const parts = relative.split(p.sep).map((part) => (p.sep === '\\' ? part.toLowerCase() : part))
  if (parts[0] === '.claude' && parts[1] === 'reviews') return 'log' satisfies PathKind
  if (parts[0] === 'src' || parts[0] === 'e2e') return 'gated' satisfies PathKind
  return 'free' satisfies PathKind
}

const tokenPattern = /"[^"]*"|'[^']*'|\S+/g
// A quoted token loses its quotes. A separator inside a shell string splits it before
// tokens are read, leaving a stray quote (`merge"`), so leftover quotes go too.
const unquote = (token: string) =>
  token.replace(/^(["'])(.*)\1$/s, '$2').replace(/^["']|["']$/g, '')
const basename = (token: string) => token.split(/[\\/]/).at(-1) ?? ''

// Where one command ends and the next begins: newlines, ;, &&, ||, |, a background &
// (also PowerShell's call operator), grouping, and $( ) or backtick substitution.
const separators = /\r?\n|&&|\|\||[;&|(){}`]/
// Words that may come before the program: shell keywords and wrappers that run the rest.
const prefixes = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', 'time', '!'])
const wrappers = new Set(['sudo', 'env', 'command', 'exec', 'nohup', 'builtin'])
const isAssignment = (token: string) => /^[A-Za-z_]\w*=/.test(token)
// A shell running a string: bash -c "…", pwsh -Command "…", cmd /c …
const shells = /^(bash|sh|zsh|dash|pwsh|powershell|cmd)(\.exe)?$/i
const shellFlags = /^(-c|-lc|-command|\/c|\/k)$/i

// gh pr create or gh pr merge anywhere in a command, including the shell forms above.
// Textual: aliases, gh api, scripts that call gh and commands built at runtime are known
// gaps (docs/decisions.md). A shell string is matched as a command of its own.
export function findsPrCommand(command: string): boolean {
  return command.split(separators).some((segment) => {
    const tokens = (segment.match(tokenPattern) ?? []).map(unquote)
    let start = 0
    while (start < tokens.length) {
      const token = tokens[start] ?? ''
      const skip = prefixes.has(token) || wrappers.has(token) || isAssignment(token)
      if (!skip) break
      start += 1
    }
    const program = basename(tokens[start] ?? '')
    if (shells.test(program)) {
      const flag = tokens.findIndex((token, index) => index > start && shellFlags.test(token))
      return flag !== -1 && findsPrCommand(tokens.slice(flag + 1).join(' '))
    }
    if (!/^gh(\.exe)?$/i.test(program)) return false
    const words: string[] = []
    for (let i = start + 1; i < tokens.length; i += 1) {
      const token = tokens[i] ?? ''
      if (!token.startsWith('-')) words.push(token)
      // -R and --repo take the next token as their value.
      else if (token === '-R' || token === '--repo') i += 1
    }
    return words[0] === 'pr' && (words[1] === 'create' || words[1] === 'merge')
  })
}
