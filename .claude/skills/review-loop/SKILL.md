---
name: review-loop
description: Run the two-reviewer review loop for the current TANSA ticket. Use `plan` before presenting a development plan to the owner, and `code` before running gh pr create. Repeats rounds until no blocker or major is open.
argument-hint: plan | code
---

# Review loop

Phase: **$ARGUMENTS**. It must be `plan` or `code`; for anything else, stop and ask the owner which one.

The reviews do not replace the owner: the owner still approves the plan and the merge.

## Inputs

- **Ticket key**: from the branch name `TAN-<n>-short-slug`. If the branch has no key, stop and say so.
- **Ticket text**: the Jira ticket with its acceptance criteria. Reviewers cannot read Jira, so paste the text into each prompt.
- **Plan file**: `.claude/plans/TAN-<n>.md` (git-ignored). It holds the files to touch, how each acceptance criterion is tested, the order of work and the risks.
- **Diff file** (code phase): `.claude/plans/TAN-<n>.diff` (git-ignored). Reviewers cannot run commands, so they read this file.
- **Log**: `.claude/reviews/TAN-<n>.jsonl`. The `SubagentStop` hook (TAN-34) appends one line per reviewer verdict. Never write it yourself: Edit and Write are denied there. The gates in `.claude/hooks/` read it to allow code edits, PRs and reviewer launches.

## Round

A round is each distinct plan hash or HEAD SHA within a phase. The plan hash is the sha256 of the plan file with CRLF turned into LF; the code phase uses the HEAD commit. Relaunching with no change is the same round (for example, after a reviewer failed to finish): it does not add to the count. Returning to an earlier hash or SHA after a different one starts a new round.

## Plan phase

1. Write the plan to `.claude/plans/TAN-<n>.md`.
2. Launch `plan-fidelity-reviewer` and `plan-testability-reviewer` in parallel. Each prompt holds: the ticket key, the ticket text, the plan path, the round number and, from round 2, the previous findings with how each one was resolved.
3. Cross-check the findings (below), fix the plan file, and start the next round.
4. When the round is clean, present the plan to the owner with the review line (below) and wait for approval.

## Code phase

1. Commit everything. `git status --porcelain` must print nothing, untracked files included, so the reviewers see exactly HEAD.
2. Write the diff: `git diff main...HEAD > .claude/plans/TAN-<n>.diff`.
3. Launch `code-correctness-reviewer` and `code-rules-reviewer` in parallel. Each prompt holds: the ticket key, the ticket text, the diff path, the plan path, the round number and, from round 2, the previous findings with how each one was resolved.
4. Cross-check the findings, fix them in new commits (a new HEAD SHA is a new round), and start the next round from step 1.
5. When the round is clean, run `gh pr create` with the review line in the body.

## Cross-check

- A finding both reviewers report is high confidence: apply it.
- A finding only one reviewer reports: verify it yourself against the evidence before applying it. Open the cited file and line. Never copy a figure or conclusion without recomputing it.
- A finding you reject: note it with the reason, and pass the reason to the next round's reviewers.
- Severity is the reviewer's opening bid. If you change it, say why.

## Stop rule

- A round is clean when neither reviewer reports an open blocker or major.
- Minors are not fixed in this PR. List them for the owner as notes for new tickets; once the owner creates the tickets, use their keys in the review line. Pass them to the next round as deferred: deferred minors are not reopened and do not count toward escalation.
- After 3 consecutive open rounds in a phase, stop and ask the owner what to do. A clean round resets the count, so a QA bounce-back or a plan change after a clean round starts again from zero.
- Escalate to the owner, without waiting for round 3:
  - A finding reopened twice.
  - A rejected finding that a reviewer reopens.

## Owner reset

Only the owner restarts the count after an escalation, by appending an `owner-reset` line to the log:

```
{"type":"owner-reset","phase":"plan","time":"2026-11-04T12:00:00Z"}
```

Use `"phase":"code"` for the code phase. Never delete the log: the PR line and the build diary are built from it.

## Review line

One neutral line per phase in the PR body (and with the plan, for the plan phase), with no mention of AI:

```
Plan review: <n> rounds, <n> open. Code review: <n> rounds, <n> open. Minors: <ticket keys, or none>
```

## Verdict line

Every reviewer ends with exactly one line of this shape. The `SubagentStop` hook parses it, so never change it in one place only:

```
VERDICT phase=<plan|code> status=<clean|open> blockers=<n> majors=<n> minors=<n>
```
