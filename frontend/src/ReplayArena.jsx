import { useEffect, useState } from 'react'
import { STATIONS, replayPlan } from './redteam.js'

// Three lanes (one per config) replaying a scenario's tool calls one step at a time. A "packet"
// labelled with the tool and its key argument travels along each lane and stops where the call's
// `outcome` says it stopped. Everything shown comes from the run data.

const TRAVEL_MS = 1100 // packet travel time at 1×
const HOLD_MS = 900 // time the result stays on screen before the next call, at 1×

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const STATION_TEXT = (kind) => ({
  source: kind === 'attack' ? ['📄', 'untrusted source'] : ['📄', 'content read'],
  agent: ['🤖', 'OfficeBot'],
  allowlist: ['🚧', 'allowlist'],
  guard: ['🛡️', 'Data-Flow Guard'],
  world: ['🌐', 'outside world'],
})
const pos = (i) => `${((i + 0.5) / STATIONS.length) * 100}%`

export default function ReplayArena({ row, speed }) {
  const plan = replayPlan(row)
  const n = plan.length
  // k: the call being replayed; arrived: its packet has reached where it stops; done: every call replayed
  const [k, setK] = useState(0)
  const [arrived, setArrived] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [done, setDone] = useState(false)

  // With reduced motion, show the final state straight away
  useEffect(() => {
    if (reducedMotion() && n > 0) { setK(n - 1); setArrived(true); setDone(true); setPlaying(false) }
  }, [n])

  useEffect(() => {
    if (!playing || n === 0) return
    if (!arrived) {
      const id = setTimeout(() => setArrived(true), 40) // one frame at the start position, then travel
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => {
      if (k + 1 < n) { setK(k + 1); setArrived(false) } else { setDone(true); setPlaying(false) }
    }, (TRAVEL_MS + HOLD_MS) / speed)
    return () => clearTimeout(id)
  }, [playing, arrived, k, n, speed])

  function step() {
    setPlaying(false)
    if (!arrived) { setArrived(true); return }
    if (k + 1 < n) { setK(k + 1); setArrived(false); setTimeout(() => setArrived(true), 40) } else setDone(true)
  }
  function restart() { setK(0); setArrived(false); setDone(false); setPlaying(true) }
  function togglePlay() {
    if (done) { restart(); return }
    setPlaying(!playing)
  }

  const stations = STATION_TEXT(row.kind)
  const travel = reducedMotion() ? 0 : TRAVEL_MS / speed

  return (
    <section className="arena" aria-label="Attack replay">
      <header className="arena-head">
        <h2>Replay: <span className="arena-title">{row.title}</span></h2>
        <div className="arena-controls">
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button onClick={step} aria-label="Step">⏭ Step</button>
          <button onClick={restart} aria-label="Restart">↺ Restart</button>
          <span className="muted arena-count" aria-live="polite">call {n ? Math.min(k + 1, n) : 0} / {n}</span>
        </div>
      </header>

      <div className="lanes">
        {plan.lanes.map((lane) => {
          const call = lane.calls.length ? lane.calls[Math.min(k, lane.calls.length - 1)] : null
          const waiting = k >= lane.calls.length // this lane has no more calls; it shows its last one
          const here = Boolean(call) && (arrived || waiting)
          const stopAt = call ? call.stopAt : 0
          const stamped = here && call.stamp
          const finished = done || (waiting && arrived)
          return (
            <div key={lane.config} className={`lane lane-${lane.config}`}>
              <div className="lane-label">{lane.label}</div>
              <div className="track">
                <div className="wire" aria-hidden="true" />
                {STATIONS.map((s, i) => {
                  const off = (s === 'allowlist' && !lane.gates.allowlist) || (s === 'guard' && !lane.gates.guard)
                  const hit = stamped && i === stopAt
                  const breach = s === 'world' && done && lane.verdict.tone === 'red' && row.kind === 'attack'
                  const cls = ['station', `st-${s}`, off && 'off', hit && `hit hit-${call.tone}`, breach && 'breach'].filter(Boolean).join(' ')
                  return (
                    <div key={s} className={cls} style={{ left: pos(i) }}>
                      <span className="st-icon" aria-hidden="true">{stations[s][0]}</span>
                      <span className="st-name">{stations[s][1]}{off ? ' (off)' : ''}</span>
                    </div>
                  )
                })}
                {call && (
                  <div className={`packet packet-${here && call.stamp ? call.tone : done && lane.verdict.tone === 'red' && stopAt === 4 ? 'red' : 'live'}`}
                       style={{ left: here ? pos(stopAt) : pos(0), transitionDuration: `${here ? travel : 0}ms` }}>
                    {call.label}
                  </div>
                )}
                {stamped && (
                  <div className={`stamp stamp-${call.tone}`} style={{ left: pos(stopAt) }} role="status">{call.stamp}</div>
                )}
              </div>
              <div className="lane-result">
                {finished
                  ? <span className={`verdict verdict-${lane.verdict.tone}`}>{lane.verdict.text}</span>
                  : <span className="muted">step {call ? call.step : '—'}</span>}
              </div>
              {stamped && call.reason && <p className="lane-reason">{call.reason}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
