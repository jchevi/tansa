import type { Page } from '@playwright/test'
import { DB_NAME } from '../../src/data/names.ts'
import type { Session, TimeSegment } from '../../src/data/types.ts'

type StoreName = 'sessions' | 'timeSegments'

// Reads a whole store straight from IndexedDB, so a test checks what was stored, not what
// the screen shows [TAN-18].
async function readStore<T>(page: Page, store: StoreName): Promise<T[]> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          reject(request.error ?? new Error('indexedDB.open failed'))
        }
      })
      try {
        return await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction(storeName).objectStore(storeName).getAll()
          request.onsuccess = () => {
            resolve(request.result)
          }
          request.onerror = () => {
            reject(request.error ?? new Error('getAll failed'))
          }
        })
      } finally {
        db.close()
      }
    },
    { dbName: DB_NAME, storeName: store },
  ) as Promise<T[]>
}

export const readSessions = (page: Page) => readStore<Session>(page, 'sessions')

export const readTimeSegments = (page: Page) => readStore<TimeSegment>(page, 'timeSegments')
