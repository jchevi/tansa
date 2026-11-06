import { useSyncExternalStore } from 'react'

// A minimal router on the History API: the address bar is the state, popstate and our own
// navigate() are the changes. See routes.ts for the screens.

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function notify() {
  for (const listener of listeners) listener()
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}

export function navigate(path: string, { replace = false } = {}) {
  if (path === window.location.pathname && !replace) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  notify()
}

export interface ClickLike {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

// Only a plain left click on a link that opens in this tab is handled by the app.
// Everything else (Ctrl/Cmd/Shift/Alt, middle click, target=_blank) stays with the
// browser, so "open in a new tab" keeps working.
export function isPlainLeftClick(event: ClickLike, target: string | null): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    (target === null || target === '' || target === '_self')
  )
}
