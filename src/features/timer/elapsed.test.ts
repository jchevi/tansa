import { describe, expect, it } from 'vitest'
import type { TimeSegment } from '../../data'
import { elapsedMs, formatElapsed, remainingMs, ringProgress } from './elapsed'

const SECOND = 1_000

describe('remainingMs', () => {
  it('@TAN-21 nothing elapsed leaves the whole target', () => {
    expect(remainingMs(0, 60)).toBe(60 * 60_000)
  })

  it('@TAN-21 counts from the whole seconds shown as elapsed', () => {
    // 37:12.6 is shown as 37:12, so 22:48 is left, not 22:47.
    expect(formatElapsed(remainingMs((37 * 60 + 12) * SECOND + 600, 60))).toBe('22:48')
  })

  it('@TAN-21 is 0 at the target and never negative past it', () => {
    expect(remainingMs(60 * 60_000, 60)).toBe(0)
    expect(remainingMs(60 * 60_000 + 5 * SECOND, 60)).toBe(0)
  })

  it('@TAN-21 elapsed and remaining always add up to the target in whole seconds', () => {
    for (const target of [45, 60, 90, 120]) {
      for (let elapsed = 0; elapsed < target * 60_000; elapsed += 7_919) {
        const shownElapsed = Math.floor(elapsed / SECOND)
        const shownRemaining = Math.floor(remainingMs(elapsed, target) / SECOND)
        expect(shownElapsed + shownRemaining).toBe(target * 60)
      }
    }
  })
})

describe('ringProgress', () => {
  it('@TAN-21 is the share of the target elapsed', () => {
    expect(ringProgress(0, 60)).toBe(0)
    expect(ringProgress(30 * 60_000, 60)).toBe(0.5)
  })

  it('@TAN-21 stops at a full ring past the target', () => {
    expect(ringProgress(90 * 60_000, 60)).toBe(1)
  })

  it('@TAN-21 a target of 0 gives an empty ring, not NaN', () => {
    expect(ringProgress(5 * 60_000, 0)).toBe(0)
  })
})

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
