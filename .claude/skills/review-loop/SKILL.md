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
- **Log**: `.claude/reviews/TAN-<n>.jsonl`. The `SubagentStop` hook (TAN-34) appends one line per reviewer verdict, and `record-override.ts` (TAN-36) appends a severity raise. Never write it yourself: Edit and Write are denied there. The gates in `.claude/hooks/` read it to allow code edits, PRs and reviewer launches.

## Round

A round is each distinct plan hash or HEAD SHA within a phase. The plan hash is the sha256 of the plan file with CRLF turned into LF; the code phase uses the HEAD commit. Relaunching with no change is the same round (for example, after a reviewer failed to finish): it does not add to the count. Returning to an earlier hash or SHA after a different one starts a new round.

## Plan phase

1. Write the plan to `.claude/plans/TAN-<n>.md`, with a Mockup check when the ticket names a mockup (`CLAUDE.md`, How to work step 2). It names the images in `docs/mockups/` of each screen state the ticket touches; `plan-fidelity-reviewer` opens them. Whether or not the ticket names a mockup, a plan that changes a screen state with no image there waits for its design ticket.
2. Launch `plan-fidelity-reviewer` and `plan-testability-reviewer` in parallel. Each prompt holds: the ticket key, the ticket text, the plan path, the round number and, from round 2, the previous findings with how each one was resolved.
3. Cross-check the findings (below), fix the plan file, and start the next round.
4. When the round is clean, present the plan to the owner with the review line (below) and wait for approval. Every departure from the mockup is one of the decisions presented; the approved ones are added to `docs/decisions.md` → Mockup departures in the ticket's PR.

## Code phase

1. Commit everything. `git status --porcelain` must print nothing, untracked files included, so the reviewers see exactly HEAD.
2. Write the diff against an up-to-date `main`: `git fetch origin main`, then `git diff origin/main...HEAD > .claude/plans/TAN-<n>.diff`. The local `main` may be behind, and its missing commits would show up in the diff as if they were this ticket's. If the fetch fails, stop and say so; never write the diff against a `main` that was not just fetched.
3. Launch `code-correctness-reviewer` and `code-rules-reviewer` in parallel. Each prompt holds: the ticket key, the ticket text, the diff path, the plan path, the round number and, from round 2, the previous findings with how each one was resolved.
4. Cross-check the findings, fix them in new commits (a new HEAD SHA is a new round), and start the next round from step 1.
5. When the round is clean, run `gh pr create` with the review line in the body.

## Cross-check

- A finding both reviewers report is high confidence: apply it.
- A finding only one reviewer reports: verify it yourself against the evidence before applying it. Open the cited file and line. Never copy a figure or conclusion without recomputing it.
- A finding you reject: note it with the reason, and pass the reason to the next round's reviewers.
- Severity is the reviewer's opening bid. If you change it, say why. When you raise a finding to blocker or major, record it with `record-override.ts`, so the log shows its round as open:

  ```
  node .claude/hooks/record-override.ts --phase code --finding CR-6 --severity major --reason "…"
  ```

  A lowered or rejected finding is not logged: keep it in the conversation and in the next round's prompt.

## Stop rule

- A round is clean when neither reviewer reports an open blocker or major.
- Minors are not fixed in this PR, with one exception: a plan-phase minor whose fix only changes text or a test the plan already writes (no new file, test case, step or acceptance criterion) may be fixed in the plan, then run one more round on the fixed plan before presenting it. List it in the review line after "fixed in plan", by finding id. Every other minor becomes a ticket. Create the follow-up tickets yourself in Jira; the owner does not create them. Group the minors by area, one ticket per area (as TAN-35 to TAN-40); a process minor joins an open process ticket of its area when there is one (Follow-up tickets). File plan minors before presenting the plan, and code minors before `gh pr create`. Put the keys in the review line, whether the ticket is new or an open one the minor joined; write "Minors: none" only when there are none. Pass the filed ones to the next round as deferred (a minor joined to an open ticket is filed too): deferred minors are not reopened and do not count toward escalation. Pass the fixed ones as fixed, so the reviewer checks that the fix holds.
- After 3 consecutive open rounds in a phase, stop and ask the owner what to do. A clean round resets the count, so a QA bounce-back or a plan change after a clean round starts again from zero.
- Resuming a reviewer with `SendMessage` counts as a launch. The missing reviewer of the latest round can still be launched while its ref is current, so a round that stalled can be finished.
- Escalate to the owner, without waiting for round 3:
  - A finding reopened twice.
  - A rejected finding that a reviewer reopens.

## Follow-up tickets

The same shape for review minors, out-of-scope work and Definition of Done exceptions:

- Description: **Goal**; **Why**, with the source ticket and the finding ids; **Scope**; acceptance criteria in Gherkin; **Verification**.
- Parent: the epic of the area. Tasks get the label `tech-debt`, `a11y` or `build-log`.
- A defect is a Bug. A Story that needs a spec decision says so in its Why.
- Sprint and version: a process ticket (label `build-log`) goes into the active sprint with no Fix version; any other follow-up is created with no sprint and no Fix version and waits in the backlog until the owner plans it in (`CLAUDE.md`, How to work).
- Open process ticket first: before creating a process ticket for a review minor or out-of-scope item, look for an open process ticket of its area: label `build-log`, in any status before In Progress (never In Progress, QA or Done), whose Scope already touches the same files or workflow. Priority does not matter. If there is one, add the item to it: the source ticket and finding ids in its Why, a Scope bullet and a Gherkin criterion. If several qualify, it joins the highest-ranked one. Create a new ticket only when there is none. A Definition of Done exception always gets its own ticket. Other follow-ups get a new ticket per area.
- After `gh pr create`, add the PR link to each ticket's Why.

## Owner reset

Only the owner restarts the count after an escalation, by appending an `owner-reset` line to the log:

```
{"type":"owner-reset","phase":"plan","time":"2026-11-04T12:00:00Z"}
```

Use `"phase":"code"` for the code phase. Never delete the log: the PR line and the build diary are built from it.

## Review line

One neutral line per phase in the PR body (and with the plan, for the plan phase), with no mention of AI:

```
Plan review: <n> rounds, <n> open. Code review: <n> rounds, <n> open. Minors: <ticket keys, then "fixed in plan" and the finding ids, or none>
```

For example: `Minors: TAN-110; fixed in plan PF-2, PT-3`.

## Verdict line

Every reviewer ends with exactly one line of this shape. The `SubagentStop` hook parses it, so never change it in one place only:

```
VERDICT phase=<plan|code> status=<clean|open> blockers=<n> majors=<n> minors=<n>
```
