import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import { DB_NAME } from './names'
import type { Note, Session, TimeSegment } from './types'

export interface TansaSchema extends DBSchema {
  sessions: {
    key: string
    value: Session
    indexes: { byCreatedAt: number }
  }
  notes: {
    key: string
    value: Note
    indexes: { bySession: [string, number] }
  }
  timeSegments: {
    key: string
    value: TimeSegment
    indexes: { bySession: [string, number] }
  }
}

export type TansaDb = IDBPDatabase<TansaSchema>

export type Migration = (
  db: TansaDb,
  tx: IDBPTransaction<TansaSchema, StoreNames<TansaSchema>[], 'versionchange'>,
) => void

// migrations[i] takes the database from version i to i + 1.
// APPEND-ONLY: never edit, reorder or remove a migration that has shipped.
// Existing databases have already run it, and the version is derived from
// the length of this list.
// Inside a migration, await nothing but requests on `tx`: awaiting anything
// else lets the upgrade transaction commit early.
export const migrations: readonly Migration[] = [
  // v1: the MVP stores.
  (db) => {
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
    sessions.createIndex('byCreatedAt', 'createdAt')
    const notes = db.createObjectStore('notes', { keyPath: 'id' })
    notes.createIndex('bySession', ['sessionId', 'createdAt'])
    const segments = db.createObjectStore('timeSegments', { keyPath: 'id' })
    segments.createIndex('bySession', ['sessionId', 'startedAt'])
  },
]

export const DB_VERSION = migrations.length

export { DB_NAME }

// Rolls back a readwrite transaction and rejects with the given error.
// Aborting makes `tx.done` reject too; that rejection is expected here.
export async function abortWith(
  tx: { abort(): void; done: Promise<void> },
  error: Error,
): Promise<never> {
  tx.abort()
  await tx.done.catch(() => undefined)
  throw error
}

// Every key of a `bySession` index ([sessionId, time]) that belongs to one
// session, in time order.
export function sessionRange(sessionId: string): IDBKeyRange {
  return IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity])
}

// Takes the list so tests can prove a future migration runs on old data
// without shipping a fake one. Not exported from index.ts.
export function openDatabase(list: readonly Migration[]): Promise<TansaDb> {
  const db = openDB<TansaSchema>(DB_NAME, list.length, {
    upgrade(database, oldVersion, newVersion, tx) {
      const target = newVersion ?? list.length
      for (let version = oldVersion; version < target; version++) {
        list[version]?.(database, tx)
      }
    },
    // Another tab wants a newer version: let it upgrade instead of blocking
    // it forever.
    blocking() {
      void db.then((connection) => {
        connection.close()
      })
    },
  })
  return db
}

export function openTansaDb(): Promise<TansaDb> {
  return openDatabase(migrations)
}
