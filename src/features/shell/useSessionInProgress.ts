import { useEffect, useState } from 'react'
import {
  listSessions,
  listTimeSegments,
  type Session,
  type SessionStatus,
  type TansaDb,
  type TimeSegment,
} from '../../data'

export interface SessionInProgress {
  session: Session
  segments: TimeSegment[]
}

export type InProgressState =
  | { status: 'loading' }
  | { status: 'ready'; inProgress: SessionInProgress | null }
  | { status: 'failed' }

// "In progress" is running or paused: a paused session is still the one the tester comes
// back to (spec R9, R14). Debrief and closed are not.
const IN_PROGRESS: readonly SessionStatus[] = ['running', 'paused']

// The newest session in progress with its time segments, or null. TAN-18 allows only one
// at a time; if there were several, the newest wins.
export async function findSessionInProgress(db: TansaDb): Promise<SessionInProgress | null> {
  const sessions = await listSessions(db)
  const session = sessions.find((candidate) => IN_PROGRESS.includes(candidate.status))
  if (!session) return null
  return { session, segments: await listTimeSegments(db, session.id) }
}

// Read again on every screen change, so Home and the navigation see a session started or
// ended on another screen. Until the first read finishes, the state is loading.
export function useSessionInProgress(db: TansaDb, path: string): InProgressState {
  const [state, setState] = useState<InProgressState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    findSessionInProgress(db).then(
      (inProgress) => {
        if (active) setState({ status: 'ready', inProgress })
      },
      (error: unknown) => {
        console.error(error)
        if (active) setState({ status: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [db, path])

  return state
}
