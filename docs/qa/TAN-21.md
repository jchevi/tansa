# TAN-21 · See elapsed and remaining time — QA pack

This is the prep sheet for the exploratory session on the PR preview (QA column). It is not a list of scripted cases. The `@TAN-21` tests listed at the end already check the acceptance criteria in CI. This session covers what those tests cannot judge: how the timer looks and feels over real minutes, odd data, and steps in an odd order.

- **Build under test:** the Workers Builds preview of the TAN-21 PR (branch `TAN-21-session-timer`, https://tan-21-session-timer-tansa.jchevi.workers.dev).
- **Browsers:** Chrome and Edge on Windows. Light theme only: there is no dark theme before v0.2.
- **Before each charter:** clear site data (DevTools → Application → Storage → Clear site data), so no earlier session is in progress.
- **Time travel without waiting:** to test a session near or past its target, start a session, then paste this in the DevTools console. It moves the session's start back by `minutes`, the way the tests seed it, then reloads. Change `minutes` as needed.

  ```js
  await (async (minutes) => {
    const db = await new Promise((ok, ko) => { const r = indexedDB.open('tansa'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })
    const tx = db.transaction('timeSegments', 'readwrite'), store = tx.objectStore('timeSegments')
    const all = await new Promise((ok) => { const r = store.getAll(); r.onsuccess = () => ok(r.result) })
    for (const s of all) if (s.endedAt === undefined) store.put({ ...s, startedAt: s.startedAt - minutes * 60_000 })
    await new Promise((ok) => { tx.oncomplete = ok }); db.close(); location.reload()
  })(44)
  ```

## Charters

**1. A real session, in real time**
- **Explore:** the timer in the header over a real 45-minute session.
- **With:** a second app open beside TANSA, switching tabs and windows, a locked screen for 5 minutes, and the laptop asleep for 10 minutes. Use the time-travel snippet for the last minutes before the target.
- **To discover:** whether the timer is ever wrong when you come back. It is wrong if it is behind the clock on the wall, if it jumps backwards, or if elapsed plus remaining is not the target. Also check whether the ring's progress feels readable at a glance.

**2. Ending, and what comes after**
- **Explore:** End session and the Debrief placeholder.
- **With:**
  - a mis-click, a double click, Enter and Space;
  - a second tab on the same session, ending in one tab and then in the other;
  - reload and Back on `/debrief`;
  - Home and New session afterwards.
- **To discover:** whether a session can ever end twice, end by accident without you noticing, or seem still running after it ended.

**3. Keyboard, screen reader and layout**
- **Explore:** the header with the timer pill.
- **With:**
  - keyboard only, then Narrator (Win + Ctrl + Enter), in Chrome and Edge;
  - zoom at 100 %, 150 % and 200 %, and Windows text size at 150 %;
  - a window about 400 px wide, a short window (1366 × 768), and the long charter below.
- **To discover:** whether the timer and End session are announced clearly, stay in view when the page scrolls, and never overlap, clip or scroll sideways.

## How keyboard focus moves (expected, not a bug)

- The header is read in DOM order. **Tab** goes: tansa logo → Session → History → "+" (New session) → **End session** (on the Session screen only) → the page content. The bottom-left Settings link comes last.
- The timer itself is **not** a Tab stop. It is a group named "Session time" with an image ("37 of 60 minutes elapsed") and two times, read by a screen reader in browse mode. Nothing in it can be activated, so the keyboard skips it on purpose.
- The timer is **not announced on its own** while it ticks (it is not a live region). Narrator reads it when you move to it. That is intended: an announcement every second would drown everything else.
- The ring's label changes **once a minute** (whole minutes), while the digits change every second.
- **Enter or Space** on End session ends the session. Focus then falls back to the top of the page on `/debrief`, not to its heading. That is a known gap (TAN-85, and TAN-45 for navigation in general), not a bug of this ticket.
- While the session is ending, the button is disabled for a moment. Focus stays on it.

## Risks the automated tests do not cover

- **Real throttling.** Chrome slows timers in background tabs (to once a minute after 5 min) and freezes them in a sleeping laptop. The tests simulate this with a fake clock, so only a real session proves it.
- **The ring's look.** At 18 px, is a quarter of a ring readable against a full one? Does the orange arc read as "progress" and not as "warning"?
- **Reduce motion.** Turn off "Animation effects" in Windows (Settings → Accessibility → Visual effects) and reload. The arc should move in one-second steps, never glide. With effects on, it creeps forward smoothly.
- **Past the target.** Remaining stops at `00:00 left` and the ring stays full. There is no warning and no overtime colour until TAN-23. Note how it feels to have nothing tell you that you are over.
- **A mis-click on End session.** There is no confirmation and no way back to running in v0.1. That is decision 4, approved. If it happens in this session, it is an Issue to report, not a bug.
- **The sticky header.** It always takes about 76 px. On a short window, check that content can still be read and is never hidden under the header.
- **Two tabs.** A tab left on `/session` after another tab ended the session keeps showing the timer until it navigates. Its End session then shows "The session could not be ended. Try again." This is known (no sync across tabs in v0.1). Report it as an Issue if it confuses you.
- **One stale frame (TAN-49).** Right after End session, `/debrief` may show the timer for a single frame. It is a known bug with its own ticket.
- **`/debrief` by URL during a session.** It shows "Your session is saved." while the session is still running. This is known (TAN-84).
- **Earlier features.** Home's Resume button keeps its time (TAN-17). The in-progress notice on New session still replaces the form (TAN-18). The context card is unchanged (TAN-19). The Start label still names the duration (TAN-20).
- **Windows high-contrast mode (forced colors).** The ring's stroke colors are replaced by system colours. Check that the arc and track can still be told apart, and that the times stay readable.

## Test data (fictional e-commerce, ready to paste)

Charter fields. The context fields can stay empty.

| Case | Explore | With | To discover |
| --- | --- | --- | --- |
| Normal | the cart and promo codes | valid, expired and stacked codes | errors when applying or stacking discounts |
| Very long | the checkout flow when a shopper switches currency, applies three promo codes, removes one, changes the delivery address twice and pays with a saved card that has just expired SPRINGSALE2026FREESHIPPINGONALLITEMSWITHNOMINIMUMORDERFORRETURNINGCUSTOMERS | guest and signed-in accounts | rounding and stale totals |
| Emoji | the gift card page 🎁🛒 | a balance of €0.01 💳 | whether 👍🏽 reviews show up |
| RTL (Arabic) | سلة التسوق ورموز الخصم | رموز صالحة ومنتهية الصلاحية | أخطاء عند تطبيق الخصم |
| RTL (Hebrew) | עגלת הקניות וקודי הנחה | קודים בתוקף ושפג תוקפם | שגיאות בהחלת הנחה |

Timer states (start a session with the duration shown, then run the snippet with the minutes shown):

| Case | Duration | Snippet minutes | Expect |
| --- | --- | --- | --- |
| Fresh | 60 | none | `00:00`, `60:00 left`, empty ring |
| Halfway | 90 | 45 | `45:00`, `45:00 left`, half ring |
| One minute to go | 45 | 44 | `44:00`, `01:00 left`, almost full |
| Exactly at the target | 60 | 60 | `60:00`, `00:00 left`, full ring |
| Long overtime | 120 | 150 | `150:00`, `00:00 left`, full ring; the pill still fits |

## Oracles

Oracles are the rules that tell you whether what you see is a bug. They are not steps to follow. If what you see does not match an oracle, it is a Bug. If no oracle covers what you see and it still feels wrong, it is an Issue.

| Situation | What should be true | Source |
| --- | --- | --- |
| Any moment of a running session | Elapsed + remaining = the target, to the second (e.g. `37:12` and `22:48 left` of 60), until the target is reached. | Decision 2026-11-23 (remaining time) |
| After a reload, a locked screen, sleep or a background tab | The elapsed time equals the real time since Start. It is never less than before. It never counts backwards. | Ticket; spec R2 |
| Past the target | `00:00 left`, a full ring, the session still open. No warning yet. | Spec R2; TAN-23 out of scope |
| Every screen with navigation, during a session | The timer pill is in the header: on New session, Session, History and Settings. It is not on Home. | Decision 2026-11-23 (timer in the header) |
| Scrolling a long Session screen | The header and the timer stay at the top. | Spec R2 ("always visible"); decision 2026-11-23 (sticky) |
| End session | One click goes to "Debrief" with "The PROOF debrief is coming soon. Your session is saved." Afterwards: no timer, no Session link, Home offers New session. | Ticket; decision 2026-11-23 (`/debrief`) |
| Ending twice (double click, two tabs) | It ends once. A second attempt shows "The session could not be ended. Try again." and nothing else changes. | Decision 2026-11-23 (`endSession`) |
| Reduce motion on | The ring never glides; it steps once a second. | Owner constraint; TAN-31 global rule |
| Colours | The arc is the dark orange (accent strong), the track the light hairline, the elapsed time ink, the remaining time grey. | Decision 2026-11-23 (ring colour) |
| Long, emoji or RTL charter | The header is not affected: the timer does not move or overlap. | None for the header. A mismatch here is an Issue, not a Bug. |

## Coverage matrix

Mark each cell when checked: ✓ ok, ✗ bug or issue (with its key), – not applicable.

| Criterion / risk | Chrome 1440 | Edge 1440 | Chrome 400 px | Edge 1366 × 768 | Zoom 200 % | Reduce motion | Forced colors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Timer always visible (every screen, scrolled) | | | | | | | |
| Time survives a reload | | | | | | – | – |
| Background tab / sleep keeps time | | | – | | – | – | – |
| End session → Debrief placeholder | | | | | | – | |
| Ending twice | | | – | – | – | – | – |
| Ring look and reduce motion | | | | | | | |
| Keyboard and Narrator | | | – | | | – | |
| Earlier features (TAN-17 to TAN-20) | | | | | | – | – |

## Already automated (skip these)

Playwright (`e2e/timer.spec.ts`):
- `@TAN-21 the timer shows elapsed and remaining time and the ensō ring in the navigation`
- `@TAN-21 the timer follows the session on every screen with navigation`
- `@TAN-21 no timer without a session in progress`
- `@TAN-21 a new session starts its timer at 00:00`
- `@TAN-21 the timer stays in view when the page scrolls`
- `@TAN-21 the remaining time stops at 00:00 left at the target`
- `@TAN-21 the timer survives a reload and never goes back`
- `@TAN-21 coming back to a background tab shows the full time at once`
- `@TAN-21 a throttled tab still shows five more minutes`
- `@TAN-21 End session moves the session to debrief and shows the placeholder`
- `@TAN-21 End session is reached with the keyboard`
- `@TAN-21 End session is only on the Session screen`
- `@TAN-21 End session that fails shows an alert and can be retried`
- `@TAN-21 a double click ends the session once`
- `@TAN-21 the ensō ring moves without transition under reduce motion`
- `@TAN-21 the ensō ring creeps forward without reduce motion`
- `@TAN-21 the ring and the timer use the theme tokens`

Vitest: `remainingMs`, `ringProgress` (`src/features/timer/elapsed.test.ts`); `endSession` (`src/data/sessions.test.ts`); the `/debrief` route (`router.test.ts`); the new `nonTextPairs` entry (contrast test).
