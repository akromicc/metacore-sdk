import { useCallback, useEffect, useRef, useState } from 'react'

/** Seconds a buyer waits before asking for another code: the server's own cooldown (`storefront_customers`: 60 s). */
export const RESEND_COOLDOWN_SECONDS = 60

/**
 * A countdown for the "resend the code" button. `initial` seconds on first render (so the server-rendered page and the
 * hydrated one agree), `start(n)` restarts it. It counts against the clock, not by ticks, so a throttled background tab
 * does not leave the button locked. Without JavaScript nothing counts: the server enforces the real cooldown (429).
 */
export function useCooldown(initial = 0): { remaining: number; start: (seconds: number) => void } {
  const until = useRef<number | null>(null)
  const [remaining, setRemaining] = useState(initial)
  const mounted = useRef(false)

  const tick = useCallback(() => {
    if (until.current === null) return
    const left = Math.max(0, Math.ceil((until.current - Date.now()) / 1000))
    setRemaining(left)
    if (left === 0) until.current = null
  }, [])

  const start = useCallback(
    (seconds: number) => {
      const s = Math.max(0, Math.floor(seconds))
      until.current = s > 0 ? Date.now() + s * 1000 : null
      setRemaining(s)
    },
    [],
  )

  useEffect(() => {
    // The first render counted `initial` without a clock: arm it now.
    if (!mounted.current) {
      mounted.current = true
      if (initial > 0) until.current = Date.now() + initial * 1000
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initial` only matters on mount
  }, [tick])

  return { remaining, start }
}
