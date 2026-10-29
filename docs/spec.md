# TANSA — MVP specification

> Source of truth for product requirements. Decisions and their reasons live in [`decisions.md`](decisions.md). Backlog and acceptance criteria live in Jira (project key `TAN`).

The MVP lets a tester plan, run, close and export a complete exploratory testing session (Session-Based Test Management, SBTM) in a local web app, with no accounts and no integrations.

## Problem and goals

**Problem.** Testers doing exploratory testing log their sessions in generic tools (Google Docs, OneNote, XMind, paper) or in free SBTM tools with dated interfaces. They lose three things: control of time (time-box and TBS), the reasoning behind each test, and a structured debrief. At the end, they rewrite bugs and the report by hand.

**Target user.** An experienced individual tester who works with two monitors: the app under test on the main one and TANSA on the secondary one. The first user is the author.

| # | Goal | How it is measured |
| --- | --- | --- |
| 1 | A full session (charter → notes → debrief → export) without leaving the app | The author completes 5 real sessions without using another tool for notes or the report |
| 2 | Taking notes does not break focus | Creating a note takes 1 shortcut + text + Enter, in under 5 seconds |
| 3 | Closing a session is fast | The PROOF debrief is completed in under 10 minutes, starting from the notes |
| 4 | The report is ready to use | The session sheet and each bug export to Markdown and paste into Jira or Confluence with no format edits |
| 5 | It works as a portfolio piece | Deployed app, repo with a clean history and a case study documenting how Claude was used in each phase |

## Non-goals

| Will not do | Why |
| --- | --- |
| Integrations (Jira, Claude, Slack…) | They need a backend and OAuth; researched as their own phase after the MVP |
| Accounts, sync or session sharing | Single user; the Markdown export covers the review flow |
| Screen recording or capturing other windows | Needs permissions or an extension; pasting screenshots from the clipboard is enough |
| Scripted test case management | A different kind of tool (Testpad, Xray); TANSA is exploratory only |
| Compact mode for one monitor | The target user has two; iterated later |
| History with aggregated metrics | Valuable with many sessions, not the first one; moved to P1 |

## User stories

All stories share one persona: a tester running an exploratory session. They are ordered by the moment in the session.

**Before**
- **US-01** As a tester, I want to write the charter (Explore / With / To discover) so that the session has a clear mission.
- **US-02** As a tester, I want to record the environment, build and test data so that bugs are reproducible.
- **US-03** As a tester, I want to choose the session length so that I respect the time-box.

**During**
- **US-04** As a tester, I want to see elapsed and remaining time so that I know when to wrap up.
- **US-05** As a tester, I want to add a note with a shortcut and no mouse so that I keep my focus.
- **US-06** As a tester, I want to tag each finding (Note, Bug, Issue, as in the SBTM session sheet) so that I classify findings as I go.
- **US-07** As a tester, I want to paste a screenshot into a note so that evidence stays with the finding.
- **US-08** As a tester, I want to estimate at the end where my time went (Test, Bug, Setup) without marking it during the session.
- **US-09** As a tester, I want to edit or delete a note so that I fix mistakes without losing the original time.
- **US-10** As a tester, I want to pause the session so that an interruption does not count as testing time.

**After**
- **US-11** As a tester, I want a PROOF debrief screen with my notes already sorted by section so that I close in minutes.
- **US-12** As a tester, I want to complete each bug with steps, expected and actual results so that it is a useful report.
- **US-13** As a tester, I want to export the session sheet and bugs to Markdown so that I can paste them into Jira or Confluence.
- **US-14** As a tester, I want to see my past sessions and reopen them so that I can review or re-export them.

**Edge cases**
- **US-15** As a tester, I want my session to survive closing the window or reloading so that I never lose work.
- **US-16** As a tester, I want a warning when I reach the time limit, without the session closing by itself, so that I decide when to stop.

## P0 requirements (the MVP does not ship without these)

### R1. Charter and context (US-01, US-02, US-03)
- [ ] Form with three required fields: Explore, With, To discover.
- [ ] Optional fields: areas (free list), build/version, environment, test data.
- [ ] Target duration with options 45, 60, 90 and 120 minutes; 60 by default.
- [ ] Without the three required fields, "Start session" is disabled and says what is missing.

### R2. Timer (US-04, US-10, US-16)
- [ ] Shows elapsed and remaining time, always visible on the Session screen.
- [ ] Pause and resume; paused time counts neither in the duration nor in TBS.
- [ ] At the limit: visual warning and optional sound. The session stays open and overtime is shown in a different color.
- [ ] Time is computed from stored timestamps, not from an in-memory counter: reloading does not change it.

### R3. Notes (US-05, US-06, US-09)
- [ ] A shortcut focuses the note input from anywhere on the Session screen (`N`). `Enter` saves; `Shift+Enter` adds a line break.
- [ ] Each note stores its time, both session-relative and absolute.
- [ ] One tag per note, following the SBTM session sheet: Note (default), Bug, Issue. Issue is everything that is not a bug: questions, blockers, risks. It is changed before saving with `Alt+1…3` or a click.
- [ ] Notes are shown in chronological order and can be filtered by tag.
- [ ] Editing keeps the original time; deleting asks for confirmation.

### R4. Screenshots (US-07)
- [ ] `Ctrl+V` with an image in the clipboard attaches it to the note being written; dragging a file also works.
- [ ] Thumbnail in the note; click to see it full size.
- [ ] Images over 5 MB are rejected with a clear message.
- [ ] Each screenshot is renamed automatically as `{date}_{session}_{note}_{n}.png`, e.g. `2026-10-28_checkout-promos_BUG-03_1.png`. The session part is a short slug of the charter's Explore, with no accents or spaces and about 30 characters at most.

### R5. TBS estimate (US-08)
- [ ] No activity is marked during the session: there is no selector.
- [ ] On closing, TANSA proposes a split using Bach's convention: Test design and execution, Bug investigation and reporting, and Session setup, adding up to 100 %. Separately, Charter vs. Opportunity, also adding up to 100 %.
- [ ] Proposed estimate: time until the first note counts as Setup, time spent completing bug details counts as Bug, and the rest as Test.
- [ ] The tester adjusts each value with a slider; each group always adds up to 100 %.

### R6. PROOF debrief (US-11)
- [ ] When the session ends, the debrief opens with its five sections, pre-filled without AI:
  - Past: charter, areas and Notes.
  - Results: Bugs.
  - Obstacles: Issues.
  - Outlook: empty, with room for the next recommended charter.
  - Feelings: empty.
- [ ] Each section is editable text; pre-filled items can be moved to another section.
- [ ] Feelings is required to mark the session as closed; the rest may stay empty.
- [ ] Includes the TBS estimate (R5) and actual vs. target duration.

### R7. Bug detail (US-12)
- [ ] Each Bug can be expanded with: title, steps, expected result, actual result, severity (Critical, High, Medium, Low) and screenshots. The environment is inherited from the charter.
- [ ] A bug with no title or steps is still exported, marked as "incomplete".

### R8. Markdown export (US-13)
- [ ] Exports the full session sheet: charter, context, times, TBS, notes, bugs and debrief.
- [ ] Exports each bug separately, formatted for the description of a Jira issue.
- [ ] Two actions: copy to clipboard and download file. The Markdown report contains no images: each screenshot appears as a placeholder with its file name, and each image is downloaded separately with that same name, to be attached by hand.
- [ ] The Markdown renders correctly when pasted into Jira Cloud and Confluence.

### R9. Local persistence and PWA (US-14, US-15)
- [ ] Everything is saved in the browser (IndexedDB) instantly, with no save button.
- [ ] Closing the window mid-session and opening it again resumes the session in the same state.
- [ ] Session list with date, charter, duration and status (in progress, in debrief, closed); any session can be reopened and re-exported.
- [ ] Installable as a PWA in Chrome and Edge on Windows; opens in its own window and works offline.
- [ ] No session data leaves the browser: the app makes no network requests containing session content.

### R10. Session file and import (provisional, to be reviewed)
- [ ] Besides the Markdown report, export produces a `.tansa` session file (JSON inside) with all session data and its screenshots.
- [ ] Importing a `.tansa` file restores the full session, images included, in the state it was exported.
- [ ] After exporting, TANSA asks the user to confirm the file is saved, then deletes the screenshots from the browser. The session text is kept.
- [ ] A damaged file or one from another version is rejected with a clear message, without touching existing data.
- [ ] `.tansa` is the format future integrations (Claude, Jira) will consume.

### R11. Focus mode
- [ ] A Document | Focus switch changes the session view without losing data or state.
- [ ] Focus shows only the large *ensō* timer, the finding input with its tag, and the last three findings.
- [ ] From Focus, a finding can be logged and a screenshot pasted just as in Document.
- [ ] `Tab` toggles between the two views.

### R12. Animated background (*karesansui* garden)
- [ ] Ink rocks in the margins, with up to 4 rings per rock drawn one by one, slowly.
- [ ] Rings of nearby rocks merge into a single curve instead of overlapping.
- [ ] When complete, the garden fades out and a new random one is generated, always outside the central content column.
- [ ] With "reduce motion" enabled in the system, the garden is static.
- [ ] Generating a garden takes under 100 ms and the animation does not affect note typing.

### R13. Themes and Settings
- [ ] Light and dark themes built on color variables, from the first screen.
- [ ] 2–3 predefined palettes from a book of traditional Japanese colors; the first is Kisaragi.
- [ ] Moon↔sun button to switch theme, with a morphing animation.
- [ ] Settings screen with theme and palette; other options are defined in the mockups.
- [ ] Custom theme editor: out of the MVP (v2).

### R14. Home and navigation
- [ ] The app starts on Home: no surrounding menus, just a grouped, centered menu over the *karesansui* background.
- [ ] If a session is in progress, the main button is "Resume session"; otherwise "New session". The menu also includes New session, History, Settings and theme switch.
- [ ] On every other screen, a top-left pill holds the "tansa" logo (back to Home) · Session · History; the "+" button (new session) sits outside the pill; theme and Settings are discreet icons at the bottom left.
- [ ] "Session" appears in the navigation only when a session is in progress.

### R15. Languages
- [ ] The interface is available in English and Spanish; English comes first.
- [ ] No interface text is written in the code: all of it comes from language files.
- [ ] The default language is the browser's; it can be changed in Settings.
- [ ] SBTM terms (Charter, Explore / With / To discover, Note / Bug / Issue, PROOF) are not translated.

## P1 and P2 requirements

**P1: first improvements after the MVP.** They improve the experience, but a full session works without them.

| Requirement | Value |
| --- | --- |
| Heuristics panel (SFDIPOT, FEW HICCUPPS, tours), chosen in the charter | Ideas at hand during the session without leaving the app |
| Turn an Outlook item into a new charter | Chains sessions, as SBTM intends |
| Backlog of pending charters | Plan several sessions at once |
| History with TBS per session and coverage per area | Spot broken environments (high Setup) and unexplored areas |
| Export to PDF | Share with people who do not use Markdown |
| Compact mode for one monitor | Use the app in a narrow window next to the app under test |
| Full backup: export and import all sessions in one file | Protect data against the browser being cleared |

**P2: future.** Not built now, but today's design must not prevent it.

| Requirement | What it means for today's design |
| --- | --- |
| Integrations (Jira, Claude, other connectors) | Bug data must have structured fields, not just free text |
| Claude assistant: draft debrief and bugs | Notes store tag and time: the context the model will need |
| Always-on-top floating window (Document Picture-in-Picture) | The Session screen must keep the timer + note input block as a reusable component |
| Cloud sync and teams | Unique IDs (UUID) for every session and note from day one |
| Packaging for Microsoft Store and mobile | Keep the app a standard PWA, with no browser-exclusive APIs |

## Screen flow

Home → New session (charter) → Session (Document | Focus) → Debrief → Export.

The main path is linear with no branches, so the tester does not have to think about the tool while testing. Bug detail and Export are auxiliary screens reached from the session or the debrief. History and Settings are reached from Home and the navigation. Pausing does not change screens: it is a state within the session.

## Data model

Entities in IndexedDB, all with UUIDs. This is the contract for the code; field names are in English as they appear in code.

| Entity | Main fields | Relationship |
| --- | --- | --- |
| Session | id, status (running · paused · debrief · closed), charter {explore, with, discover}, areas[], build, environment, testData, targetMinutes, createdAt, closedAt | Has many Note and TimeSegment, and one Debrief |
| Note | id, sessionId, tag (note · bug · issue), text, createdAt, attachments[], bug {title, steps, expected, actual, severity}? | Belongs to a Session; `bug` only when tag = bug |
| TimeSegment | id, sessionId, state (running · paused), startedAt, endedAt? | Belongs to a Session; the open segment has no endedAt |
| Debrief | sessionId, past, results, obstacles, outlook, feelings, tbs {test, bug, setup}, charterVsOpportunity {charter, opportunity} | One per Session |

Two decisions explain the rest:
- **Time is segments, not a counter.** Every pause or resume closes one segment and opens another. Duration is the sum of segments. That is why reloading never loses time (R2) and pauses do not count.
- **Screenshots are separate blobs.** `attachments[]` stores references to images kept in their own IndexedDB store, so listing sessions does not load megabytes of images.

## Success metrics

In the MVP the only user is the author, so metrics are measured by hand after each real session. Analytics (PostHog) arrive with the public deployment and will only record usage events, never session content.

| Type | Metric | Target |
| --- | --- | --- |
| Leading | Real sessions completed in the app | 5 in the two weeks after the MVP |
| Leading | Close-out time (session end → debrief closed) | Under 10 min |
| Leading | Format edits when pasting into Jira | None |
| Lagging | Still using the app after a month | Yes, without going back to Docs or OneNote |
| Lagging | Case study published and linked from the CV | Yes |

## Delivery plan

The code is built in four releases, each working on its own:

1. **v0.1** · Home, charter, timer, notes, local persistence, History; project setup, Playwright, CI and PR previews; color tokens and i18n.
2. **v0.2** · Screenshots, themes and Settings (R13).
3. **v0.3** · TBS estimate, PROOF debrief, bug detail, export and `.tansa` file, Focus mode and *karesansui* background.
4. **v1.0** · Installable PWA, Spanish, production deployment on Cloudflare Pages and monitoring.

End-to-end tests with Playwright ship with every release, not at the end.

## Open questions

- **Overtime sound (R2):** whether and which; decided later.
- **Screenshot deletion after export and `.tansa` format (R10):** provisional.
- **Settings options beyond theme, palette and language:** defined in the v0.2 mockups.
