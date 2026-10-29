# TANSA

TANSA (探査, "exploration") is a small local-first web app for running exploratory testing sessions with Session-Based Test Management (SBTM): charter, time-boxed session, findings (Note, Bug, Issue), PROOF debrief and a Markdown report ready for Jira.

It is built by one person (a senior QA engineer, intermediate programmer) as a public portfolio piece and a way to learn Claude across the whole lifecycle. **Explain the why of non-obvious decisions** in PR descriptions and when asked: the owner wants to understand, not just receive code.

## Stack
- Node 26 (pinned in `.nvmrc` and `engines`)
- Vite + React + TypeScript (`strict: true`). TypeScript is pinned to 6.0 until typescript-eslint supports 7 (see `docs/decisions.md`).
- IndexedDB for all data (local-first, no backend)
- Vitest for unit tests, Playwright for end-to-end tests (from TAN-10), GitHub Actions for CI (from TAN-11)
- Target browsers: Chrome and Edge on Windows (installable PWA from v1.0)

## Commands
- `npm run dev` · `npm run build` · `npm run preview`
- `npm run lint` · `npm run typecheck` · `npm run format` · `npm run format:check`
- `npm run test` (Vitest) · `npm run test:e2e` (Playwright, from TAN-10)

## Where things are
- `docs/spec.md`: MVP spec (requirements R1–R15, data model). Source of truth for behaviour.
- `docs/decisions.md`: decision log with reasons.
- Backlog: Jira, space TAN (https://jchevi.atlassian.net). Each ticket has Gherkin acceptance criteria.
- `src/features/*` UI by feature · `src/data` IndexedDB access · `src/i18n` strings · `src/theme` color tokens.

## How to work
1. One Jira ticket at a time. Start by reading the ticket and the related part of `docs/spec.md`.
2. Plan before coding: list the files you will touch and how each acceptance criterion will be tested. Wait for approval on anything non-trivial.
3. If the ticket is ambiguous or conflicts with the spec or a decision, **stop and ask**. Do not resolve it silently.
4. Keep scope small: anything not in the ticket goes into a note for a new ticket, not into the code.
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
2. Commit with Conventional Commits and the key; open the PR (key in the title, criteria in the body).
3. Stories: when CI is green and the preview is deployed, move the ticket to **QA** and run the exploratory session on the preview. Bugs found send it back to In Progress.
4. Merge with a merge commit (the only method the repo allows), once the owner approves.
5. Delete the branch. GitHub deletes the remote branch on merge; delete the local one with `git branch -d`.
6. Move the ticket to **Done**.
7. Sync: `git checkout main && git pull`.

## Definition of Done
- Acceptance criteria met.
- Stories: a Playwright test titled `@TAN-x …`. Tasks: an automated check of their criteria (Vitest unit test, lint rule or CI check) referencing the key.
- Lint, typecheck and tests green in CI.
- Stories: an exploratory session on the PR preview (QA column), with no open bugs, before merging.
- PR merged with the key in branch and title.
- Preview deployed.

TAN-9 to TAN-11 bootstrap the tooling: each one meets the DoD items whose tooling already exists, plus its own "Done when".

## Hard rules
- **Local-first:** session content (charters, notes, bugs, screenshots) never leaves the browser. No network calls with session data. Analytics and error tracking (v1.0) must never include session content.
- **Data access only through `src/data`**; components never call IndexedDB directly. Every record has a UUID.
- **Time is the sum of stored time segments**, never an in-memory counter.
- **No hard-coded colors:** use the tokens in `src/theme`. **No hard-coded UI text:** use `src/i18n`.
- SBTM terms are never translated: Charter, Explore / With / To discover, Note / Bug / Issue, PROOF, TBS.
- **Public by default:** no real client names, data or screenshots in code, tests, fixtures or docs. Use fictional e-commerce examples.
- Never commit secrets. No `.env` with real values.
- Accessibility: real buttons and labels, visible focus, WCAG AA contrast, respect "reduce motion".
