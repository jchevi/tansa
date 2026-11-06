// Record shapes follow the data model in docs/spec.md. Timestamps are epoch
// milliseconds: durations are subtraction, index order is numeric, and they
// survive JSON export unchanged.

export type SessionStatus = 'running' | 'paused' | 'debrief' | 'closed'

export interface Charter {
  explore: string
  with: string
  discover: string
}

export interface Session {
  id: string
  status: SessionStatus
  charter: Charter
  areas: string[]
  build?: string
  environment?: string
  testData?: string
  targetMinutes: number
  createdAt: number
  closedAt?: number
}

export type NoteTag = 'note' | 'bug' | 'issue'

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface BugDetails {
  title: string
  steps: string
  expected: string
  actual: string
  severity: BugSeverity
}

export interface Note {
  id: string
  sessionId: string
  tag: NoteTag
  text: string
  createdAt: number
  // Always empty until the attachments store (v0.2); kept so the record
  // matches the spec.
  attachments: string[]
  // Only when tag is 'bug'.
  bug?: BugDetails
}

export type TimeSegmentState = 'running' | 'paused'

export interface TimeSegment {
  id: string
  sessionId: string
  state: TimeSegmentState
  startedAt: number
  // The open segment has none.
  endedAt?: number
}

// The data layer sets ids and creation times, so inputs never carry them.
export type NewSession = Omit<Session, 'id' | 'createdAt'>
export type SessionPatch = Partial<Omit<Session, 'id' | 'createdAt'>>

export type NewNote = Omit<Note, 'id' | 'createdAt' | 'attachments'>
export type NotePatch = Partial<Omit<Note, 'id' | 'sessionId' | 'createdAt'>>

export interface NewTimeSegment {
  sessionId: string
  state: TimeSegmentState
  // Defaults to now. Passing it lets closing one segment and opening the
  // next share one instant.
  startedAt?: number
}
// A segment never changes state, start or session: a pause or resume closes
// one segment and opens another.
export interface TimeSegmentPatch {
  endedAt?: number
}
