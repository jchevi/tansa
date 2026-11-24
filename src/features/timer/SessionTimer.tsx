import { useTranslation } from 'react-i18next'
import type { SessionInProgress } from '../shell/useSessionInProgress'
import { elapsedMs, formatElapsed, remainingMs, ringProgress } from './elapsed'
import { useNow } from './useNow'
import './timer.css'

const RADIUS = 7
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const isoDuration = (ms: number) => `PT${String(Math.floor(ms / 1000))}S`

// The session timer in the header (spec R2, mockup "v0.1 · Session"): the ensō ring, the
// elapsed time and the time left before the target. Every value is computed on each render
// from the stored segments and Date.now(); useNow only triggers the render [TAN-21].
// Not a live region: a screen reader announcing every second would drown everything else.
export function SessionTimer({ inProgress }: { inProgress: SessionInProgress }) {
  const { t } = useTranslation()
  const now = useNow(1000)
  const { targetMinutes } = inProgress.session
  const elapsed = elapsedMs(inProgress.segments, now)
  const remaining = remainingMs(elapsed, targetMinutes)
  const offset = CIRCUMFERENCE * (1 - ringProgress(elapsed, targetMinutes))

  return (
    <div role="group" aria-label={t('timer.label')} className="timer">
      <svg
        role="img"
        aria-label={t('timer.ring', {
          elapsed: Math.floor(elapsed / 60_000),
          target: targetMinutes,
        })}
        className="timer-ring"
        width="18"
        height="18"
        viewBox="0 0 18 18"
      >
        <circle className="timer-ring-track" cx="9" cy="9" r={RADIUS} />
        <circle
          className="timer-ring-arc"
          cx="9"
          cy="9"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 9 9)"
        />
      </svg>
      <time className="timer-elapsed" dateTime={isoDuration(elapsed)}>
        {formatElapsed(elapsed)}
      </time>
      <time className="timer-remaining" dateTime={isoDuration(remaining)}>
        {t('timer.remaining', { time: formatElapsed(remaining) })}
      </time>
    </div>
  )
}
