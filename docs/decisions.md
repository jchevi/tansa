# TANSA — Decision log

Key product, design and engineering decisions, with the reason behind each one. Newer entries can supersede older ones; superseded entries are kept and marked. Requirements live in [`spec.md`](spec.md); the backlog lives in Jira (project key `TAN`).

## Product

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Build a small web app for exploratory testing sessions based on SBTM (Jonathan and James Bach) | A real, scattered need; the author is an expert user; no regulatory risk; small scope |
| 2026-10-28 | Name: TANSA, from Japanese 探査 (*tansa*, "exploration, probing"; 探査機 = space probe) | Fits the product and the visual identity |
| 2026-10-28 | Findings follow the official SBTM session sheet: Note, Bug, Issue. Issue = everything that is not a bug (questions, blockers, risks) | Stay with the convention testers already know |
| 2026-10-28 | TBS is estimated at the end, in the debrief, with an automatic, adjustable proposal. Nothing is marked during the session | Bach's original convention; marking modes live was friction |
| 2026-10-28 | MVP without integrations; Markdown export (copy or download) ready to paste into Jira | Small MVP with no backend; integrations are their own later phase |
| 2026-10-28 | Screenshots renamed automatically as `{date}_{session}_{note}_{n}.png`; the Markdown report holds placeholders, and images are downloaded separately | Each file makes sense when attached by hand to a Jira issue |
| 2026-10-28 | *(Provisional)* Export also produces a re-importable `.tansa` session file (JSON with screenshots) | Recover a full session without filling browser storage; base for future integrations |
| 2026-10-28 | No accounts and no session sharing | Single user; the export is enough |
| 2026-10-29 | Streak removed; the term "gamification" is not used. The *hanko* stamp on closing the debrief, the *ensō* timer and micro-animations stay as visual details | The streak was not understood; what remains is not gamification |
| 2026-10-29 | English and Spanish at least; English first. Spanish and the language selector before v1.0. SBTM terms are not translated | Reach both audiences; SBTM terms are industry vocabulary |

## Design

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Web first, as an installable PWA running in its own window | Behaves like a desktop app on Windows; keeps Microsoft Store and mobile open |
| 2026-10-28 | Designed for two monitors: full window on the secondary one. Compact mode comes later | The target user's usual way of testing |
| 2026-10-28 | Session screen: a document (session as a page) with a large input fixed at the bottom, plus Focus mode as an alternative view | Document reads well during long sessions; the fixed input keeps note-taking one shortcut away |
| 2026-10-28 | Style: calm Japanese minimalism (organic shapes, pill buttons, "leaf" shapes with one pointed corner, large bold titles) | Calm during long sessions and a reason to come back |
| 2026-10-28 | Animated *karesansui* background: ink rocks with up to 4 sand rings drawn slowly; nearby rings merge (distance field + marching squares); regenerated about every 30 s, always in the margins; static with "reduce motion" | Calm, distinctive identity; respects accessibility settings |
| 2026-10-28 | Light and dark themes on color variables in the MVP, with 2–3 predefined palettes; custom theme editor in v2 | Adding themes later forces revisiting every screen |
| 2026-10-28 | First palette: Kisaragi (February colors) | Taken from a book of traditional Japanese colors |
| 2026-10-28 | Fonts: Zen Maru Gothic (titles, wordmark), Zen Kaku Gothic New (UI), IBM Plex Mono (times, file names) | Rounded Japanese type: friendly and consistent with the style |
| 2026-10-29 | Navigation: Home as the start screen with a centered menu; elsewhere, a top-left pill ("tansa" · Session · History), a "+" button outside it, and discreet theme and Settings icons at the bottom left. "Session" only shows when one is in progress | Settings and theme had too much weight; a clean start screen |
| 2026-10-29 | "Sessions" renamed "History" | Says what it holds and is not confused with "Session" (the current one) |

## Engineering

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Stack: Vite + React + TypeScript | Easiest path to a PWA and to mobile |
| 2026-10-28 | Local-first: IndexedDB, no server. No session content ever leaves the browser | Confidentiality of the systems under test |
| 2026-10-28 | Time is stored as segments (running/paused), never as an in-memory counter | Reloads never lose time; pauses do not count |
| 2026-10-28 | Every entity has a UUID from day one | Keeps future sync and integrations possible |
| 2026-10-29 | Color tokens from v0.1: only variables, one theme (Kisaragi light), no theme switch until v0.2 | Avoids revisiting every screen when themes arrive |
| 2026-10-29 | No UI string in code from v0.1: language files only | Same reason as tokens: Spanish must not mean hunting strings |
| 2026-10-29 | Vitest as the unit test runner, set up in TAN-9 | Shares Vite's config; unit tests are needed from the data layer onwards |
| 2026-10-29 | Node 26 (Active LTS), pinned in `.nvmrc` and `engines` | Current Vite, Vitest and ESLint need Node ≥ 22.13; one version for local and CI |
| 2026-10-29 | TypeScript pinned to 6.0 instead of 7 | typescript-eslint supports TypeScript < 6.1 only; ESLint with type-aware rules matters more than the faster compiler. Revisit when typescript-eslint supports 7 |
| 2026-10-29 | Prettier formats code and config, not Markdown | Prettier pads Markdown tables, so editing one row rewrites the whole table in diffs |
| 2026-10-29 | `.gitattributes` forces LF line endings | Development on Windows, CI on Linux; avoids whole-file diffs from CRLF/LF changes |
| 2026-10-29 | Playwright for end-to-end tests in `e2e/`, run against the production build (`build` + `preview`) | Tests the same bundle that is deployed to previews; dev mode can hide bundling bugs. A separate folder keeps Playwright and Vitest from collecting each other's files |
| 2026-10-29 | End-to-end tests run in Chromium only; no Edge project | Edge is Chromium-based, so a second project would double run time for little extra signal. Edge stays a target browser for manual exploratory sessions |
| 2026-10-29 | `eslint-plugin-playwright` with `valid-title` requiring titles to start with `@TAN-<n> ` | Enforces the key-in-title convention automatically and catches common end-to-end mistakes (missing `await`, fixed waits, focused tests) |
| 2026-10-29 | Locators by role and label first; test ids only as a last resort | Tests interact the way users and assistive technology do, so they also guard accessibility |
| 2026-10-28 | Planned infrastructure: Cloudflare Pages (hosting), Sentry (errors), PostHog (usage events only, never content); a backend (Cloudflare Worker or Supabase) only when integrations arrive | Free tiers that allow commercial use |
| 2026-10-29 | PR previews on Cloudflare Pages from v0.1 (TAN-11); production deployment stays in v1.0 | Every story can be tested in the browser before merging, at no cost |

## Process

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Jira Cloud (Free), team-managed space, key `TAN`. Scrum template: 2-week sprints with a Sprint Goal; releases v0.1, v0.2, v0.3, v1.0 (MVP) and v2 (parking). WIP limit 1 in progress | Fixed-length sprints per the Scrum Guide; ready for future collaborators |
| 2026-10-29 | ~~Board: To Do · In Progress · Done. Review (open PR + green CI) is part of the Definition of Done, not a column. Blockers use flags~~ — superseded on 2026-10-29 | — |
| 2026-10-29 | Board: To Do · In Progress · QA · Done. A story enters QA when its PR is open, CI is green and the preview is deployed; in QA it gets an exploratory session on the preview; bugs found send it back to In Progress; it moves to Done when the session is clean and the PR is merged. Tasks skip QA. Blockers use flags | Exploration on the preview is a distinct step with its own outcome; showing it makes QA work and bounce-backs visible. Tasks are covered by their automated check |
| 2026-10-28 | Issue types: Epic, Story, Task, Bug, Subtask; spikes are Tasks with the `spike` label. 8 epics by functional area (TAN-1 to TAN-8) | Minimal standard hierarchy; one epic per requirement would be too thin |
| 2026-10-28 | Native fields only; acceptance criteria in Gherkin inside the description; no estimation at first. Labels: `spike`, `tech-debt`, `a11y`, `performance`, `build-log` | Small scope, little configuration |
| 2026-10-29 | Edge cases proposed for every story (shift-left) | Gaps surface before code, not after |
| 2026-10-28 | Git: branch `TAN-12-short-slug`, conventional commits with the key, PR title with the key | Traceability: requirement → story → test → PR |
| 2026-10-28 | ~~Private GitHub repo at first~~ — superseded on 2026-10-29 | — |
| 2026-10-29 | Public GitHub repo from the start. Never secrets or real data in the history | Branch protection is free on public repos; the repo was going public anyway; building in public is part of the portfolio |
| 2026-10-28 | Sessions can target any app, but public material (tests, demos, screenshots) only uses public or practice apps | No confidential data in public material |
| 2026-10-28 | Product documentation lives in the repo (`docs/`), no Confluence for now | One source of truth, versioned with the code and readable by Claude Code |
| 2026-10-29 | Definition of Done revised (see below) | The first version could not be met by the bootstrap tasks |

## Definition of Done

- Acceptance criteria met.
- Stories: a Playwright test titled `@TAN-x …`. Tasks: an automated check of their criteria (Vitest unit test, lint rule or CI check) referencing the key.
- Lint, typecheck and tests green in CI.
- Stories: an exploratory session on the PR preview (QA column), with no open bugs, before merging.
- PR merged with the key in branch and title.
- Preview deployed.

TAN-9 to TAN-11 bootstrap the tooling: each one meets the DoD items whose tooling already exists, plus its own "Done when".
