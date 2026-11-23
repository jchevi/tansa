import { useEffect, useState } from 'react'

// The current time, refreshed every `intervalMs` and at once when the tab becomes visible
// again. Only a trigger to re-render: displayed times are always recomputed from stored
// segments, never incremented here. Browsers throttle timers in background tabs, so
// without the visibility refresh the first frame after coming back could be stale for up
// to a minute [TAN-21].
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => {
      setNow(Date.now())
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const id = setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])
  return now
}
