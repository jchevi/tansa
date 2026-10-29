import { expect, it } from 'vitest'

// Throwaway: proves branch protection blocks a PR with a failing test. Never merged.
it('@TAN-11 demo failing test', () => {
  expect(1).toBe(2)
})
