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
}
export type OwnerReset = { type: 'owner-reset'; phase: Phase; time: string }
export type LogLine = Verdict | OwnerReset

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

function toLogLine(value: unknown): LogLine | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const line = value as Record<string, unknown>
  const { type, phase, time } = line
  if ((phase !== 'plan' && phase !== 'code') || typeof time !== 'string') return null
  if (type === 'owner-reset') return { type, phase, time }
  if (type !== 'verdict') return null
  const { ticket, reviewer, round, ref, status, blockers, majors, minors } = line
  if (typeof ticket !== 'string' || !/^TAN-\d+$/.test(ticket)) return null
  if (!isReviewer(reviewer) || reviewers[reviewer] !== phase) return null
  if (!isCount(round) || round < 1 || typeof ref !== 'string' || ref === '') return null
  if (status !== 'clean' && status !== 'open') return null
  if (!isCount(blockers) || !isCount(majors) || !isCount(minors)) return null
  if ((status === 'clean') !== (blockers === 0 && majors === 0)) return null
  return { type, ticket, phase, reviewer, round, ref, status, blockers, majors, minors, time }
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
// clean; anything else (one clean verdict so far) is incomplete.
export type Round = { ref: string; status: 'clean' | 'open' | 'incomplete' }

export function rounds(lines: LogLine[], phase: Phase): Round[] {
  const groups: { ref: string; latest: Map<Reviewer, Verdict['status']> }[] = []
  for (const line of lines) {
    if (line.type !== 'verdict' || line.phase !== phase) continue
    let group = groups.at(-1)
    if (group?.ref !== line.ref) {
      group = { ref: line.ref, latest: new Map() }
      groups.push(group)
    }
    group.latest.set(line.reviewer, line.status)
  }
  return groups.map(({ ref, latest }) => {
    if ([...latest.values()].includes('open')) return { ref, status: 'open' }
    const clean = reviewersOf(phase).every((reviewer) => latest.get(reviewer) === 'clean')
    return { ref, status: clean ? 'clean' : 'incomplete' }
  })
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
const unquote = (token: string) => token.replace(/^(["'])(.*)\1$/s, '$2')
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
