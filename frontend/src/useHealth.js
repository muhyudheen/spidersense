import { useEffect, useState } from 'react'
import { getHealth } from './api.js'

const POLL_MS = 15_000

// 'checking' until the first answer, then 'online' or 'offline' from GET /api/health, re-checked every 15 s.
export function useHealth() {
  const [state, setState] = useState('checking')
  useEffect(() => {
    let alive = true
    const check = () => getHealth().then(
      (h) => alive && setState(h && h.status === 'ok' ? 'online' : 'offline'),
      () => alive && setState('offline'),
    )
    check()
    const id = setInterval(check, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return state
}
