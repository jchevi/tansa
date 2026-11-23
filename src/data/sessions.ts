import { abortWith, sessionRange, type TansaDb } from './db'
import { InvalidRecordError, RecordNotFoundError, SessionInProgressError } from './errors'
import type {
  NewSession,
  Session,
  SessionPatch,
  SessionStatus,
  StartedSession,
  StartSessionInput,
  TargetMinutes,
  TimeSegment,
} from './types'

// "In progress" is running or paused: a paused session is still the one the tester comes
// back to (spec R9, R14). Debrief and closed are not. Defined here, once, so the screens
// and the start guard can never disagree [TAN-17, TAN-18].
export function isInProgress(status: SessionStatus): boolean {
  return status === 'running' || status === 'paused'
}

// R1's time-boxes and its default. The screen builds its choice from this list, so the
// screen and the store can never disagree [TAN-20].
export const TARGET_MINUTE_OPTIONS = [45, 60, 90, 120] as const satisfies readonly TargetMinutes[]
export const DEFAULT_TARGET_MINUTES: TargetMinutes = 60

function isTargetMinutes(value: unknown): value is TargetMinutes {
  return (TARGET_MINUTE_OPTIONS as readonly unknown[]).includes(value)
}

// Starts a session: the session and its first running segment are written in one
// transaction, so a failure never leaves a running session with no time. The check for a
// session already in progress runs inside the same transaction: IndexedDB runs
// overlapping readwrite transactions on a store one after the other, so a second tab or a
// double click cannot slip a second session in between the check and the write.
// The context is stored as given; the screen trims it and leaves out blank fields.
// A target outside R1's list is refused before anything is opened: the timer and its
// warning (TAN-21) measure against it, and a 0 or NaN would break them silently [TAN-20].
export async function startSession(
  db: TansaDb,
  { charter, context = { areas: [] }, targetMinutes = DEFAULT_TARGET_MINUTES }: StartSessionInput,
): Promise<StartedSession> {
  if (!isTargetMinutes(targetMinutes)) {
    throw new InvalidRecordError(`${String(targetMinutes)} is not a session time-box`)
  }
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
    // A copy, so the caller changing its array later cannot change the returned session.
    areas: [...context.areas],
    // Only the keys that are present: a blank field is no key, not "" [TAN-19].
    ...(context.environment !== undefined && { environment: context.environment }),
    ...(context.build !== undefined && { build: context.build }),
    ...(context.testData !== undefined && { testData: context.testData }),
    targetMinutes,
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

// Ends a session before its debrief: every segment still open gets endedAt = at, and the
// status becomes debrief, in one transaction, so time never keeps counting for a session
// that is no longer in progress. closedAt stays unset: it is set when the debrief is closed
// (spec R6). Only a session in progress can end, so a second tab or a double click cannot
// end it twice; the check runs in the same transaction as the write [TAN-21].
export async function endSession(
  db: TansaDb,
  id: string,
  at: number = Date.now(),
): Promise<Session> {
  const tx = db.transaction(['sessions', 'timeSegments'], 'readwrite')
  const sessions = tx.objectStore('sessions')
  const stored = await sessions.get(id)
  if (!stored) {
    return abortWith(tx, new RecordNotFoundError('sessions', id))
  }
  if (!isInProgress(stored.status)) {
    return abortWith(
      tx,
      new InvalidRecordError(`session ${id} is ${stored.status}, not in progress`),
    )
  }
  const segments = tx.objectStore('timeSegments')
  const open = (await segments.index('bySession').getAll(sessionRange(id))).filter(
    (segment) => segment.endedAt === undefined,
  )
  const ended: Session = { ...stored, status: 'debrief' }
  await Promise.all([
    ...open.map((segment) => segments.put({ ...segment, endedAt: at })),
    sessions.put(ended),
  ])
  await tx.done
  return ended
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
