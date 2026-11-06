// Every screen and its path. Five flat routes, so a small router of our own is enough
// (decision in docs/decisions.md, TAN-17).
export const routes = {
  home: '/',
  newSession: '/new',
  session: '/session',
  history: '/history',
  settings: '/settings',
} as const

export type Route = keyof typeof routes

const byPath = new Map<string, Route>(
  Object.entries(routes).map(([route, path]) => [path, route as Route]),
)

// A trailing slash is ignored; an unknown path is Home.
export function matchRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return byPath.get(path) ?? 'home'
}
