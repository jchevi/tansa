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

## Folder structure

| Path            | What lives there                                        |
| --------------- | ------------------------------------------------------- |
| `docs/`         | Product spec and decision log                           |
| `src/features/` | UI grouped by feature (charter, session, debrief, ...)  |
| `src/data/`     | IndexedDB access; the only place that touches storage   |
| `src/i18n/`     | Language files; no UI text lives in components          |
| `src/theme/`    | Color tokens; no hard-coded colors in components        |
| `src/main.tsx`  | App entry point                                         |
| `src/App.tsx`   | Root component                                          |

Components never call IndexedDB directly: they go through `src/data`. This keeps storage swappable and testable.
