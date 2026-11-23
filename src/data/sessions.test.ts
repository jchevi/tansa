import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  createSession,
  createTimeSegment,
  DEFAULT_TARGET_MINUTES,
  deleteSession,
  endSession,
  getSession,
  listTimeSegments,
  InvalidRecordError,
  isInProgress,
  listSessions,
  openTansaDb,
  RecordNotFoundError,
  SessionInProgressError,
  startSession,
  TARGET_MINUTE_OPTIONS,
  updateSession,
  updateTimeSegment,
  type NewSession,
  type SessionPatch,
  type TansaDb,
  type TargetMinutes,
} from './index'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let db: TansaDb

beforeEach(async () => {
  // Only Date is faked: fake-indexeddb schedules its work with real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000)
  globalThis.indexedDB = new IDBFactory()
  db = await openTansaDb()
})

afterEach(() => {
  db.close()
  vi.useRealTimers()
})

function newSession(overrides: Partial<NewSession> = {}): NewSession {
  return {
    status: 'running',
    charter: { explore: 'the checkout page', with: 'a guest cart', discover: 'pricing errors' },
    areas: ['checkout'],
    targetMinutes: 60,
    ...overrides,
  }
}

describe('createSession', () => {
  it('@TAN-14 returns the record with a v4 UUID and createdAt set to now', async () => {
    vi.setSystemTime(42_000)
    const session = await createSession(db, newSession())

    expect(session.id).toMatch(UUID_V4)
    expect(session.createdAt).toBe(42_000)
    expect(session).toMatchObject(newSession())
  })

  it('@TAN-14 gives every session a different id', async () => {
    const a = await createSession(db, newSession())
    const b = await createSession(db, newSession())

    expect(a.id).not.toBe(b.id)
  })
})

describe('getSession', () => {
  it('@TAN-14 reads the stored session back after reopening the database', async () => {
    const created = await createSession(
      db,
      newSession({
        build: '2.4.1',
        environment: 'staging',
        testData: 'guest user, two items',
        closedAt: 9_000,
      }),
    )
    db.close()
    db = await openTansaDb()

    expect(await getSession(db, created.id)).toEqual(created)
  })

  it('@TAN-14 returns undefined for an unknown id', async () => {
    await createSession(db, newSession())

    expect(await getSession(db, 'no-such-id')).toBeUndefined()
  })
})

describe('listSessions', () => {
  it('@TAN-14 lists sessions newest first', async () => {
    vi.setSystemTime(2_000)
    await createSession(db, newSession())
    vi.setSystemTime(1_000)
    await createSession(db, newSession())
    vi.setSystemTime(3_000)
    await createSession(db, newSession())

    const list = await listSessions(db)

    expect(list.map((s) => s.createdAt)).toEqual([3_000, 2_000, 1_000])
  })

  it('@TAN-14 orders sessions with the same createdAt by id, descending', async () => {
    vi.setSystemTime(5_000)
    const a = await createSession(db, newSession())
    const b = await createSession(db, newSession())

    const ids = (await listSessions(db)).map((s) => s.id)

    expect(ids).toEqual([a.id, b.id].sort().reverse())
  })
})

describe('updateSession', () => {
  it('@TAN-14 changes status and keeps id and createdAt, even when the patch carries them', async () => {
    const created = await createSession(db, newSession())
    vi.setSystemTime(8_000)

    const smuggled = { status: 'paused', id: 'other-id', createdAt: 7 } as SessionPatch
    const updated = await updateSession(db, created.id, smuggled)

    expect(updated).toEqual({ ...created, status: 'paused' })
    expect(await getSession(db, created.id)).toEqual(updated)
    expect(await getSession(db, 'other-id')).toBeUndefined()
  })

  it('@TAN-14 rejects an unknown id and creates nothing', async () => {
    await expect(updateSession(db, 'no-such-id', { status: 'paused' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    )
    expect(await db.count('sessions')).toBe(0)
  })
})

describe('deleteSession', () => {
  it("@TAN-14 removes the session with its notes and segments, and keeps other sessions' records", async () => {
    const doomed = await createSession(db, newSession())
    const kept = await createSession(db, newSession())
    for (const s of [doomed, kept]) {
      await createNote(db, { sessionId: s.id, tag: 'note', text: 'cart total looks right' })
      await createTimeSegment(db, { sessionId: s.id, state: 'running' })
    }

    await deleteSession(db, doomed.id)

    expect(await getSession(db, doomed.id)).toBeUndefined()
    expect(await getSession(db, kept.id)).toEqual(kept)
    const notes = await db.getAll('notes')
    const segments = await db.getAll('timeSegments')
    expect(notes.map((n) => n.sessionId)).toEqual([kept.id])
    expect(segments.map((s) => s.sessionId)).toEqual([kept.id])
  })
})

describe('isInProgress', () => {
  it('@TAN-18 is true for running and paused, false for debrief and closed', () => {
    expect(isInProgress('running')).toBe(true)
    expect(isInProgress('paused')).toBe(true)
    expect(isInProgress('debrief')).toBe(false)
    expect(isInProgress('closed')).toBe(false)
  })
})

describe('startSession', () => {
  const charter = { explore: 'the wish list', with: 'a signed-in user', discover: 'sync gaps' }

  it('@TAN-18 creates a running session and its first open running segment', async () => {
    vi.setSystemTime(7_000)

    const { session, segment } = await startSession(db, { charter })

    expect(session.id).toMatch(UUID_V4)
    expect(session).toMatchObject({
      status: 'running',
      charter,
      areas: [],
      targetMinutes: 60,
      createdAt: 7_000,
    })
    expect(segment.id).toMatch(UUID_V4)
    expect(segment).toEqual({
      id: segment.id,
      sessionId: session.id,
      state: 'running',
      startedAt: 7_000,
    })
    expect(await db.getAll('sessions')).toEqual([session])
    expect(await db.getAll('timeSegments')).toEqual([segment])
  })

  it.each(['running', 'paused'] as const)(
    '@TAN-18 rejects while a %s session exists and writes nothing',
    async (status) => {
      await createSession(db, newSession({ status }))
      const before = {
        sessions: await db.count('sessions'),
        segments: await db.count('timeSegments'),
      }

      await expect(startSession(db, { charter })).rejects.toBeInstanceOf(SessionInProgressError)

      expect(await db.count('sessions')).toBe(before.sessions)
      expect(await db.count('timeSegments')).toBe(before.segments)
    },
  )

  it('@TAN-18 starts when only debrief and closed sessions exist', async () => {
    await createSession(db, newSession({ status: 'debrief' }))
    await createSession(db, newSession({ status: 'closed' }))

    const { session } = await startSession(db, { charter })

    expect(session.status).toBe('running')
    expect(await db.count('sessions')).toBe(3)
    expect(await db.count('timeSegments')).toBe(1)
  })

  it('@TAN-19 stores the given context with the session', async () => {
    const context = {
      environment: 'Staging',
      build: '1.4.2',
      areas: ['Cart', 'checkout'],
      testData: 'qa+01@example.com',
    }

    const { session } = await startSession(db, { charter, context })

    expect(await getSession(db, session.id)).toMatchObject(context)
  })

  it.each([
    ['no context', undefined],
    ['an empty context', { areas: [] }],
  ])('@TAN-19 with %s stores no optional context keys', async (_label, context) => {
    const { session } = await startSession(db, { charter, context })

    const stored = await getSession(db, session.id)
    expect(stored?.areas).toEqual([])
    expect(stored).not.toHaveProperty('environment')
    expect(stored).not.toHaveProperty('build')
    expect(stored).not.toHaveProperty('testData')
  })

  it("@TAN-19 the stored areas are not the caller's array", async () => {
    const areas = ['Cart']

    const { session } = await startSession(db, { charter, context: { areas } })
    areas.push('checkout')

    expect(session.areas).toEqual(['Cart'])
  })

  it('@TAN-20 stores the chosen target', async () => {
    const { session } = await startSession(db, { charter, targetMinutes: 90 })

    expect(session.targetMinutes).toBe(90)
    expect((await getSession(db, session.id))?.targetMinutes).toBe(90)
  })

  it('@TAN-20 without a target the session gets 60 minutes', async () => {
    const { session } = await startSession(db, { charter })

    expect((await getSession(db, session.id))?.targetMinutes).toBe(60)
  })

  it.each([45, 60, 90, 120] as const)('@TAN-20 stores a target of %d minutes', async (minutes) => {
    const { session } = await startSession(db, { charter, targetMinutes: minutes })

    expect((await getSession(db, session.id))?.targetMinutes).toBe(minutes)
  })

  it.each([30, 0, -60, 61, Number.NaN, Number.POSITIVE_INFINITY])(
    '@TAN-20 refuses a target of %d minutes and writes nothing',
    async (minutes) => {
      await expect(
        startSession(db, { charter, targetMinutes: minutes as TargetMinutes }),
      ).rejects.toBeInstanceOf(InvalidRecordError)

      expect(await db.count('sessions')).toBe(0)
      expect(await db.count('timeSegments')).toBe(0)
    },
  )

  it('@TAN-20 the options are the R1 durations and include the default', () => {
    expect(TARGET_MINUTE_OPTIONS).toEqual([45, 60, 90, 120])
    expect(DEFAULT_TARGET_MINUTES).toBe(60)
    expect(TARGET_MINUTE_OPTIONS).toContain(DEFAULT_TARGET_MINUTES)
  })

  it('@TAN-18 two starts at once leave a single session in progress', async () => {
    const results = await Promise.allSettled([
      startSession(db, { charter }),
      startSession(db, { charter }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      SessionInProgressError,
    )
    expect(await db.count('sessions')).toBe(1)
    expect(await db.count('timeSegments')).toBe(1)
  })
})

describe('endSession', () => {
  const charter = { explore: 'the wish list', with: 'a saved cart', discover: 'lost items' }

  it('@TAN-21 sets status debrief and closes the open segment at the given instant', async () => {
    const { session, segment } = await startSession(db, { charter })

    const ended = await endSession(db, session.id, 61_000)

    expect(ended.status).toBe('debrief')
    expect(await getSession(db, session.id)).toEqual(ended)
    expect(await listTimeSegments(db, session.id)).toEqual([{ ...segment, endedAt: 61_000 }])
  })

  it('@TAN-21 ends at now by default', async () => {
    const { session } = await startSession(db, { charter })
    vi.setSystemTime(9_000)

    await endSession(db, session.id)

    const [segment] = await listTimeSegments(db, session.id)
    expect(segment?.endedAt).toBe(9_000)
  })

  it('@TAN-21 does not set closedAt: only the closed debrief does', async () => {
    const { session } = await startSession(db, { charter })

    const ended = await endSession(db, session.id, 5_000)

    expect(ended).not.toHaveProperty('closedAt')
  })

  it('@TAN-21 leaves closed segments as they were and closes an open paused one', async () => {
    const session = await createSession(db, newSession({ status: 'paused' }))
    const closed = await createTimeSegment(db, {
      sessionId: session.id,
      state: 'running',
      startedAt: 1_000,
    })
    await updateTimeSegment(db, closed.id, { endedAt: 2_000 })
    const paused = await createTimeSegment(db, {
      sessionId: session.id,
      state: 'paused',
      startedAt: 2_000,
    })

    await endSession(db, session.id, 7_000)

    expect(await listTimeSegments(db, session.id)).toEqual([
      { ...closed, endedAt: 2_000 },
      { ...paused, endedAt: 7_000 },
    ])
  })

  it('@TAN-21 leaves other sessions and their segments unchanged', async () => {
    const other = await createSession(db, newSession({ status: 'debrief' }))
    const otherSegment = await createTimeSegment(db, {
      sessionId: other.id,
      state: 'running',
      startedAt: 500,
    })
    const { session } = await startSession(db, { charter })

    await endSession(db, session.id, 3_000)

    expect(await getSession(db, other.id)).toEqual(other)
    expect(await listTimeSegments(db, other.id)).toEqual([otherSegment])
  })

  it('@TAN-21 a missing session throws RecordNotFoundError', async () => {
    await expect(endSession(db, crypto.randomUUID(), 1_000)).rejects.toBeInstanceOf(
      RecordNotFoundError,
    )
  })

  it.each(['debrief', 'closed'] as const)(
    '@TAN-21 a session in %s throws InvalidRecordError and nothing is written',
    async (status) => {
      const session = await createSession(db, newSession({ status }))
      const segment = await createTimeSegment(db, {
        sessionId: session.id,
        state: 'running',
        startedAt: 1_000,
      })

      await expect(endSession(db, session.id, 4_000)).rejects.toBeInstanceOf(InvalidRecordError)

      expect(await getSession(db, session.id)).toEqual(session)
      expect(await listTimeSegments(db, session.id)).toEqual([segment])
    },
  )

  it('@TAN-21 a second end of the same session is refused', async () => {
    const { session } = await startSession(db, { charter })
    await endSession(db, session.id, 2_000)

    await expect(endSession(db, session.id, 3_000)).rejects.toBeInstanceOf(InvalidRecordError)
    const [segment] = await listTimeSegments(db, session.id)
    expect(segment?.endedAt).toBe(2_000)
  })
})
