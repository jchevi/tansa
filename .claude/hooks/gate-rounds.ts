// PreToolUse on Agent and Task: a reviewer launch is denied after 3 consecutive open rounds
// in its phase, until a clean round or an owner-reset line [TAN-34].
import {
  consecutiveOpen,
  context,
  deny,
  isReviewer,
  readInput,
  reviewers,
  run,
  toolInput,
} from './lib.ts'

const limit = 3

run(() => {
  const input = readInput()
  const { key, log } = context(input)
  const { subagent_type: agent } = toolInput(input)
  if (!isReviewer(agent)) return
  const phase = reviewers[agent]

  if (key === null) {
    deny(
      `This branch has no TAN-<n> key. Work on a TAN-<n>-short-slug branch, then run /review-loop ${phase}.`,
    )
  } else if (consecutiveOpen(log, phase) >= limit) {
    deny(
      `${String(limit)} consecutive open ${phase} rounds: stop and ask the owner what to do. Only the owner restarts the count, with an owner-reset line in .claude/reviews/${key}.jsonl.`,
    )
  }
})
