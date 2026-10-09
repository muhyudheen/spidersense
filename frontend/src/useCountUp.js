import { useEffect, useState } from 'react'
import { countUpValue } from './redteam.js'

// Counts from 0 up to `target` over `ms`; shows `target` at once with reduced motion.
export function useCountUp(target, decimals = 0, ms = 900) {
  const [value, setValue] = useState(target)
  useEffect(() => {
    if (target == null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    let frame
    const t0 = performance.now()
    const tick = (now) => {
      const t = (now - t0) / ms
      setValue(countUpValue(target, t, decimals))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, decimals, ms])
  return value
}
