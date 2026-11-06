import { useEffect, useState } from 'react'

// The current time, refreshed every `intervalMs`. Only a trigger to re-render: displayed
// times are always recomputed from stored segments, never incremented here.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearInterval(id)
    }
  }, [intervalMs])
  return now
}
