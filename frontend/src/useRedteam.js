import { useCallback, useState } from 'react'
import { runRedteam } from './api.js'

// The last red-team run per mode, shared by the Overview, Red-Team and Guard pages, so one run
// fills all three. `start(mode)` runs the suite (about a second) and stores the result.
export function useRedteam() {
  const [runs, setRuns] = useState({}) // mode → {run, demo}
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = useCallback(async (mode) => {
    setBusy(true)
    setError('')
    try {
      const out = await runRedteam(mode)
      setRuns((r) => ({ ...r, [mode]: out }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  return { runs, busy, error, start }
}
