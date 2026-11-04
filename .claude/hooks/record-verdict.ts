// SubagentStop on the four reviewers: parses the verdict line and appends it to the log
// (.claude/reviews/TAN-<n>.jsonl), the only writer of that file [TAN-34].
import {
  appendLog,
  context,
  headSha,
  isReviewer,
  parseVerdict,
  planHash,
  readInput,
  reviewers,
  roundNumber,
  run,
  verdictShape,
} from './lib.ts'

run(() => {
  const input = readInput()
  const agent = input.agent_type
  if (!isReviewer(agent)) return
  const { root, key, log } = context(input)
  const phase = reviewers[agent]
  const message =
    typeof input.last_assistant_message === 'string' ? input.last_assistant_message : ''
  const verdict = parseVerdict(message, phase)

  if (verdict === null) {
    // Asked once already: stop asking. With no log line the round does not count, so the
    // gates stay closed until the reviewer is relaunched.
    if (input.stop_hook_active === true) {
      process.stderr.write(`${agent} ended without a valid verdict line; not logged.\n`)
      return
    }
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `End your review with exactly one verdict line, as the last line and outside any code fence: ${verdictShape.replace('<plan|code>', phase)}. status=clean only when blockers and majors are both 0.`,
      }),
    )
    return
  }

  if (key === null) {
    process.stderr.write(`The branch has no TAN-<n> key; ${agent}'s verdict is not logged.\n`)
    return
  }
  const ref = phase === 'plan' ? planHash(root, key) : headSha(root)
  if (ref === null) throw new Error(`No plan at .claude/plans/${key}.md to record the verdict on`)
  appendLog(root, key, {
    type: 'verdict',
    ticket: key,
    phase,
    reviewer: agent,
    round: roundNumber(log, phase, ref),
    ref,
    ...verdict,
    time: new Date().toISOString(),
  })
})
