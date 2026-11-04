// PreToolUse on Edit, Write, MultiEdit and NotebookEdit [TAN-34]:
// - src/ and e2e/ need a clean plan review of the current plan file;
// - .claude/reviews/ is written only by record-verdict;
// - anything else (docs, config) is free.
import path from 'node:path'
import {
  classifyPath,
  context,
  deny,
  latestRound,
  planHash,
  readInput,
  run,
  toolInput,
} from './lib.ts'

run(() => {
  const input = readInput()
  const { cwd, root, key, log } = context(input)
  const { file_path: filePath, notebook_path: notebookPath } = toolInput(input)
  const file = filePath ?? notebookPath
  if (typeof file !== 'string') throw new Error('The edit has no file_path or notebook_path')

  const kind = classifyPath(process.platform === 'win32' ? path.win32 : path.posix, root, cwd, file)
  if (kind === 'free') return
  if (kind === 'log') {
    deny(
      'The review log is written only by the record-verdict hook. The owner adds owner-reset lines by hand.',
    )
    return
  }
  if (key === null) {
    deny(
      'This branch has no TAN-<n> key. Work on a TAN-<n>-short-slug branch, then run /review-loop plan.',
    )
    return
  }
  const hash = planHash(root, key)
  const round = latestRound(log, 'plan')
  if (hash === null) {
    deny(`There is no plan at .claude/plans/${key}.md. Write it, then run /review-loop plan.`)
  } else if (round?.ref !== hash || round.status !== 'clean') {
    deny(
      `Edits under src/ and e2e/ need both plan reviewers clean on the current .claude/plans/${key}.md. Run /review-loop plan.`,
    )
  }
})
