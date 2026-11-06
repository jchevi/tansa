import { openTansaDb, type TansaDb } from '../../data'

let opening: Promise<TansaDb> | undefined

// One connection for the whole app, opened once: React StrictMode runs effects twice in
// development, and that must not open a second connection. Wrapping the call in a promise
// turns a synchronous throw (indexedDB.open blocked) into a rejection the UI can show.
export function openDatabaseOnce(): Promise<TansaDb> {
  opening ??= new Promise<TansaDb>((resolve) => {
    resolve(openTansaDb())
  })
  return opening
}
