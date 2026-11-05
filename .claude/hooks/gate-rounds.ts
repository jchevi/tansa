// PreToolUse on Agent, Task and SendMessage: a reviewer launch is denied after 3 consecutive
// open rounds in its phase, until a clean round or an owner-reset line [TAN-34]. Resuming a
// logged reviewer with SendMessage counts as a launch, and the missing reviewer of the
// latest round may still finish it while its ref is current [TAN-36].
import {
  canFinishRound,
  consecutiveOpen,
  context,
  currentRef,
  deny,
  isReviewer,
  readInput,
  reviewerFor,
  reviewers,
  run,
  toolInput,
} from './lib.ts'

const limit = 3

run(() => {
  const input = readInput()
  const { root, key, log } = context(input)
  const tool = toolInput(input)
  const agent = input.tool_name === 'SendMessage' ? reviewerFor(log, tool.to) : tool.subagent_type
  if (!isReviewer(agent)) return
  const phase = reviewers[agent]

  if (key === null) {
    deny(
      `This branch has no TAN-<n> key. Work on a TAN-<n>-short-slug branch, then run /review-loop ${phase}.`,
    )
  } else if (
    consecutiveOpen(log, phase) >= limit &&
    !canFinishRound(log, phase, agent, currentRef(root, key, phase))
  ) {
    deny(
      `${String(limit)} consecutive open ${phase} rounds: stop and ask the owner what to do. Only the owner restarts the count, with an owner-reset line in .claude/reviews/${key}.jsonl.`,
    )
  }
})
