// Records a finding the main agent raised to blocker or major after verifying it, so the
// log shows its round as open (TAN-36). Run with Bash, not a hook:
//   node .claude/hooks/record-override.ts --phase code --finding CR-6 --severity major --reason "…"
// The ref and round come from the repo and the log, never from the command line. Any
// refusal exits 1 and writes nothing.
import { parseArgs } from 'node:util'
import {
  appendLog,
  context,
  currentRef,
  latestRound,
  roundNumber,
  type Override,
  type Phase,
} from './lib.ts'

function main(): void {
  const { values } = parseArgs({
    options: {
      phase: { type: 'string' },
      finding: { type: 'string' },
      severity: { type: 'string' },
      reason: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  })
  const { phase, finding, severity, reason } = values
  if (phase !== 'plan' && phase !== 'code') throw new Error('--phase must be plan or code')
  if (severity !== 'blocker' && severity !== 'major') {
    throw new Error('--severity must be blocker or major: a raise to minor changes nothing')
  }
  if (finding === undefined || finding.trim() === '') throw new Error('--finding is required')
  if (reason === undefined || reason.trim() === '') throw new Error('--reason is required')

  const { root, key, log } = context({ cwd: process.cwd() })
  if (key === null) throw new Error('This branch has no TAN-<n> key')
  const ref = currentRef(root, key, phase satisfies Phase)
  if (ref === null) throw new Error(`There is no plan at .claude/plans/${key}.md`)
  const round = latestRound(log, phase)
  if (round === undefined) throw new Error(`There is no ${phase} round to raise a finding in`)
  if (round.ref !== ref) {
    throw new Error(
      `The latest ${phase} round was reviewed on another ${phase === 'plan' ? 'plan hash' : 'HEAD'}: an override belongs to a round the reviewers saw`,
    )
  }
  const line: Override = {
    type: 'override',
    ticket: key,
    phase,
    round: roundNumber(log, phase, ref),
    ref,
    finding: finding.trim(),
    severity,
    reason: reason.trim(),
    time: new Date().toISOString(),
  }
  appendLog(root, key, line)
  process.stdout.write(
    `Recorded ${severity} ${line.finding} on ${phase} round ${String(line.round)}.\n`,
  )
}

try {
  main()
} catch (error) {
  process.stderr.write(
    `record-override: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
}
