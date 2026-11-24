import type { Page } from '@playwright/test'
import { DB_NAME } from '../../src/data/names.ts'
import type { Session, SessionStatus, TimeSegment, TimeSegmentState } from '../../src/data/types.ts'

export interface SeedSegment {
  state: TimeSegmentState
  startedAt: number
  endedAt?: number
}

export interface SeedSession {
  status: SessionStatus
  explore: string
  createdAt: number
  segments: SeedSegment[]
  // Defaults to 60, R1's default [TAN-21].
  targetMinutes?: number
}

// Writes a session and its time segments straight into IndexedDB, the way the data layer
// stores them (records typed from src/data/types.ts, ids from crypto.randomUUID()).
// The app must have opened the database first, so its stores exist: open the page, wait
// for a screen, then seed and reload [TAN-17].
export async function seedSession(page: Page, input: SeedSession): Promise<void> {
  await page.evaluate(
    async ({ dbName, seed }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          reject(request.error ?? new Error('indexedDB.open failed'))
        }
      })
      const session: Session = {
        id: crypto.randomUUID(),
        status: seed.status,
        charter: { explore: seed.explore, with: 'a guest account', discover: 'pricing errors' },
        areas: [],
        targetMinutes: seed.targetMinutes ?? 60,
        createdAt: seed.createdAt,
      }
      const segments: TimeSegment[] = seed.segments.map((segment) => ({
        id: crypto.randomUUID(),
        sessionId: session.id,
        ...segment,
      }))
      const tx = db.transaction(['sessions', 'timeSegments'], 'readwrite')
      tx.objectStore('sessions').add(session)
      for (const segment of segments) tx.objectStore('timeSegments').add(segment)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          resolve()
        }
        tx.onerror = () => {
          reject(tx.error ?? new Error('seed transaction failed'))
        }
        tx.onabort = () => {
          reject(tx.error ?? new Error('seed transaction aborted'))
        }
      })
      db.close()
    },
    { dbName: DB_NAME, seed: input },
  )
}

// Changes a stored session's status straight in IndexedDB, as another tab ending the
// session would, while this page still shows it in progress [TAN-21].
export async function setSessionStatus(page: Page, status: SessionStatus): Promise<void> {
  await page.evaluate(
    async ({ dbName, next }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          reject(request.error ?? new Error('indexedDB.open failed'))
        }
      })
      const tx = db.transaction('sessions', 'readwrite')
      const store = tx.objectStore('sessions')
      const all = await new Promise<Session[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => {
          resolve(request.result as Session[])
        }
        request.onerror = () => {
          reject(request.error ?? new Error('getAll failed'))
        }
      })
      for (const session of all) store.put({ ...session, status: next })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          resolve()
        }
        tx.onerror = () => {
          reject(tx.error ?? new Error('status transaction failed'))
        }
      })
      db.close()
    },
    { dbName: DB_NAME, next: status },
  )
}
