import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest'
import {
  createNote,
  createSession,
  createTimeSegment,
  deleteNote,
  deleteSession,
  deleteTimeSegment,
  getNote,
  getSession,
  getTimeSegment,
  listNotes,
  listSessions,
  listTimeSegments,
  openTansaDb,
  startSession,
  updateNote,
  updateSession,
  updateTimeSegment,
} from './index'

// Every way a browser page can send data out that a data module could reach
// for by name. The lint guard in data-boundaries.test.ts covers code paths
// this test does not run.
let spies: Record<string, Mock>

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  spies = {
    fetch: vi.fn(),
    XMLHttpRequest: vi.fn(),
    WebSocket: vi.fn(),
    EventSource: vi.fn(),
    sendBeacon: vi.fn(),
  }
  vi.stubGlobal('fetch', spies.fetch)
  vi.stubGlobal('XMLHttpRequest', spies.XMLHttpRequest)
  vi.stubGlobal('WebSocket', spies.WebSocket)
  vi.stubGlobal('EventSource', spies.EventSource)
  vi.stubGlobal('navigator', { sendBeacon: spies.sendBeacon })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('@TAN-14 the data layer makes no network requests', async () => {
  const db = await openTansaDb()
  try {
    const session = await createSession(db, {
      status: 'running',
      charter: { explore: 'the wishlist', with: 'a signed-in user', discover: 'sync gaps' },
      areas: ['wishlist'],
      targetMinutes: 45,
    })
    const note = await createNote(db, { sessionId: session.id, tag: 'note', text: 'item added' })
    const segment = await createTimeSegment(db, { sessionId: session.id, state: 'running' })

    await getSession(db, session.id)
    await getNote(db, note.id)
    await getTimeSegment(db, segment.id)
    await listSessions(db)
    await listNotes(db, session.id)
    await listTimeSegments(db, session.id)
    await updateSession(db, session.id, { status: 'paused' })
    await updateNote(db, note.id, { text: 'item added twice' })
    await updateTimeSegment(db, segment.id, { endedAt: Date.now() })
    await deleteNote(db, note.id)
    await deleteTimeSegment(db, segment.id)
    await deleteSession(db, session.id)
  } finally {
    db.close()
  }

  for (const [name, spy] of Object.entries(spies)) {
    expect(spy, name).not.toHaveBeenCalled()
  }
})

it('@TAN-18 startSession makes no network requests', async () => {
  const db = await openTansaDb()
  try {
    await startSession(db, {
      explore: 'the size guide',
      with: 'a mobile viewport',
      discover: 'layout gaps',
    })
  } finally {
    db.close()
  }

  for (const [name, spy] of Object.entries(spies)) {
    expect(spy, name).not.toHaveBeenCalled()
  }
})
