import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  createSession,
  deleteNote,
  getNote,
  InvalidRecordError,
  listNotes,
  openTansaDb,
  RecordNotFoundError,
  updateNote,
  type BugDetails,
  type NotePatch,
  type Session,
  type TansaDb,
} from './index'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let db: TansaDb
let session: Session
let other: Session

const bug: BugDetails = {
  title: 'Discount applied twice',
  steps: 'Add a coupon, then reload the cart',
  expected: 'One 10% discount',
  actual: 'Two 10% discounts',
  severity: 'high',
}

beforeEach(async () => {
  // Only Date is faked: fake-indexeddb schedules its work with real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000)
  globalThis.indexedDB = new IDBFactory()
  db = await openTansaDb()
  const charter = { explore: 'the cart', with: 'coupons', discover: 'discount errors' }
  session = await createSession(db, { status: 'running', charter, areas: [], targetMinutes: 60 })
  other = await createSession(db, { status: 'running', charter, areas: [], targetMinutes: 30 })
})

afterEach(() => {
  db.close()
  vi.useRealTimers()
})

describe('createNote', () => {
  it('@TAN-14 rejects an unknown session and stores nothing', async () => {
    await expect(
      createNote(db, { sessionId: 'no-such-session', tag: 'note', text: 'orphan' }),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
    expect(await db.count('notes')).toBe(0)
  })

  it('@TAN-14 sets id, createdAt and empty attachments', async () => {
    vi.setSystemTime(4_000)
    const note = await createNote(db, { sessionId: session.id, tag: 'note', text: 'cart loads' })

    expect(note.id).toMatch(UUID_V4)
    expect(note).toEqual({
      id: note.id,
      sessionId: session.id,
      tag: 'note',
      text: 'cart loads',
      createdAt: 4_000,
      attachments: [],
    })
  })

  it('@TAN-14 rejects bug details on a note that is not a bug', async () => {
    await expect(
      createNote(db, { sessionId: session.id, tag: 'issue', text: 'odd', bug }),
    ).rejects.toBeInstanceOf(InvalidRecordError)
    expect(await db.count('notes')).toBe(0)
  })
})

describe('getNote', () => {
  it('@TAN-14 reads the stored note back after reopening the database', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'bug', text: 'twice', bug })
    db.close()
    db = await openTansaDb()

    expect(await getNote(db, created.id)).toEqual(created)
  })

  it('@TAN-14 returns undefined for an unknown id', async () => {
    await createNote(db, { sessionId: session.id, tag: 'note', text: 'cart loads' })

    expect(await getNote(db, 'no-such-id')).toBeUndefined()
  })
})

describe('listNotes', () => {
  it("@TAN-14 lists only that session's notes, in createdAt order", async () => {
    vi.setSystemTime(3_000)
    await createNote(db, { sessionId: session.id, tag: 'note', text: 'third' })
    vi.setSystemTime(1_500)
    await createNote(db, { sessionId: session.id, tag: 'note', text: 'first' })
    vi.setSystemTime(2_000)
    await createNote(db, { sessionId: other.id, tag: 'note', text: 'other session' })
    vi.setSystemTime(2_500)
    await createNote(db, { sessionId: session.id, tag: 'note', text: 'second' })

    const list = await listNotes(db, session.id)

    expect(list.map((n) => n.text)).toEqual(['first', 'second', 'third'])
  })

  it('@TAN-14 orders notes with the same createdAt by id', async () => {
    vi.setSystemTime(5_000)
    const a = await createNote(db, { sessionId: session.id, tag: 'note', text: 'a' })
    const b = await createNote(db, { sessionId: session.id, tag: 'note', text: 'b' })

    const ids = (await listNotes(db, session.id)).map((n) => n.id)

    expect(ids).toEqual([a.id, b.id].sort())
  })
})

describe('updateNote', () => {
  it('@TAN-14 changes text and tag and keeps the original createdAt', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'note', text: 'draft' })
    vi.setSystemTime(9_000)

    const updated = await updateNote(db, created.id, { text: 'edited', tag: 'issue' })

    expect(updated).toEqual({ ...created, text: 'edited', tag: 'issue' })
    expect(await getNote(db, created.id)).toEqual(updated)
  })

  it('@TAN-14 keeps id, sessionId and createdAt when the patch carries them', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'note', text: 'draft' })

    const smuggled = { text: 'moved?', id: 'x', sessionId: other.id, createdAt: 7 } as NotePatch
    const updated = await updateNote(db, created.id, smuggled)

    expect(updated).toEqual({ ...created, text: 'moved?' })
    expect(await listNotes(db, other.id)).toEqual([])
    expect(await getNote(db, 'x')).toBeUndefined()
  })

  it('@TAN-14 rejects bug details on a note that is not a bug', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'note', text: 'draft' })

    await expect(updateNote(db, created.id, { bug })).rejects.toBeInstanceOf(InvalidRecordError)
    expect(await getNote(db, created.id)).toEqual(created)
  })

  it('@TAN-14 rejects turning a bug into an issue that keeps its bug details', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'bug', text: 'x', bug })

    await expect(updateNote(db, created.id, { tag: 'issue' })).rejects.toBeInstanceOf(
      InvalidRecordError,
    )
    expect(await getNote(db, created.id)).toEqual(created)
  })

  it('@TAN-14 turns a bug into an issue when the bug details are cleared', async () => {
    const created = await createNote(db, { sessionId: session.id, tag: 'bug', text: 'x', bug })

    const updated = await updateNote(db, created.id, { tag: 'issue', bug: undefined })

    expect(updated.tag).toBe('issue')
    expect(updated.bug).toBeUndefined()
    expect(await getNote(db, created.id)).toEqual(updated)
  })

  it('@TAN-14 rejects an unknown id and creates nothing', async () => {
    await expect(updateNote(db, 'no-such-id', { text: 'x' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    )
    expect(await db.count('notes')).toBe(0)
  })
})

describe('deleteNote', () => {
  it('@TAN-14 removes that note and keeps its sibling', async () => {
    const doomed = await createNote(db, { sessionId: session.id, tag: 'note', text: 'doomed' })
    const sibling = await createNote(db, { sessionId: session.id, tag: 'note', text: 'kept' })

    await deleteNote(db, doomed.id)

    expect(await getNote(db, doomed.id)).toBeUndefined()
    expect(await getNote(db, sibling.id)).toEqual(sibling)
  })
})
