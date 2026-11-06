import { createContext, use } from 'react'
import type { TansaDb } from '../../data'

export const DbContext = createContext<TansaDb | null>(null)

// The app-wide connection. Screens render only inside DbProvider, once it is open.
export function useDb(): TansaDb {
  const db = use(DbContext)
  if (!db) throw new Error('useDb must be used inside DbProvider')
  return db
}
