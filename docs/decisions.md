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
| 2026-11-03 | Kisaragi light palette approved as in the mockups, with one change: `--color-accent-strong` (small orange text and links) is `#B54B27` instead of `#C9532B` | `#C9532B` gives 3.85:1 on bg and fails WCAG AA; `#B54B27` gives 4.57 on bg and 4.99 on card |
| 2026-11-03 | The focus ring uses `--color-primary` (navy), checked at 3:1 on bg, surface and card | The mockup's orange gives 2.83:1 on bg and fails WCAG 1.4.11 (non-text contrast) |
| 2026-11-03 | Finding colors (Note, Bug, Issue) are never used as text; tags use `--color-ink` on the finding's `-bg` tint (20 % over card, stored as opaque hex) | Each color on its own tint measures 2.91 / 2.49 / 1.85:1, far below AA |
| 2026-11-03 | Accent and finding colors are decorative in v0.1: never the only way to tell things apart | Buttons are identified by their text (on-accent on accent is 5.03:1); tags and status always carry a text label. The 3:1 check of 1.4.11 starts with input borders (`--color-hair`) and the selected-chip border in TAN-18/19 |
| 2026-11-03 | Status colors for History (`--color-status-debrief`, `--color-status-closed`) will be their own tokens, added with TAN-16, even if their values match Issue and Note today | A status is not a finding; separate names let a theme change one without the other |
| 2026-11-03 | The navigation pill, "+" button and bottom-left pill move from TAN-12 to TAN-17 | They need UI text (i18n arrives in TAN-13) and screens to link to; R14 puts navigation with Home |

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
| 2026-10-28 | ~~Planned infrastructure: Cloudflare Pages (hosting), Sentry (errors), PostHog (usage events only, never content); a backend (Cloudflare Worker or Supabase) only when integrations arrive~~ — superseded on 2026-10-29 | — |
| 2026-10-29 | ~~PR previews on Cloudflare Pages from v0.1 (TAN-11); production deployment stays in v1.0~~ — superseded on 2026-10-29 | — |
| 2026-10-29 | Planned infrastructure: Cloudflare Workers with static assets (hosting), Sentry (errors), PostHog (usage events only, never content); a backend (Cloudflare Worker or Supabase) only when integrations arrive | Free tiers that allow commercial use. Cloudflare recommends Workers over Pages for new projects and focuses new features there; a future backend Worker lives on the same platform |
| 2026-10-29 | PR previews on Cloudflare Workers from v0.1 (TAN-11), built by Workers Builds (Cloudflare's GitHub integration). `main` deploys to the `workers.dev` URL; the public launch (custom domain, monitoring) stays in v1.0 | Every story can be tested in the browser before merging, at no cost. Cloudflare pulls from GitHub, so no Cloudflare token is stored in the public repo's secrets |
| 2026-10-29 | CI on GitHub Actions: one workflow, two parallel jobs (`checks`: format, lint, typecheck, unit tests, build; `e2e`: Playwright), on every PR and every push to `main` | Faster feedback, and a failing check says at a glance whether it is static checks or the browser. Each job starts on a clean machine, so more jobs would repeat the install for little gain |
| 2026-10-29 | CI reads Node from `.nvmrc` and caches npm downloads keyed on `package-lock.json`; Playwright browsers are not cached | One source of truth for the Node version. Playwright advises against caching browsers: restoring takes about as long as downloading, and system dependencies need installing anyway |
| 2026-10-29 | The Playwright HTML report is uploaded as an artifact on every run that was not cancelled, kept 14 days | The report and traces are needed most when tests fail; 14 days covers debugging without piling up storage |
| 2026-10-29 | `main` is protected by a ruleset: changes go through a PR, and the `checks` and `e2e` checks must pass | A PR with a failing check cannot be merged, so `main` always passes CI |
| 2026-11-03 | Color tokens are CSS custom properties in one file, `src/theme/tokens.css`, with semantic names (`--color-ink`, `--color-on-accent`), not TypeScript constants | The browser resolves `var()` at runtime, so a v0.2 theme only redefines the variables, with no component changes. Names say the role, so a dark theme swaps values, not names. `on-*` is the text that sits on that color |
| 2026-11-03 | Hard-coded colors are blocked by Stylelint in CSS (`color-no-hex`, `color-named`, a case-insensitive `function-disallowed-list` including `rgba`/`hsla`/`device-cmyk`, and system colors such as `Canvas` on color properties; all off only for `tokens.css`) and by an ESLint `no-restricted-syntax` rule in `src/**/*.{ts,tsx}` (test files excluded): hex and color functions in strings, template literals and JSX text, plus an allow-list on style object color properties (`color`, `fill`, `stroke`, `background`, `*Color`) that only accepts `var()`, `color-mix()`, `url()` and keywords such as `transparent`. A Vitest test runs both real configs on bad and good snippets | ESLint cannot read CSS. A misconfigured rule passes everything, so the guard itself is tested. Found by code review on PR #7: upper-case `RGB()`, system colors, hex after a quote (`fill='#fff'`) and named colors in style objects all passed before |
| 2026-11-03 | The color guards also cover (TAN-29): in TS/TSX, quoted keys (`'background-color'`), template literals without `${}`, color attributes on lower-case JSX elements (`fill`, `stroke`, `color`, `stop-color`, `flood-color`, `lighting-color`, as a string, `{'…'}`, `` {`…`} `` or a ternary branch), any fixed string (no `${}`) assigned to canvas `fillStyle` or `strokeStyle`, and a `color-mix()` argument that is a word other than `var()`, `transparent` or `currentColor`. In CSS, system colors on any property whose name contains `color`, the shorthands, `-webkit-text-stroke` and custom properties (`--x: Canvas`). Known gaps, each checked against the real config: shorthand strings (`border: '1px solid white'`); interpolated templates and concatenation (`` `white${x}` ``, `'white' + x`); values from variables (`color: c`); only a direct string, plain template or one-level ternary branch is read, so `fill={on && 'red'}`, nested ternaries, `'red' as const` and `ctx.fillStyle = c ?? 'red'` pass; DOM style assignments (`el.style.color = 'white'`); custom-property keys in style objects (`{ '--x': 'white' }`); color props on components and member elements (`<Icon fill="red" />`, `<m.rect fill="red" />`); canvas `shadowColor`, `addColorStop()` and bracket access (`ctx['fillStyle']`); a fallback inside `var()` within `color-mix()` (`var(--a, white)`) and interpolated `color-mix()`. In CSS: upper-case property names (`STOP-COLOR: Canvas`) and system colors in `filter` (`drop-shadow(0 0 2px Canvas)`; named colors there are still caught by `color-named`). False positives: in CSS, a system-color word anywhere in a custom property value, including inside strings, `url()` and animation names (`--font: "Canvas Sans"`, `--pulse: highlight 1s`); in TS, the SVG paint keywords `context-fill` and `context-stroke`, and `fillStyle`/`strokeStyle` on objects that aren't a canvas. A hex value on a color attribute or canvas is reported twice (hex and allow-list), as on style objects | Code review of the merged PRs found that `fill` and `stroke` were only checked in style objects, not in JSX. JSX color attributes are checked only on lower-case elements because `color` is a common component prop (`<Button color="primary">`) and `fill="freeze"` is an SVG animation mode. Canvas cannot resolve `var()`, so any string there is wrong: read the token with `getComputedStyle`. The `color-mix()` check stays inside one level of parentheses, so the next part of a multi-part shadow isn't read as an argument |
| 2026-11-03 | The ESLint rule matches a hex color anywhere in a string (after start, space, comma, `(`, `:`, a quote, `=` or `/`), not only when the whole string is a color | The likely leak is `'1px solid #fff'`, which a whole-string match misses silently. The cost is a false positive on hex-shaped words such as `'#add'`, fixed with `eslint-disable-next-line` and a reason: a visible false positive beats an invisible miss |
| 2026-11-03 | Text contrast is a Vitest unit test: the WCAG 2.x formula (checked first against known answers) measures each token pair listed in `src/theme/token-roles.ts` (4.5:1 text, 3:1 non-text). Every token must be classified there, and the token parser fails on any value that isn't `#RRGGBB` | Pure and fast, and nothing can skip the check silently. Known gaps: text dimmed with `opacity` isn't measured (dim with `--color-muted` instead), and named colors in TS are caught only on color properties, not inside shorthand strings such as `border: '1px solid white'`. axe-core in Playwright is the later check of what is actually rendered |
| 2026-11-03 | Fonts are self-hosted with Fontsource, latin subset only (`latin-<weight>.css`): Zen Maru Gothic 700/900, Zen Kaku Gothic New 400/500/700, IBM Plex Mono 400/500 | No third-party request, works offline for the PWA. The default entry references about 118 Japanese chunks per weight that Vite copies into `dist/` (3.5 MB for Maru 700 alone vs 11 KB latin): about 20 MB for seven weights, against 171 KB now. Spanish fits in latin. 探査 on Home falls back to a system font until TAN-17 adds just the glyphs it needs |
| 2026-11-03 | The end-to-end font check asserts that a `FontFace` with the family and weight reaches status `loaded` after `document.fonts.load()`, not `document.fonts.check()` | `check()` returns true for a family that was never registered, so a missing import would still pass. The weights are read from `fonts.ts`, with a fixed count, so a dropped import fails too |

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
| 2026-10-29 | Merge commits only (squash and rebase disabled in the repo); head branches are deleted automatically on merge. The full ticket lifecycle lives in `CLAUDE.md` | Each ticket keeps its per-concern commits (e.g. `test(e2e)`, `docs(test)`) in `main`, and the merge commit groups them under the PR. Automatic deletion removes a step nobody has to remember |
| 2026-10-29 | Definition of Done revised (see below) | The first version could not be met by the bootstrap tasks |

## Definition of Done

- Acceptance criteria met.
- Stories: a Playwright test titled `@TAN-x …`. Tasks: an automated check of their criteria (Vitest unit test, lint rule or CI check) referencing the key.
- Lint, typecheck and tests green in CI.
- Stories: an exploratory session on the PR preview (QA column), with no open bugs, before merging.
- PR merged with the key in branch and title.
- Preview deployed.

TAN-9 to TAN-11 bootstrap the tooling: each one meets the DoD items whose tooling already exists, plus its own "Done when".
