# TAN-20 · Choose a session time-box — QA pack

Prep sheet for the exploratory session on the PR preview (QA column). It is not a list of scripted cases: the acceptance criteria are already checked in CI by the `@TAN-20` tests listed at the end, so this session is for what those tests cannot judge: how it looks and feels, odd data and steps in an odd order.

- **Build under test:** the Workers Builds preview of [PR #20](https://github.com/jchevi/tansa/pull/20).
- **Browsers:** Chrome and Edge on Windows. Light theme only: there is no dark theme before v0.2.
- **Before each charter:** clear site data (DevTools → Application → Storage → Clear site data), so no earlier session is in progress.

## Charters

**1. Keyboard and screen reader**
- **Explore:** the Duration choice on New session.
- **With:** keyboard only, then Narrator (Win + Ctrl + Enter), in Chrome and Edge.
- **To discover:** whether the group, the checked option, its position ("2 of 4") and the Start button's new name are announced clearly, and whether focus is ever lost or hidden while choosing and starting.

**2. Order of steps and earlier features**
- **Explore:** choosing, changing and starting in odd orders.
- **With:** the charter and context from TAN-18 and TAN-19: choose before or after the charter, change your mind three times, reload `/new`, go back from `/session`, open a second tab, and double-click Start.
- **To discover:** whether a session ever starts with a target the tester did not pick, or starts when it should not.

**3. Layout**
- **Explore:** the New session layout with the Duration row.
- **With:** zoom 100 %, 150 % and 200 %, Windows text size 150 %, a window about 400 px wide, and the long and RTL data below.
- **To discover:** whether the pills, the longer label "Start session · 120 min" and the footer still read well and do not overlap, clip or scroll sideways.

## Risks the automated tests do not cover

- **The look of the selected pill.** Does the 2 px accent-strong border with the tint read clearly as "selected" next to the muted outlines? Is weight 500 against 400 noticeable?
- **The "·" in the button name.** Narrator may read it as "dot" or skip it. Either is fine if the sentence still makes sense.
- **Reload or Back in the middle.** The duration resets to 60, as do the charter and context. That is expected until TAN-73 (draft); note how surprising it feels.
- **Enter.** Enter on a radio must not start the session. Space selects the focused option. Arrow keys select as they move, so check that this does not feel jumpy with a screen reader.
- **Earlier features.** The in-progress notice (TAN-18) still replaces the whole form, Duration included. The Enter rule on the one-line context fields (TAN-19) still holds.
- **Windows high-contrast mode (forced colors).** The tint and the accent border are replaced by system colors, so the selected state then rests on border width and weight. Check it is still visible (Settings → Accessibility → Contrast themes).
- **Reduce motion.** There is no transition on the pills, so nothing should move. Confirm with "Animation effects" turned off in Windows.

## Test data (fictional e-commerce, ready to paste)

| Case | Explore | With | To discover |
| --- | --- | --- | --- |
| Normal | the cart and promo codes | valid, expired and stacked codes | errors when applying or stacking discounts |
| Empty | *(leave empty)* | *(leave empty)* | *(leave empty)* |
| Whitespace only | `   ` (three spaces) | a tab, then Enter | `   ` |
| Very long | the checkout flow when a shopper switches currency, applies three promo codes, removes one, changes the delivery address twice and pays with a saved card that has just expired SPRINGSALE2026FREESHIPPINGONALLITEMSWITHNOMINIMUMORDERFORRETURNINGCUSTOMERS | guest and signed-in accounts | rounding and stale totals |
| Emoji | the gift card page 🎁🛒 | a balance of €0.01 💳 | whether 👍🏽 reviews show up |
| RTL (Arabic) | سلة التسوق ورموز الخصم | رموز صالحة ومنتهية الصلاحية | أخطاء عند تطبيق الخصم |
| RTL (Hebrew) | עגלת הקניות וקודי הנחה | קודים בתוקף ושפג תוקפם | שגיאות בהחלת הנחה |
| Mixed direction | the cart סל קניות checkout | codes WELCOME10 · SPRING25 | totals in ₪ and € |

## Oracles

Oracles are the rules that tell you whether what you see is a bug. They are not steps to follow. If what you see does not match an oracle, that is a Bug. If no oracle covers what you see and it still feels wrong, that is an Issue.

For the data above:

| Case | What should be true | Source |
| --- | --- | --- |
| Normal | Start is enabled and the status reads "Charter complete". The session starts with the chosen target. | Ticket; TAN-18 |
| Empty | Start is disabled and the status reads "Missing: Explore, With, To discover". The chosen duration stays selected and stays in the label. | TAN-18; decision 2026-11-19 (label always shows the minutes) |
| Whitespace only | Counts as empty: the status names each field that holds only blanks. | Decision 2026-11-06 (trimmed values) |
| Very long | Text wraps. Fields grow up to ten lines and then scroll. The page never scrolls sideways, on New session or on Session. | TAN-18; decision 2026-11-19 (field heights) |
| Emoji | Stored and shown exactly as typed, with no broken characters. | Spec R1 (no rule changes the text) |
| RTL and mixed direction | No rule in the spec. Judge by consistency: the text reads in its own direction, and the pills and button stay where they are. | None. A mismatch here is an Issue, not a Bug. |

For steps in an odd order:

| Situation | What should be true | Source |
| --- | --- | --- |
| Reload or Back on New session | Everything resets, the duration back to 60. | Expected until TAN-73 (draft) |
| A session already in progress | New session shows the notice with a Resume link instead of the form, Duration included. | TAN-18 |
| Enter on a duration | Nothing starts; the choice stays. | Decision 2026-11-19 (Enter on a radio) |
| Arrow keys in the group | Selection moves and wraps (120 → 45). Tab leaves the group in one step. | Native radio behaviour; decision 2026-11-19 |
| Double click on Start | Exactly one session is created. | TAN-18 |
| Any path to Start | The stored target is the one the label showed at the moment of the click. | Ticket |

Context values to paste alongside them:

- **Environment:** `Staging`
- **Build or version:** `1.4.2`
- **Areas:** `Cart, checkout, gift cards`
- **Test data:** `Test user qa+01@example.com · codes WELCOME10, SPRING25, VIP5`

## Coverage matrix

Tick each cell during the session. "Narrow" means a window of 400 px or less. Theme: light only.

| Area | Chrome desktop (1440) | Chrome narrow | Edge desktop (1440) | Edge narrow |
| --- | --- | --- | --- | --- |
| Default 60 selected | ☐ | ☐ | ☐ | ☐ |
| Choose 90 → label and stored target | ☐ | ☐ | ☐ | ☐ |
| Keyboard (Tab, arrows, Space) | ☐ | ☐ | ☐ | ☐ |
| Narrator announcement | ☐ | — | ☐ | — |
| Enter on a radio does not start | ☐ | ☐ | ☐ | ☐ |
| Layout at 200 % zoom | ☐ | ☐ | ☐ | ☐ |
| Long, emoji and RTL data | ☐ | ☐ | ☐ | ☐ |
| High-contrast mode | ☐ | — | ☐ | — |

## Already automated (skip these)

Playwright, `e2e/duration.spec.ts`:

- `@TAN-20 60 min is selected when New session opens`
- `@TAN-20 a session started without choosing has a 60-minute target`
- `@TAN-20 choosing 90 min updates the button and the session target`
- `@TAN-20 choosing 45 min sets its own target`
- `@TAN-20 choosing 120 min sets its own target`
- `@TAN-20 the duration can be chosen before the charter is complete`
- `@TAN-20 the duration can be chosen with the keyboard`
- `@TAN-20 Enter on a duration does not start the session`
- `@TAN-20 the duration is announced as a radio group`
- `@TAN-20 every duration has a visible boundary and the selected one stands out`
- `@TAN-20 a focused duration shows the focus ring`
- `@TAN-20 the duration options fit a narrow screen`

Vitest, `src/data/sessions.test.ts` and `src/data/no-network.test.ts`:

- `@TAN-20 stores the chosen target`
- `@TAN-20 without a target the session gets 60 minutes`
- `@TAN-20 stores a target of %d minutes` (45, 60, 90, 120)
- `@TAN-20 refuses a target of %d minutes and writes nothing` (30, 0, -60, 61, NaN, Infinity)
- `@TAN-20 the options are the R1 durations and include the default`
- `@TAN-20 startSession with a target makes no network requests`

The keyboard tests from TAN-18 and TAN-19 also pass through the Duration group, which is one Tab stop.
