import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// The text of one "## " section, so a word found elsewhere in the file doesn't count.
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`)
  if (start === -1) throw new Error(`Section "## ${heading}" not found`)
  const end = markdown.indexOf('\n## ', start + 1)
  return markdown.slice(start, end === -1 ? undefined : end)
}

describe('workflow docs', () => {
  const claude = read('../CLAUDE.md')
  const decisions = read('../docs/decisions.md')
  const lifecycle = section(claude, 'Ticket lifecycle')

  // One numbered step per stage, in order [TAN-31].
  it.each([
    [1, 'In Progress'],
    [2, 'open the PR'],
    [3, 'QA'],
    [4, 'merge commit'],
    [5, 'Delete the branch'],
    [6, 'Done'],
    [7, 'git pull'],
  ])('@TAN-28 lifecycle step %i mentions "%s"', (step, text) => {
    const line = lifecycle.split(/\r?\n/).find((l) => l.startsWith(`${String(step)}. `))
    expect(line).toContain(text)
  })

  // One chat per ticket keeps its context, so the last step hands off the next ticket
  // instead of starting it here [TAN-67].
  it('@TAN-67 lifecycle step 8 hands off the next ticket in a new chat', () => {
    const line = lifecycle.split(/\r?\n/).find((l) => l.startsWith('8. '))
    expect(line).toBeDefined()
    for (const text of [
      'a short summary of the ticket',
      'ready-to-paste prompt to start the next ticket',
      'in a new chat',
      'If the next ticket is directly related',
      'offer to continue in the same chat',
    ]) {
      expect(line).toContain(text)
    }
  })

  // The hand-off prompt carries the follow-ups into the next chat, and it points at the
  // written order instead of leaving a new chat to guess it [TAN-68].
  it('@TAN-68 the hand-off prompt names its contents and where the order lives', () => {
    const line = lifecycle.split(/\r?\n/).find((l) => l.startsWith('8. '))
    for (const text of [
      'in the approved order (How to work → **Order:**)',
      'what merged',
      'the order and the deferred items with their tickets',
      'the ticket and lifecycle steps',
    ]) {
      expect(line).toContain(text)
    }
    const howToWork = section(claude, 'How to work').split(/\r?\n/)
    expect(howToWork.some((l) => l.startsWith('- **Order:**'))).toBe(true)
  })

  // Step 8 is the last thing done for a ticket, after the sync [TAN-68].
  it('@TAN-68 the hand-off is the last lifecycle step', () => {
    const numbers = lifecycle
      .split(/\r?\n/)
      .map((l) => /^(\d+)\. /.exec(l)?.[1])
      .filter((n) => n !== undefined)
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  // A numbered step's own line and its indented sub-lines, up to the next step, in the
  // Ticket lifecycle unless another section is given [TAN-80, TAN-88].
  function stepBlock(step: number, text: string = lifecycle): string[] {
    const lines = text.split(/\r?\n/)
    const start = lines.findIndex((l) => l.startsWith(`${String(step)}. `))
    const end = lines.findIndex((l) => l.startsWith(`${String(step + 1)}. `))
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    return lines.slice(start, end)
  }
  const qaSections = [
    'Charters',
    'Risks',
    'Test data',
    'Oracles',
    'Coverage matrix',
    'Already automated',
  ]
  const qaPackLine = () => stepBlock(2).find((l) => l.startsWith('   - QA pack'))

  // The pack is committed before the code review, because gate-pr allows a merge only
  // when HEAD has been reviewed; tasks skip QA, so only stories have one [TAN-80].
  it("@TAN-80 lifecycle step 2 commits the story's QA pack before the code review", () => {
    const [stepLine = ''] = stepBlock(2)
    const pack = stepLine.indexOf('stories also commit their QA pack')
    const review = stepLine.indexOf('/review-loop code')
    expect(pack).toBeGreaterThan(-1)
    expect(review).toBeGreaterThan(pack)
    const subLine = qaPackLine()
    expect(subLine).toBeDefined()
    expect(subLine?.startsWith('   - QA pack (stories):')).toBe(true)
    for (const text of [
      '`docs/qa/TAN-<n>.md`',
      'written before the code review',
      'Not scripted cases',
      'how keyboard focus moves',
    ]) {
      expect(subLine).toContain(text)
    }
  })

  it.each(qaSections)('@TAN-80 the lifecycle lists the QA pack section "%s"', (name) => {
    expect(qaPackLine()).toContain(`**${name}**`)
  })

  it('@TAN-80 lifecycle step 3 runs the session with its QA pack', () => {
    const line = lifecycle.split(/\r?\n/).find((l) => l.startsWith('3. '))
    expect(line).toContain('with its QA pack')
  })

  it('@TAN-80 a Process row explains the QA pack', () => {
    const row = section(decisions, 'Process')
      .split(/\r?\n/)
      .find((l) => l.includes('`docs/qa/TAN-<n>.md`'))
    expect(row).toMatch(/^\| 2026-11-20 \|/)
    const why = row?.split(' | ').at(-1) ?? ''
    for (const text of ['not scripted cases', 'what tests cannot judge', '`gate-pr`']) {
      expect(why).toContain(text)
    }
  })

  // The trial pack is the example the next session copies, so it keeps every section.
  it.each(qaSections)('@TAN-80 the TAN-20 QA pack has the section "%s"', (name) => {
    const headings = read('../docs/qa/TAN-20.md')
      .split(/\r?\n/)
      .filter((l) => l.startsWith('## '))
    expect(headings.some((h) => h.startsWith(`## ${name}`))).toBe(true)
  })

  // The mockup is the reference: the plan quotes it in a Mockup check, every difference is
  // an owner decision, and approved ones are tracked in a register until corrected [TAN-88].
  describe('mockup rule', () => {
    const howToWork = section(claude, 'How to work')
    const reviewer = read('../.claude/agents/plan-fidelity-reviewer.md')
    const skill = read('../.claude/skills/review-loop/SKILL.md')
    const register = () => section(decisions, 'Mockup departures')
    const header = '| Date | Ticket | Mockup | Mockup shows | Built | Kind | Corrected in |'
    // Every table line after the header and its separator, so a malformed row is checked,
    // not skipped.
    const rows = () => {
      const lines = register()
        .split(/\r?\n/)
        .filter((l) => l.startsWith('|'))
      expect(lines[0]).toBe(header)
      return lines.slice(2)
    }
    const cells = (row: string) =>
      row
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())

    it('@TAN-88 How to work step 2 makes the mockup the reference and requires a Mockup check', () => {
      const step = stepBlock(2, howToWork).join('\n')
      for (const text of [
        '**Mockup check:**',
        'the mockup named in the ticket is the reference',
        'Never depart from the mockup silently',
        'Mockup departures',
        "fills in that row's Corrected in",
      ]) {
        expect(step).toContain(text)
      }
    })

    it('@TAN-88 the plan-fidelity reviewer checks every mockup departure is an owner decision', () => {
      const check = reviewer.split(/\r?\n/).find((l) => l.startsWith('8. **Mockup**:'))
      expect(check).toBeDefined()
      for (const text of [
        'Mockup check',
        'decisions presented to the owner',
        'missing from those decisions is a **major**',
      ]) {
        expect(check).toContain(text)
      }
    })

    it('@TAN-88 the review-loop plan phase asks for a Mockup check', () => {
      const planPhase = section(skill, 'Plan phase')
      expect(planPhase).toContain('Mockup check')
      expect(planPhase).toContain('Mockup departures')
    })

    it('@TAN-88 the Mockup departures table has its columns and says how a row is corrected', () => {
      expect(rows().length).toBeGreaterThanOrEqual(13)
      expect(register()).toContain('fills in Corrected in')
      expect(register()).toContain('adds its own row to Design')
    })

    it('@TAN-88 every departure row is well formed', () => {
      for (const row of rows()) {
        const [date, ticket, mockup, shows, built, kind, corrected] = cells(row)
        expect(cells(row), row).toHaveLength(7)
        expect(date, row).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(ticket, row).toMatch(/^TAN-\d+$/)
        expect(mockup, row).not.toBe('')
        expect(shows, row).not.toBe('')
        expect(built, row).not.toBe('')
        expect(kind, row).toMatch(/^(permanent|temporary until TAN-\d+)$/)
        expect(corrected, row).toMatch(/^(|TAN-\d+ on \d{4}-\d{2}-\d{2})$/)
        if (kind === 'permanent') expect(corrected, row).toBe('')
      }
    })

    it("@TAN-88 TAN-21's header departure is tracked until TAN-86 corrects it", () => {
      const tan21 = rows()
        .map(cells)
        .filter(
          ([, ticket, , , , kind]) => ticket === 'TAN-21' && kind === 'temporary until TAN-86',
        )
      expect(tan21).toHaveLength(1)
      expect(tan21[0]?.[2]).toContain('v0.1 · Session (document + focus)')
    })

    it('@TAN-88 a Process row explains the mockup rule', () => {
      const row = section(decisions, 'Process')
        .split(/\r?\n/)
        .find((l) => l.includes('Mockup departures'))
      expect(row).toMatch(/^\| 2026-11-2\d \|/)
      const why = row?.split(' | ').at(-1) ?? ''
      expect(why).toContain('TAN-21')
      expect(why).toContain('TAN-86')
    })

    // The plan compares against an image of the whole screen, not only the markup its
    // author chose to quote; a screen with no image waits for its design [TAN-90].
    describe('mockup images', () => {
      const states = [
        'home-session-running',
        'home-no-session',
        'new-session-empty',
        'new-session-partly-filled',
        'session-document',
        'session-focus',
        'history',
        'history-empty',
      ]
      const sources = ['home', 'new-session', 'session', 'history']
      const readme = () => read('../docs/mockups/README.md')
      // Bytes, not utf8: decoding would corrupt the PNG header.
      const bytes = (relative: string) =>
        readFileSync(fileURLToPath(new URL(relative, import.meta.url)))
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      it('@TAN-90 docs/mockups has one PNG per v0.1 screen state and the screen sources', () => {
        for (const state of states) {
          const png = bytes(`../docs/mockups/${state}.png`)
          expect(png.subarray(0, 8).equals(pngSignature), state).toBe(true)
          expect(png.readUInt32BE(16), state).toBe(1440)
        }
        for (const source of sources) {
          expect(read(`../docs/mockups/source/${source}.dc.html`).length).toBeGreaterThan(0)
        }
        const listed = readme()
          .split(/\r?\n/)
          .filter((l) => l.startsWith('| `'))
          .map((l) => /^\| `([^`]+)\.png` \|/.exec(l)?.[1])
        expect(listed.sort()).toEqual([...states].sort())
      })

      it('@TAN-90 the Mockup check compares the plan against the images', () => {
        const line = stepBlock(2, howToWork).find((l) => l.startsWith('   - **Mockup check:**'))
        expect(line).toBeDefined()
        for (const text of [
          '`docs/mockups/<state>.png`',
          'compares the plan against it',
          '`docs/mockups/source/`',
          'is not planned until its design ticket is done',
        ]) {
          expect(line).toContain(text)
        }
      })

      it('@TAN-90 the plan-fidelity reviewer opens the images the plan names', () => {
        const check = reviewer.split(/\r?\n/).find((l) => l.startsWith('8. **Mockup**:'))
        for (const text of [
          'Open with Read every image in `docs/mockups/`',
          'visible difference',
          'that is not among those decisions is a **major**',
          'but names none is also a **major**',
          'Whether or not the ticket names a mockup, a plan that changes a screen state with no image in `docs/mockups/` is a **major**: it waits for its design ticket',
        ]) {
          expect(check).toContain(text)
        }
      })

      it('@TAN-90 the review-loop plan phase mentions the images', () => {
        const planPhase = section(skill, 'Plan phase')
        expect(planPhase).toContain('`docs/mockups/`')
        expect(planPhase).toContain(
          'Whether or not the ticket names a mockup, a plan that changes a screen state with no image there waits for its design ticket',
        )
      })

      it('@TAN-90 the mockups README says how to regenerate them and where departures live', () => {
        const regenerate = section(readme(), 'How to regenerate the screenshots')
        for (const text of ['Playwright', '1440', 'full-page']) {
          expect(regenerate).toContain(text)
        }
        expect(readme()).toContain('Mockup departures table of `docs/decisions.md`')
      })

      it('@TAN-90 a Process row explains the mockup images', () => {
        const row = section(decisions, 'Process')
          .split(/\r?\n/)
          .find((l) => l.startsWith('| 2026-11-25 |') && l.includes('`docs/mockups/`'))
        expect(row).toBeDefined()
        expect(row?.split(' | ').at(-1)).toContain('TAN-88')
      })
    })
  })

  // Every chat starts with a check of the Jira board, and the order of work is written
  // where Claude reads it: critical bugs, then process tickets, then design and story [TAN-91].
  describe('start of chat', () => {
    const howToWork = () => section(claude, 'How to work').split(/\r?\n/)
    // The bullet starting with the prefix, found before step 1.
    const bullet = (prefix: string) => {
      const lines = howToWork()
      const at = lines.findIndex((l) => l.startsWith(prefix))
      const first = lines.findIndex((l) => l.startsWith('1. '))
      expect(at, prefix).toBeGreaterThan(-1)
      expect(first).toBeGreaterThan(at)
      return lines[at]
    }

    it('@TAN-91 How to work starts with the Start of chat check', () => {
      const line = bullet('- **Start of chat:**')
      for (const text of [
        '`start-of-chat` skill',
        'the active sprint',
        'propose closing it and opening the next',
        'Done tickets with no sprint or no Fix version (process tickets: sprint only)',
        'the owner did not plan in',
        'WIP',
        'the next ticket in the approved order',
      ]) {
        expect(line).toContain(text)
      }
    })

    it('@TAN-91 the order puts critical bugs, then process tickets, first', () => {
      expect(bullet('- **Order:**')).toContain(
        "bugs with priority High or Highest, then process tickets (label `build-log`), then each feature's design ticket and its story, then the rest",
      )
    })

    it('@TAN-91 CLAUDE.md says where tickets belong', () => {
      const line = bullet('- **Order:**')
      for (const text of [
        'Process tickets go into the active sprint when created and never get a Fix version',
        'waits in the backlog with no sprint and no version',
        "a ticket in Done belongs to the sprint in which it was finished and, unless it is a process ticket, to that sprint's Fix version",
      ]) {
        expect(line).toContain(text)
      }
    })

    it('@TAN-91 the owner approves every sprint and version change', () => {
      expect(bullet('- **Start of chat:**')).toContain(
        'only after the owner approves them in the chat',
      )
    })

    it('@TAN-91 review-loop follow-up tickets get their sprint and version by kind', () => {
      const followUps = section(read('../.claude/skills/review-loop/SKILL.md'), 'Follow-up tickets')
      expect(followUps).toContain('goes into the active sprint with no Fix version')
      expect(followUps).toContain('created with no sprint and no Fix version')
    })

    it('@TAN-91 the start-of-chat skill covers the five parts', () => {
      const skill = read('../.claude/skills/start-of-chat/SKILL.md')
      expect(skill.split(/\r?\n/)).toContain('name: start-of-chat')
      const steps = section(skill, 'Steps')
        .split(/\r?\n/)
        .filter((l) => /^\d+\. /.test(l))
      const prefixes = [
        '1. **Sprint:**',
        '2. **Done with no sprint or no Fix version:**',
        '3. **Not planned in:**',
        '4. **WIP:**',
        '5. **Next ticket:**',
      ]
      expect(steps).toHaveLength(prefixes.length)
      prefixes.forEach((prefix, i) => {
        expect(steps[i]?.startsWith(prefix), prefix).toBe(true)
      })
      expect(steps[2]?.startsWith('3. **Not planned in:** tickets not in Done only.')).toBe(true)
      expect(steps[2]).toContain('set after the sprint started')
      expect(steps[4]).toContain('**Order:**')
      expect(section(skill, 'Changes')).toContain('only after the owner approves')
    })

    it('@TAN-91 a Process row explains the Start of chat check', () => {
      const row = section(decisions, 'Process')
        .split(/\r?\n/)
        .find((l) => l.startsWith('| 2026-11-25 |') && l.includes('Start of chat'))
      expect(row).toBeDefined()
      const why = row?.split(' | ').at(-1) ?? ''
      expect(why).toContain('Sprint 1')
      expect(why).toContain('a TANSA version says nothing about them')
    })
  })

  it('@TAN-28 CLAUDE.md and the decision log agree on merge commits', () => {
    expect(lifecycle).toContain('Merge with a merge commit (the only method the repo allows)')
    const decision = decisions.split(/\r?\n/).find((l) => l.includes('Merge commits only'))
    expect(decision).toContain('squash and rebase disabled')
  })

  it('@TAN-31 both docs end the bootstrap at the same ticket', () => {
    const bootstrap = 'TAN-9 to TAN-11 bootstrap'
    expect(section(claude, 'Definition of Done')).toContain(bootstrap)
    expect(decisions).toContain(bootstrap)
    expect(claude).toContain('From TAN-12 on, every ticket meets the full Definition of Done')
  })
})
