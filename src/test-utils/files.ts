import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// File helpers shared by the workflow tests. Every path is relative to the repo root, so
// a path reads the same in every test file [TAN-111].

// The absolute path of a file given relative to the repo root.
export const fromRoot = (relative: string) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url))

// A repo file as UTF-8 text.
export const read = (relative: string) => readFileSync(fromRoot(relative), 'utf8')

// A repo file as bytes, for binary files such as PNGs [TAN-113].
export const readBytes = (relative: string) => readFileSync(fromRoot(relative))
