import { abortWith, sessionRange, type TansaDb } from './db'
import { RecordNotFoundError, SessionInProgressError } from './errors'
import type {
  Charter,
  NewSession,
  Session,
  SessionPatch,
  SessionStatus,
  StartedSession,
  TimeSegment,
} from './types'

// "In progress" is running or paused: a paused session is still the one the tester comes
// back to (spec R9, R14). Debrief and closed are not. Defined here, once, so the screens
// and the start guard can never disagree [TAN-17, TAN-18].
export function isInProgress(status: SessionStatus): boolean {
  return status === 'running' || status === 'paused'
}

// R1's default time-box; TAN-20 lets the tester choose another one.
const DEFAULT_TARGET_MINUTES = 60

// Starts a session: the session and its first running segment are written in one
// transaction, so a failure never leaves a running session with no time. The check for a
// session already in progress runs inside the same transaction: IndexedDB runs
// overlapping readwrite transactions on a store one after the other, so a second tab or a
// double click cannot slip a second session in between the check and the write.
export async function startSession(db: TansaDb, charter: Charter): Promise<StartedSession> {
  const tx = db.transaction(['sessions', 'timeSegments'], 'readwrite')
  const sessions = await tx.objectStore('sessions').getAll()
  const current = sessions.find((stored) => isInProgress(stored.status))
  if (current) {
    return abortWith(tx, new SessionInProgressError(current.id))
  }
  const now = Date.now()
  const session: Session = {
    id: crypto.randomUUID(),
    status: 'running',
    charter,
    areas: [],
    targetMinutes: DEFAULT_TARGET_MINUTES,
    createdAt: now,
  }
  const segment: TimeSegment = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    state: 'running',
    startedAt: now,
  }
  await tx.objectStore('sessions').add(session)
  await tx.objectStore('timeSegments').add(segment)
  await tx.done
  return { session, segment }
}

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
