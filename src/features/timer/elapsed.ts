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

// MM:SS with minutes unbounded, so overtime reads 63:00 (TAN-23). Seconds are floored.
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
