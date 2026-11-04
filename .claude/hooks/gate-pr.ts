// PreToolUse on Bash and PowerShell: gh pr create and gh pr merge need a clean working tree
// and both code reviewers clean on the current HEAD [TAN-34].
import {
  context,
  deny,
  findsPrCommand,
  headSha,
  isDirty,
  latestRound,
  readInput,
  run,
  toolInput,
} from './lib.ts'

run(() => {
  const input = readInput()
  const { root, key, log } = context(input)
  const { command } = toolInput(input)
  if (typeof command !== 'string') throw new Error('The command is not a string')
  if (!findsPrCommand(command)) return

  if (key === null) {
    deny('This branch has no TAN-<n> key. Check out the PR branch, then run /review-loop code.')
    return
  }
  if (isDirty(root)) {
    deny(
      'The working tree has uncommitted changes or untracked files the code review did not see. Commit them, then run /review-loop code.',
    )
    return
  }
  const head = headSha(root)
  const round = latestRound(log, 'code')
  if (round?.ref !== head || round.status !== 'clean') {
    deny(
      `gh pr create and gh pr merge need both code reviewers clean on HEAD ${head.slice(0, 7)}. Run /review-loop code.`,
    )
  }
})
