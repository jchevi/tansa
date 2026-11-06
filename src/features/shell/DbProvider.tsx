import { useEffect, useState, type ReactNode } from 'react'
import type { TansaDb } from '../../data'
import { DbContext } from './db-context'
import { openDatabaseOnce } from './open-database'
import { StorageError } from './StorageError'

type State = { status: 'opening' } | { status: 'open'; db: TansaDb } | { status: 'failed' }

// Renders its children only once the database is open, so no screen has to handle a
// missing connection. While it opens, the page frame stays empty (a few milliseconds).
export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'opening' })

  useEffect(() => {
    let active = true
    openDatabaseOnce().then(
      (db) => {
        if (active) setState({ status: 'open', db })
      },
      (error: unknown) => {
        console.error(error)
        if (active) setState({ status: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'failed') return <StorageError />
  if (state.status === 'opening') return <main />
  return <DbContext value={state.db}>{children}</DbContext>
}
