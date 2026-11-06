import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSession,
  createTimeSegment,
  deleteTimeSegment,
  getTimeSegment,
  listTimeSegments,
  openTansaDb,
  RecordNotFoundError,
  updateTimeSegment,
  type Session,
  type TansaDb,
  type TimeSegmentPatch,
} from './index'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let db: TansaDb
let session: Session
let other: Session

beforeEach(async () => {
  // Only Date is faked: fake-indexeddb schedules its work with real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000)
  globalThis.indexedDB = new IDBFactory()
  db = await openTansaDb()
  const charter = { explore: 'search', with: 'typos', discover: 'empty results' }
  session = await createSession(db, { status: 'running', charter, areas: [], targetMinutes: 60 })
  other = await createSession(db, { status: 'running', charter, areas: [], targetMinutes: 30 })
})

afterEach(() => {
  db.close()
  vi.useRealTimers()
})

describe('createTimeSegment', () => {
  it('@TAN-14 rejects an unknown session and stores nothing', async () => {
    await expect(
      createTimeSegment(db, { sessionId: 'no-such-session', state: 'running' }),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
    expect(await db.count('timeSegments')).toBe(0)
  })

  it('@TAN-14 defaults startedAt to now and leaves the segment open', async () => {
    vi.setSystemTime(6_000)
    const segment = await createTimeSegment(db, { sessionId: session.id, state: 'running' })

    expect(segment.id).toMatch(UUID_V4)
    expect(segment).toEqual({
      id: segment.id,
      sessionId: session.id,
      state: 'running',
      startedAt: 6_000,
    })
    expect('endedAt' in segment).toBe(false)
  })

  it('@TAN-14 accepts an explicit startedAt', async () => {
    vi.setSystemTime(6_000)
    const segment = await createTimeSegment(db, {
      sessionId: session.id,
      state: 'paused',
      startedAt: 5_500,
    })

    expect(segment.startedAt).toBe(5_500)
  })
})

describe('getTimeSegment', () => {
  it('@TAN-14 reads the stored segment back after reopening the database', async () => {
    const created = await createTimeSegment(db, { sessionId: session.id, state: 'running' })
    db.close()
    db = await openTansaDb()

    expect(await getTimeSegment(db, created.id)).toEqual(created)
  })

  it('@TAN-14 returns undefined for an unknown id', async () => {
    await createTimeSegment(db, { sessionId: session.id, state: 'running' })

    expect(await getTimeSegment(db, 'no-such-id')).toBeUndefined()
  })
})

describe('listTimeSegments', () => {
  it("@TAN-14 lists only that session's segments, by startedAt", async () => {
    await createTimeSegment(db, { sessionId: session.id, state: 'running', startedAt: 3_000 })
    await createTimeSegment(db, { sessionId: session.id, state: 'running', startedAt: 1_000 })
    await createTimeSegment(db, { sessionId: other.id, state: 'running', startedAt: 1_500 })
    await createTimeSegment(db, { sessionId: session.id, state: 'paused', startedAt: 2_000 })

    const list = await listTimeSegments(db, session.id)

    expect(list.map((s) => s.startedAt)).toEqual([1_000, 2_000, 3_000])
  })

  it('@TAN-14 orders segments with the same startedAt by id', async () => {
    const a = await createTimeSegment(db, { sessionId: session.id, state: 'running', startedAt: 7 })
    const b = await createTimeSegment(db, { sessionId: session.id, state: 'paused', startedAt: 7 })

    const ids = (await listTimeSegments(db, session.id)).map((s) => s.id)

    expect(ids).toEqual([a.id, b.id].sort())
  })
})

describe('updateTimeSegment', () => {
  it('@TAN-14 sets endedAt', async () => {
    const created = await createTimeSegment(db, { sessionId: session.id, state: 'running' })

    const updated = await updateTimeSegment(db, created.id, { endedAt: 4_000 })

    expect(updated).toEqual({ ...created, endedAt: 4_000 })
    expect(await getTimeSegment(db, created.id)).toEqual(updated)
  })

  it('@TAN-14 ignores state, startedAt and sessionId carried by the patch', async () => {
    const created = await createTimeSegment(db, { sessionId: session.id, state: 'running' })

    const smuggled = {
      endedAt: 4_000,
      state: 'paused',
      startedAt: 2,
      sessionId: other.id,
      id: 'x',
    } as TimeSegmentPatch
    const updated = await updateTimeSegment(db, created.id, smuggled)

    expect(updated).toEqual({ ...created, endedAt: 4_000 })
    expect(await getTimeSegment(db, created.id)).toEqual(updated)
    expect(await listTimeSegments(db, other.id)).toEqual([])
  })

  it('@TAN-14 rejects an unknown id and creates nothing', async () => {
    await expect(updateTimeSegment(db, 'no-such-id', { endedAt: 1 })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    )
    expect(await db.count('timeSegments')).toBe(0)
  })
})

describe('deleteTimeSegment', () => {
  it('@TAN-14 removes that segment and keeps its sibling', async () => {
    const doomed = await createTimeSegment(db, { sessionId: session.id, state: 'running' })
    const sibling = await createTimeSegment(db, { sessionId: session.id, state: 'paused' })

    await deleteTimeSegment(db, doomed.id)

    expect(await getTimeSegment(db, doomed.id)).toBeUndefined()
    expect(await getTimeSegment(db, sibling.id)).toEqual(sibling)
  })
})
