# v0.1 mockups

The approved v0.1 screens from the TANSA Mockups MVP canvas (approved 2026-10-29). The canvas cannot be opened from the repo, so this folder holds a screenshot of each screen state and the screen sources. The mockup is the reference for every plan (see the Mockup check in `CLAUDE.md`).

## Screens

| File | Canvas artboard | Screen state | Tickets |
| --- | --- | --- | --- |
| `home-session-running.png` | v0.1 · Home | Session in progress ("Resume session") | TAN-17 |
| `home-no-session.png` | v0.1 · Home | No session ("New session") | TAN-17 |
| `new-session-empty.png` | v0.1 · New session (charter) | Empty charter: placeholders and "Missing: …" | TAN-18, TAN-19, TAN-20 |
| `new-session-partly-filled.png` | v0.1 · New session (charter) | Explore and With filled, To discover missing | TAN-18 |
| `session-document.png` | v0.1 · Session (document + focus) | Document view | TAN-21 to TAN-26 |
| `session-focus.png` | v0.1 · Session (document + focus) | Focus view | v0.3 (R11) |
| `history.png` | v0.1 · History | Session in progress and past sessions | TAN-16 |
| `history-empty.png` | v0.1 · History | Empty state | TAN-16 |

`source/` holds each screen's source (`.dc.html`: HTML with inline styles and a small script): read it for exact sizes, radii, gaps and copy. It does not run outside the canvas, and its links point to canvas file names. File names: `home`, `new-session`, `session` and `history` (on the canvas: `Home`, `NuevaSesion`, `Alt6-Combinada` and `Sesiones`).

## What a mockup does not decide

- **Departures** approved by the owner (colors that fail contrast, the focus ring, tints, the header timer…) are listed only in the Mockup departures table of `docs/decisions.md`. A difference not listed there is a bug in the plan.
- **Scope:** some parts of these screens arrive in later versions (theme switch and Settings in v0.2; karesansui background and Focus view in v0.3). `docs/spec.md` and the ticket say what each version builds.
- **Colors** always come from `src/theme/tokens.css`, never from a hex in the source.
- **Sample data** (charters, codes, `qa+01@example.com`, dates) is fictional and only fills the screens.

## How the screenshots are made

Each artboard rendered in Chromium (Playwright) at 1440 × 960, light theme, reduced motion so the background is drawn complete, with the same font families from Fontsource. When the canvas changes, the owner exports the changed sources and the screenshots are made again the same way, in the ticket that changes the design.
