import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DB_VERSION,
  migrations,
  openDatabase,
  openTansaDb,
  type Migration,
  type TansaDb,
} from './db'
import type { Session } from './types'

const open: TansaDb[] = []

beforeEach(() => {
  // A fresh, empty factory per test: no state shared between tests.
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  for (const db of open.splice(0)) db.close()
})

function track(db: TansaDb): TansaDb {
  open.push(db)
  return db
}

const session: Session = {
  id: 'a3c1e7f2-0000-4000-8000-000000000001',
  status: 'running',
  charter: { explore: 'checkout', with: 'a guest cart', discover: 'pricing errors' },
  areas: [],
  targetMinutes: 60,
  createdAt: 1_000,
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`timed out after ${String(ms)} ms`))
    }, ms)
  })
}

describe('database schema', () => {
  it('@TAN-14 version 1 creates the three stores with their key paths and indexes', async () => {
    expect(DB_VERSION).toBe(1)
    const db = track(await openTansaDb())

    expect(db.version).toBe(1)
    expect([...db.objectStoreNames].sort()).toEqual(['notes', 'sessions', 'timeSegments'])

    const tx = db.transaction(['sessions', 'notes', 'timeSegments'])
    const sessions = tx.objectStore('sessions')
    const notes = tx.objectStore('notes')
    const segments = tx.objectStore('timeSegments')

    expect(sessions.keyPath).toBe('id')
    expect(notes.keyPath).toBe('id')
    expect(segments.keyPath).toBe('id')

    expect([...sessions.indexNames]).toEqual(['byCreatedAt'])
    expect(sessions.index('byCreatedAt').keyPath).toBe('createdAt')
    expect([...notes.indexNames]).toEqual(['bySession'])
    expect(notes.index('bySession').keyPath).toEqual(['sessionId', 'createdAt'])
    expect([...segments.indexNames]).toEqual(['bySession'])
    expect(segments.index('bySession').keyPath).toEqual(['sessionId', 'startedAt'])
    await tx.done
  })
})

describe('migrations', () => {
  it('@TAN-14 a v2 migration runs once on v1 data and v1 does not run again', async () => {
    const v1 = track(await openTansaDb())
    await v1.put('sessions', session)
    v1.close()

    const v2 = vi.fn<Migration>((_db, tx) => {
      // A migration may rewrite records through the upgrade transaction.
      const store = tx.objectStore('sessions')
      void store.get(session.id).then((stored) => {
        if (stored) void store.put({ ...stored, build: 'migrated' })
      })
    })

    // Re-running v1 would throw ConstraintError (the stores already exist)
    // and reject this open.
    const db = track(await openDatabase([...migrations, v2]))

    expect(db.version).toBe(2)
    expect(v2).toHaveBeenCalledTimes(1)
    expect(await db.get('sessions', session.id)).toEqual({ ...session, build: 'migrated' })
  })

  it('@TAN-14 an open connection closes when another tab opens a newer version', async () => {
    // Kept open on purpose: without a blocking handler it would block the
    // upgrade below forever.
    track(await openTansaDb())

    const noop: Migration = () => undefined
    const upgraded = track(
      await Promise.race([openDatabase([...migrations, noop]), timeout(2_000)]),
    )

    expect(upgraded.version).toBe(2)
  })
})
