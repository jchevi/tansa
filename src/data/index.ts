// The only public surface of the data layer. Components import from here and
// never touch IndexedDB directly.
export { DB_VERSION, openTansaDb, type TansaDb } from './db'
export { InvalidRecordError, RecordNotFoundError, SessionInProgressError } from './errors'
export { createNote, deleteNote, getNote, listNotes, updateNote } from './notes'
export {
  createSession,
  DEFAULT_TARGET_MINUTES,
  deleteSession,
  endSession,
  getSession,
  isInProgress,
  listSessions,
  startSession,
  TARGET_MINUTE_OPTIONS,
  updateSession,
} from './sessions'
export {
  createTimeSegment,
  deleteTimeSegment,
  getTimeSegment,
  listTimeSegments,
  updateTimeSegment,
} from './time-segments'
export type * from './types'
