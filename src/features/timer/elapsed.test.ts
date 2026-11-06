import { describe, expect, it } from 'vitest'
import type { TimeSegment } from '../../data'
import { elapsedMs, formatElapsed } from './elapsed'

const NOW = 1_000_000_000
const MINUTE = 60_000

function segment(state: TimeSegment['state'], startedAt: number, endedAt?: number): TimeSegment {
  return {
    id: crypto.randomUUID(),
    sessionId: 'session',
    state,
    startedAt,
    ...(endedAt === undefined ? {} : { endedAt }),
  }
}

describe('elapsedMs', () => {
  it('@TAN-17 an open running segment counts up to now', () => {
    expect(elapsedMs([segment('running', NOW - 5 * MINUTE)], NOW)).toBe(5 * MINUTE)
  })

  it('@TAN-17 closed and open running segments add up', () => {
    const segments = [
      segment('running', NOW - 30 * MINUTE, NOW - 20 * MINUTE),
      segment('running', NOW - 4 * MINUTE),
    ]
    expect(elapsedMs(segments, NOW)).toBe(14 * MINUTE)
  })

  it('@TAN-17 paused segments do not count, open or closed', () => {
    const segments = [
      segment('running', NOW - 30 * MINUTE, NOW - 20 * MINUTE),
      segment('paused', NOW - 20 * MINUTE, NOW - 15 * MINUTE),
      segment('running', NOW - 15 * MINUTE, NOW - 10 * MINUTE),
      segment('paused', NOW - 10 * MINUTE),
    ]
    expect(elapsedMs(segments, NOW)).toBe(15 * MINUTE)
  })

  it('@TAN-17 a segment that ends before it starts counts zero', () => {
    // The device clock moved back while the segment was open.
    expect(elapsedMs([segment('running', NOW + MINUTE)], NOW)).toBe(0)
  })

  it('@TAN-17 no segments is zero', () => {
    expect(elapsedMs([], NOW)).toBe(0)
  })
})

describe('formatElapsed', () => {
  it.each([
    [0, '00:00'],
    [59_900, '00:59'],
    [37 * MINUTE + 12_000, '37:12'],
    [63 * MINUTE, '63:00'],
  ])('@TAN-17 %i ms reads %s', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text)
  })
})
