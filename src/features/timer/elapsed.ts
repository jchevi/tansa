import type { TimeSegment } from '../../data'

// Session time is the sum of its stored running segments, never an in-memory counter, so a
// reload, a sleeping laptop or a throttled tab cannot change it (spec R2). The open segment
// counts up to `now`; paused segments count zero.
export function elapsedMs(segments: readonly TimeSegment[], now: number): number {
  let total = 0
  for (const segment of segments) {
    if (segment.state !== 'running') continue
    // A negative span (the device clock moved back) counts zero.
    total += Math.max(0, (segment.endedAt ?? now) - segment.startedAt)
  }
  return total
}

const MINUTE = 60_000

// Time left before the target: the target minus the whole seconds shown as elapsed, so the
// two numbers on screen always add up to the target (37:12 and 22:48 of 60). At or past
// the target it is 0, never negative; TAN-23 shows the overtime [TAN-21].
export function remainingMs(elapsed: number, targetMinutes: number): number {
  const shownElapsed = Math.floor(elapsed / 1000) * 1000
  return Math.max(0, targetMinutes * MINUTE - shownElapsed)
}

// How much of the ensō ring is drawn: the share of the target elapsed, from 0 to 1. A
// target of 0 or less draws nothing rather than NaN [TAN-21].
export function ringProgress(elapsed: number, targetMinutes: number): number {
  if (!(targetMinutes > 0)) return 0
  return Math.min(1, Math.max(0, elapsed / (targetMinutes * MINUTE)))
}

// MM:SS with minutes unbounded, so overtime reads 63:00 (TAN-23). Seconds are floored.
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
