# TANSA

TANSA (探査, "exploration") is a small local-first web app for running exploratory testing sessions with Session-Based Test Management (SBTM): charter, time-boxed session, findings (Note, Bug, Issue), PROOF debrief and a Markdown report ready for Jira.

It is built by one person (a senior QA engineer, intermediate programmer) as a public portfolio piece and a way to learn Claude across the whole lifecycle. **Explain the why of non-obvious decisions** in PR descriptions and when asked: the owner wants to understand, not just receive code.

## Stack
- Vite + React + TypeScript (`strict: true`)
- IndexedDB for all data (local-first, no backend)
- Playwright for end-to-end tests, GitHub Actions for CI
- Target browsers: Chrome and Edge on Windows (installable PWA from v1.0)

## Commands
<!-- Fill in when TAN-9 is done -->
- `npm run dev` · `npm run build`
- `npm run lint` · `npm run typecheck` · `npm run format`
- `npm run test` (unit) · `npm run test:e2e` (Playwright)

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
5. Write the Playwright test from the acceptance criteria, then the code.

## Conventions
- Branch: `TAN-<n>-short-slug` (e.g. `TAN-18-session-charter`).
- Commits: Conventional Commits with the key, e.g. `feat(charter): block start until fields are filled [TAN-18]`.
- PR title starts with the key; the PR body lists each acceptance criterion and where it is tested.
- Playwright test titles start with the key: `@TAN-18 start is blocked until the charter is complete`.
- Everything in the repo is in English (code, comments, commits, docs).

## Definition of Done
- All acceptance criteria met.
- Playwright test(s) tagged with the ticket key, green.
- Lint, typecheck and unit tests green in CI.
- PR merged with the key in branch and title.
- Preview deployed (once deploy exists).

## Hard rules
- **Local-first:** session content (charters, notes, bugs, screenshots) never leaves the browser. No network calls with session data. Analytics and error tracking (v1.0) must never include session content.
- **Data access only through `src/data`**; components never call IndexedDB directly. Every record has a UUID.
- **Time is the sum of stored time segments**, never an in-memory counter.
- **No hard-coded colors:** use the tokens in `src/theme`. **No hard-coded UI text:** use `src/i18n`.
- SBTM terms are never translated: Charter, Explore / With / To discover, Note / Bug / Issue, PROOF, TBS.
- **Public by default:** no real client names, data or screenshots in code, tests, fixtures or docs. Use fictional e-commerce examples.
- Never commit secrets. No `.env` with real values.
- Accessibility: real buttons and labels, visible focus, WCAG AA contrast, respect "reduce motion".
