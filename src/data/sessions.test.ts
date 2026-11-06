import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  createSession,
  createTimeSegment,
  deleteSession,
  getSession,
  isInProgress,
  listSessions,
  openTansaDb,
  RecordNotFoundError,
  SessionInProgressError,
  startSession,
  updateSession,
  type NewSession,
  type SessionPatch,
  type TansaDb,
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

    const { session, segment } = await startSession(db, charter)

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

      await expect(startSession(db, charter)).rejects.toBeInstanceOf(SessionInProgressError)

      expect(await db.count('sessions')).toBe(before.sessions)
      expect(await db.count('timeSegments')).toBe(before.segments)
    },
  )

  it('@TAN-18 starts when only debrief and closed sessions exist', async () => {
    await createSession(db, newSession({ status: 'debrief' }))
    await createSession(db, newSession({ status: 'closed' }))

    const { session } = await startSession(db, charter)

    expect(session.status).toBe('running')
    expect(await db.count('sessions')).toBe(3)
    expect(await db.count('timeSegments')).toBe(1)
  })

  it('@TAN-18 two starts at once leave a single session in progress', async () => {
    const results = await Promise.allSettled([startSession(db, charter), startSession(db, charter)])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      SessionInProgressError,
    )
    expect(await db.count('sessions')).toBe(1)
    expect(await db.count('timeSegments')).toBe(1)
  })
})
