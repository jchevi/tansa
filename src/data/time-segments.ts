import { abortWith, sessionRange, type TansaDb } from './db'
import { RecordNotFoundError } from './errors'
import type { NewTimeSegment, TimeSegment, TimeSegmentPatch } from './types'

export async function createTimeSegment(
  db: TansaDb,
  input: NewTimeSegment,
): Promise<TimeSegment> {
  const segment: TimeSegment = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    state: input.state,
    startedAt: input.startedAt ?? Date.now(),
  }
  // IndexedDB has no foreign keys: check the session in the same transaction.
  const tx = db.transaction(['sessions', 'timeSegments'], 'readwrite')
  const sessionKey = await tx.objectStore('sessions').getKey(segment.sessionId)
  if (sessionKey === undefined) {
    return abortWith(tx, new RecordNotFoundError('sessions', segment.sessionId))
  }
  await tx.objectStore('timeSegments').add(segment)
  await tx.done
  return segment
}

export function getTimeSegment(db: TansaDb, id: string): Promise<TimeSegment | undefined> {
  return db.get('timeSegments', id)
}

// In startedAt order. Segments that start in the same millisecond come back
// ordered by id: IndexedDB breaks index ties by primary key.
export function listTimeSegments(db: TansaDb, sessionId: string): Promise<TimeSegment[]> {
  return db.getAllFromIndex('timeSegments', 'bySession', sessionRange(sessionId))
}

// Only endedAt changes: a pause or resume closes one segment and opens
// another, so a segment never changes state, start or session.
export async function updateTimeSegment(
  db: TansaDb,
  id: string,
  patch: TimeSegmentPatch,
): Promise<TimeSegment> {
  const tx = db.transaction('timeSegments', 'readwrite')
  const stored = await tx.store.get(id)
  if (!stored) {
    return abortWith(tx, new RecordNotFoundError('timeSegments', id))
  }
  const updated: TimeSegment = { ...stored }
  if (patch.endedAt !== undefined) updated.endedAt = patch.endedAt
  await tx.store.put(updated)
  await tx.done
  return updated
}

export async function deleteTimeSegment(db: TansaDb, id: string): Promise<void> {
  await db.delete('timeSegments', id)
}
