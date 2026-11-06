import { useCallback, useEffect, useState } from 'react'
import {
  isInProgress,
  listSessions,
  listTimeSegments,
  type Session,
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

// The newest session in progress (running or paused, see isInProgress) with its time
// segments, or null. startSession allows only one at a time; if there were several, the
// newest wins.
export async function findSessionInProgress(db: TansaDb): Promise<SessionInProgress | null> {
  const sessions = await listSessions(db)
  const session = sessions.find((candidate) => isInProgress(candidate.status))
  if (!session) return null
  return { session, segments: await listTimeSegments(db, session.id) }
}

// Read again on every screen change, so Home and the navigation see a session started or
// ended on another screen, and on reload() for a change made without one (a start
// refused because another tab started a session). Until the first read finishes, the
// state is loading.
export function useSessionInProgress(
  db: TansaDb,
  path: string,
): { state: InProgressState; reload: () => void } {
  const [state, setState] = useState<InProgressState>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => {
    setVersion((current) => current + 1)
  }, [])

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
  }, [db, path, version])

  return { state, reload }
}
