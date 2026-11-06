import { abortWith, sessionRange, type TansaDb } from './db'
import { InvalidRecordError, RecordNotFoundError } from './errors'
import type { NewNote, Note, NotePatch } from './types'

// The spec allows bug details only on a Bug.
function bugMismatch(note: Note): InvalidRecordError | undefined {
  if (note.bug !== undefined && note.tag !== 'bug') {
    return new InvalidRecordError(`A ${note.tag} cannot carry bug details`)
  }
  return undefined
}

export async function createNote(db: TansaDb, input: NewNote): Promise<Note> {
  const note: Note = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), attachments: [] }
  const invalid = bugMismatch(note)
  if (invalid) throw invalid
  // IndexedDB has no foreign keys: check the session in the same transaction.
  const tx = db.transaction(['sessions', 'notes'], 'readwrite')
  const sessionKey = await tx.objectStore('sessions').getKey(note.sessionId)
  if (sessionKey === undefined) {
    return abortWith(tx, new RecordNotFoundError('sessions', note.sessionId))
  }
  await tx.objectStore('notes').add(note)
  await tx.done
  return note
}

export function getNote(db: TansaDb, id: string): Promise<Note | undefined> {
  return db.get('notes', id)
}

// In createdAt order. Notes created in the same millisecond come back ordered
// by id: IndexedDB breaks index ties by primary key.
export function listNotes(db: TansaDb, sessionId: string): Promise<Note[]> {
  return db.getAllFromIndex('notes', 'bySession', sessionRange(sessionId))
}

export async function updateNote(db: TansaDb, id: string, patch: NotePatch): Promise<Note> {
  const tx = db.transaction('notes', 'readwrite')
  const stored = await tx.store.get(id)
  if (!stored) {
    return abortWith(tx, new RecordNotFoundError('notes', id))
  }
  // Protected fields come from the stored record, so a patch cast past its
  // type cannot change them. Keeping createdAt is what R3 relies on.
  const updated: Note = {
    ...stored,
    ...patch,
    id: stored.id,
    sessionId: stored.sessionId,
    createdAt: stored.createdAt,
  }
  // `bug: undefined` in the patch clears the details.
  if (updated.bug === undefined) delete updated.bug
  const invalid = bugMismatch(updated)
  if (invalid) return abortWith(tx, invalid)
  await tx.store.put(updated)
  await tx.done
  return updated
}

export async function deleteNote(db: TansaDb, id: string): Promise<void> {
  await db.delete('notes', id)
}
