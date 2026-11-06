import { abortWith, sessionRange, type TansaDb } from './db'
import { RecordNotFoundError } from './errors'
import type { NewSession, Session, SessionPatch } from './types'

export async function createSession(db: TansaDb, input: NewSession): Promise<Session> {
  const session: Session = { ...input, id: crypto.randomUUID(), createdAt: Date.now() }
  await db.add('sessions', session)
  return session
}

export function getSession(db: TansaDb, id: string): Promise<Session | undefined> {
  return db.get('sessions', id)
}

// Newest first. Sessions created in the same millisecond come back ordered by
// id, descending: IndexedDB breaks index ties by primary key.
export async function listSessions(db: TansaDb): Promise<Session[]> {
  const sessions = await db.getAllFromIndex('sessions', 'byCreatedAt')
  return sessions.reverse()
}

export async function updateSession(
  db: TansaDb,
  id: string,
  patch: SessionPatch,
): Promise<Session> {
  const tx = db.transaction('sessions', 'readwrite')
  const stored = await tx.store.get(id)
  if (!stored) {
    return abortWith(tx, new RecordNotFoundError('sessions', id))
  }
  // Protected fields come from the stored record, so a patch cast past its
  // type cannot change them.
  const updated: Session = { ...stored, ...patch, id: stored.id, createdAt: stored.createdAt }
  await tx.store.put(updated)
  await tx.done
  return updated
}

// Removes the session with its notes and time segments in one transaction:
// no orphans, and nothing half-deleted if it fails.
export async function deleteSession(db: TansaDb, id: string): Promise<void> {
  const tx = db.transaction(['sessions', 'notes', 'timeSegments'], 'readwrite')
  const range = sessionRange(id)
  const noteKeys = await tx.objectStore('notes').index('bySession').getAllKeys(range)
  const segmentKeys = await tx.objectStore('timeSegments').index('bySession').getAllKeys(range)
  await Promise.all([
    tx.objectStore('sessions').delete(id),
    ...noteKeys.map((key) => tx.objectStore('notes').delete(key)),
    ...segmentKeys.map((key) => tx.objectStore('timeSegments').delete(key)),
  ])
  await tx.done
}
