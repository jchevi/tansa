# TANSA

TANSA (探査, "exploration") is a local-first web app for running exploratory testing sessions with Session-Based Test Management (SBTM): charter, time-boxed session, findings (Note, Bug, Issue), PROOF debrief and a Markdown report ready for Jira.

All data stays in your browser (IndexedDB). There is no backend.

- Product spec: [`docs/spec.md`](docs/spec.md)
- Decision log: [`docs/decisions.md`](docs/decisions.md)

## Requirements

- Node.js 26 (see [`.nvmrc`](.nvmrc)). With nvm: `nvm install 26 && nvm use 26`.

## Commands

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm install`          | Install dependencies                          |
| `npm run dev`          | Start the dev server at http://localhost:5173 |
| `npm run build`        | Typecheck and build for production to `dist/` |
| `npm run preview`      | Serve the production build locally            |
| `npm run lint`         | Run ESLint                                    |
| `npm run format`       | Format code with Prettier                     |
| `npm run format:check` | Check formatting without changing files       |
| `npm run typecheck`    | Run the TypeScript compiler without emitting  |
| `npm run test`         | Run unit tests with Vitest                    |
| `npm run test:e2e`     | Build, serve and run end-to-end tests with Playwright |

## Folder structure

| Path            | What lives there                                        |
| --------------- | ------------------------------------------------------- |
| `docs/`         | Product spec and decision log                           |
| `e2e/`          | End-to-end tests (Playwright)                           |
| `src/features/` | UI grouped by feature (charter, session, debrief, ...)  |
| `src/data/`     | IndexedDB access; the only place that touches storage   |
| `src/i18n/`     | Language files; no UI text lives in components          |
| `src/theme/`    | Color tokens; no hard-coded colors in components        |
| `src/main.tsx`  | App entry point                                         |
| `src/App.tsx`   | Root component                                          |

Components never call IndexedDB directly: they go through `src/data`. This keeps storage swappable and testable.

## Tests

- Unit tests (Vitest) live next to the code as `src/**/*.test.ts`.
- End-to-end tests (Playwright) live in `e2e/` and run against the production build in Chromium. The first run needs the browser: `npx playwright install chromium`.
- Every test title starts with its Jira key, e.g. `@TAN-17 home screen and navigation`. ESLint enforces this for end-to-end tests. Run one ticket's tests with `npx playwright test --grep @TAN-17`.
- Prefer role and label locators (`getByRole`, `getByLabel`) over CSS selectors or test ids.

## Test data

No real client names or data in code, tests, fixtures, docs or screenshots. Use fictional e-commerce examples (a made-up shop, products and customers).
