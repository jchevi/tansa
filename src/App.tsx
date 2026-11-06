import { useEffect } from 'react'
import { NewSession } from './features/charter/NewSession'
import { Home } from './features/home/Home'
import { SessionScreen } from './features/session/SessionScreen'
import { DbProvider } from './features/shell/DbProvider'
import { useDb } from './features/shell/db-context'
import { Navigation } from './features/shell/Navigation'
import { Placeholder, type PlaceholderTitle } from './features/shell/Placeholder'
import { navigate, usePath } from './features/shell/router'
import { matchRoute, routes, type Route } from './features/shell/routes'
import { StorageError } from './features/shell/StorageError'
import { useSessionInProgress } from './features/shell/useSessionInProgress'

const placeholderTitles: Record<
  Exclude<Route, 'home' | 'newSession' | 'session'>,
  PlaceholderTitle
> = {
  history: 'nav.history',
  settings: 'nav.settings',
}

function Shell() {
  const db = useDb()
  const path = usePath()
  const route = matchRoute(path)
  const { state: progress, reload } = useSessionInProgress(db, path)

  // An unknown path shows Home; the address bar says so too.
  useEffect(() => {
    if (route === 'home' && path !== routes.home) navigate(routes.home, { replace: true })
  }, [route, path])

  if (progress.status === 'failed') return <StorageError />
  // Wait for the first read, so Home never shows New session and then switches to Resume.
  if (progress.status === 'loading') return <main />

  if (route === 'home') return <Home inProgress={progress.inProgress} />
  return (
    <>
      <Navigation current={route} hasSessionInProgress={progress.inProgress !== null} />
      {route === 'newSession' ? (
        <NewSession
          db={db}
          hasSessionInProgress={progress.inProgress !== null}
          onSessionInProgress={reload}
        />
      ) : route === 'session' ? (
        <SessionScreen inProgress={progress.inProgress} />
      ) : (
        <Placeholder title={placeholderTitles[route]} />
      )}
    </>
  )
}

function App() {
  return (
    <DbProvider>
      <Shell />
    </DbProvider>
  )
}

export default App
