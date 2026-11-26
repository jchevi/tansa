# TANSA

TANSA (探査, "exploration") is a small local-first web app for running exploratory testing sessions with Session-Based Test Management (SBTM): charter, time-boxed session, findings (Note, Bug, Issue), PROOF debrief and a Markdown report ready for Jira.

It is built by one person (a senior QA engineer, intermediate programmer) as a public portfolio piece and a way to learn Claude across the whole lifecycle. **Explain the why of non-obvious decisions** in PR descriptions and when asked: the owner wants to understand, not just receive code.

## Stack
- Node 26 (pinned in `.nvmrc` and `engines`)
- Vite + React + TypeScript (`strict: true`). TypeScript is pinned to 6.0 until typescript-eslint supports 7 (see `docs/decisions.md`).
- Vitest for unit tests, Playwright for end-to-end tests, GitHub Actions for CI (`.github/workflows/ci.yml`)
- Cloudflare Workers (static assets, `wrangler.jsonc`) for PR previews, built by Workers Builds
- Target browsers: Chrome and Edge on Windows (installable PWA from v1.0)

## Where things are
- `docs/spec.md`: MVP spec (requirements R1–R15, data model). Source of truth for behaviour.
- `docs/decisions.md`: decision log with reasons. Its Mockup departures table lists every approved difference from the mockups until it is corrected.
- Backlog: Jira, space TAN (https://jchevi.atlassian.net). Each ticket has Gherkin acceptance criteria.
- `README.md`: commands, folder structure and test conventions.

## How to work
- **Start of chat:** before any ticket work, run the `start-of-chat` skill and report in a few lines: the active sprint (dates, goal; if it has ended or none is active, propose closing it and opening the next), Done tickets with no sprint or no Fix version (process tickets: sprint only), unfinished tickets with a sprint or Fix version the owner did not plan in, WIP, and the next ticket in the approved order. Claude proposes; sprint and version changes happen only after the owner approves them in the chat.
- **Order:** bugs with priority High or Highest, then process tickets (label `build-log`), then each feature's design ticket and its story, then the rest. Process tickets go into the active sprint when created and never get a Fix version. Any other ticket created but not planned in waits in the backlog with no sprint and no version; a ticket in Done belongs to the sprint in which it was finished and, unless it is a process ticket, to that sprint's Fix version. Within each group the order comes from a review, not from creation order: Claude compares the group's open tickets (dependencies, what unblocks or saves the most time on later work, risk, size) and proposes an order with one reason per ticket; once the owner approves it, Claude updates the Jira rank to match. The review runs at each hand-off (lifecycle step 8), and at the start of chat when the chat did not start from a hand-off prompt with an approved order or the group has an open ticket that order does not list.
1. One Jira ticket at a time. Start by reading the ticket and the related part of `docs/spec.md`.
2. Plan before coding: write `.claude/plans/TAN-<n>.md` with the files you will touch and how each acceptance criterion will be tested, run `/review-loop plan` until it is clean, then present it. Wait for approval on anything non-trivial.
   - **Mockup check:** the mockup named in the ticket is the reference. The plan has a Mockup check section that names the image of each screen state the ticket touches (`docs/mockups/<state>.png`) and compares the plan against it, then a table with, for each element the ticket touches, what the mockup shows and what the plan builds; exact values (sizes, radii, gaps, copy) are quoted from `docs/mockups/source/`. A ticket that touches a screen with no image in `docs/mockups/` is not planned until its design ticket is done. Every difference is one of the decisions presented to the owner, with its reason, and once approved goes into `docs/decisions.md` → Mockup departures. The ticket that later makes the screen match fills in that row's Corrected in and adds its own Design row. Never depart from the mockup silently.
3. If the ticket is ambiguous or conflicts with the spec or a decision, **stop and ask**. Do not resolve it silently.
4. Keep scope small: anything not in the ticket becomes a Jira ticket that Claude creates in the same session, or, for process work, joins an open process ticket of its area (shape in the `review-loop` skill), not a note and not code. An exception to the Definition of Done (e.g. a deferred exploratory session) gets its Process row in `docs/decisions.md` and a ticket in the same session.
5. Write the test from the acceptance criteria first (Playwright for stories, Vitest or another automated check for tasks), see it fail, then write the code.

## Conventions
- Branch: `TAN-<n>-short-slug` (e.g. `TAN-18-session-charter`).
- Commits: Conventional Commits with the key, e.g. `feat(charter): block start until fields are filled [TAN-18]`.
- PR title starts with the key; the PR body lists each acceptance criterion and where it is tested.
- Test titles (Playwright and Vitest) start with the key: `@TAN-18 start is blocked until the charter is complete`.
- No AI attribution in commits or PRs (no `Co-Authored-By` trailer).
- Everything in the repo is in English (code, comments, commits, docs).

## Ticket lifecycle
1. Move the ticket to **In Progress** (WIP limit 1) and branch from an up-to-date `main`: `TAN-<n>-short-slug`.
2. Commit with Conventional Commits and the key; stories also commit their QA pack; run `/review-loop code` until it is clean; open the PR (key in the title, criteria and the review line in the body).
   - QA pack (stories): `docs/qa/TAN-<n>.md`, written before the code review so the reviewed HEAD is the merged one. Not scripted cases (the criteria are in CI) but prep for the exploratory session. Sections: **Charters** (1–3, Explore / With / To discover, each on a real risk); **Risks** the tests do not cover (layout, long or Unicode text, how keyboard focus moves, reload mid-flow, reduce motion, dark mode once it exists, earlier features); **Test data** (fictional, ready to paste: empty, whitespace-only, very long, emoji, RTL); **Oracles** (what should be true and its source; none means an Issue, not a Bug); **Coverage matrix** (criteria × Chrome/Edge, viewport, theme); **Already automated** (test titles).
3. Stories: when CI is green and the preview is deployed, move the ticket to **QA** and run the exploratory session on the preview with its QA pack. Bugs found send it back to In Progress; their fixes go through `/review-loop code` again.
4. Merge with a merge commit (the only method the repo allows), once the owner approves.
5. Delete the branch. GitHub deletes the remote branch on merge; delete the local one with `git branch -d`.
6. Move the ticket to **Done**.
7. Sync: `git checkout main && git pull`.
8. Hand off: give the owner a short summary of the ticket and a ready-to-paste prompt to start the next ticket in the approved order (How to work → **Order:**) in a new chat. Before writing it, Claude reviews the order of the next ticket's group (How to work → **Order:**) and updates the Jira rank once the owner approves the order. The prompt holds the context (what merged, the order and the deferred items with their tickets), the ticket and lifecycle steps, why, scope and constraints, so each chat keeps one ticket's context. If the next ticket is directly related and best built right after, say so and offer to continue in the same chat instead.

## Definition of Done
- Acceptance criteria met.
- Stories: a Playwright test titled `@TAN-x …`. Tasks: an automated check of their criteria (Vitest unit test, lint rule or CI check) referencing the key.
- Lint, typecheck and tests green in CI: `main` only accepts a PR whose `checks` and `e2e` jobs pass.
- Stories: an exploratory session on the PR preview (QA column), with no open bugs, before merging.
- PR merged with the key in branch and title.
- Preview deployed.

## Hard rules
- **Local-first:** session content (charters, notes, bugs, screenshots) never leaves the browser. No network calls with session data. Analytics and error tracking (v1.0) must never include session content.
- **Data access only through `src/data`**; components never call IndexedDB directly. Every record has a UUID.
- **Time is the sum of stored time segments**, never an in-memory counter.
- **No hard-coded colors:** use the tokens in `src/theme`. **No hard-coded UI text:** use `src/i18n`.
- SBTM terms are never translated: Charter, Explore / With / To discover, Note / Bug / Issue, PROOF, TBS.
- **Public by default:** no real client names, data or screenshots in code, tests, fixtures or docs. Use fictional e-commerce examples.
- Never commit secrets. No `.env` with real values.
- Accessibility: real buttons and labels, visible focus, WCAG AA contrast, respect "reduce motion".
