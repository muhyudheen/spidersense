import { useEffect, useRef, useState } from 'react'
import { getRedteamScenarios } from '../api.js'
import IncidentCard from '../IncidentCard.jsx'
import ModeToggle from '../ModeToggle.jsx'
import ReplayArena from '../ReplayArena.jsx'
import {
  ASSIST_RANGE_TIP, CONFIG_LABELS, CONFIGS, GUARD_CONFIG, categoryCounts, chipFor, incidentsFor, keyArg, matrixRows,
  outcomeBadge, pct, scoreboard,
} from '../redteam.js'
import { useHashParam } from '../router.js'
import ScoreChart from '../ScoreChart.jsx'

export default function RedTeamPage({ mode, setMode, redteam }) {
  const { runs, busy, error, start } = redteam
  const run = runs[mode] ? runs[mode].run : null
  const demo = runs[mode] ? runs[mode].demo : false
  const [scenarios, setScenarios] = useState([])
  const [filter, setFilter] = useState('all')
  const [speed, setSpeed] = useState(1)
  const selectedParam = useHashParam()
  const arenaRef = useRef(null)

  // The suite takes about a second, so it runs on arrival (and on a mode change) when this mode has no run yet
  useEffect(() => { if (!runs[mode]) start(mode) }, [mode])
  useEffect(() => { getRedteamScenarios().then((s) => setScenarios(s.scenarios), () => {}) }, [])
  // Picking a scenario in the matrix brings its replay into view
  useEffect(() => {
    if (selectedParam) arenaRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [selectedParam])

  const rows = run ? matrixRows(run, scenarios) : []
  const selected = rows.find((r) => r.id === selectedParam) || rows[0]
  const cards = run ? scoreboard(run) : []
  const shownRows = filter === 'all' ? rows : rows.filter((r) => r.category === filter)

  return (
    <section className="redteam">
      <div className="control-bar">
        <div>
          <h1>Red-Team Simulator</h1>
          <p className="muted tagline">
            OfficeBot runs every attack and every normal task three times: with no guard, with an allowlist, and with
            the Data-Flow Guard.
          </p>
        </div>
        <div className="controls">
          <button className="run-button" onClick={() => start(mode)} disabled={busy}>
            {busy ? 'Running…' : '▶ Run'}
          </button>
          <ModeToggle mode={mode} setMode={setMode} big />
          <div className="speed" role="group" aria-label="Replay speed">
            {[0.5, 1, 2].map((v) => (
              <button key={v} className={speed === v ? 'speed-opt active' : 'speed-opt'} aria-pressed={speed === v}
                      onClick={() => setSpeed(v)}>{v}×</button>
            ))}
          </div>
          {demo && <span className="demo-tag" title="The backend could not be reached, so this is a saved run from the real backend">demo data</span>}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!run && !error && <p className="loading" role="status"><span className="spinner" aria-hidden="true" />Running the suite…</p>}

      {run && (
        <>
          <div className="scoreboard">
            {cards.map((c) => <ScoreCard key={c.config} card={c} mode={run.mode} />)}
            <ScoreChart cards={cards} />
          </div>

          {/* Keyed by mode and scenario, so a new choice replays from the start */}
          <div ref={arenaRef} className="arena-anchor">
            {selected && <ReplayArena key={`${run.mode}-${selected.id}`} row={selected} speed={speed} />}
          </div>

          <div className="rt-body">
            <div className="matrix-panel">
              <div className="filters" role="group" aria-label="Filter by category">
                <button className={filter === 'all' ? 'filter active' : 'filter'} aria-pressed={filter === 'all'}
                        onClick={() => setFilter('all')}>all ({rows.length})</button>
                {categoryCounts(rows).map(({ category, count }) => (
                  <button key={category} className={filter === category ? 'filter active' : 'filter'}
                          aria-pressed={filter === category} onClick={() => setFilter(category)}>
                    {category} ({count})
                  </button>
                ))}
              </div>
              <table className="matrix">
                <thead>
                  <tr>
                    <th scope="col">Scenario</th>
                    {CONFIGS.map((c) => <th key={c} scope="col">{CONFIG_LABELS[c]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r) => (
                    <tr key={r.id} className={selected && r.id === selected.id ? 'selected' : ''}>
                      <th scope="row">
                        <a href={`#/redteam/${encodeURIComponent(r.id)}`} aria-current={selected && r.id === selected.id ? 'true' : undefined}>
                          <span className={`kind kind-${r.kind}`}>{r.kind === 'attack' ? 'attack' : 'normal'}</span>
                          {r.title}
                        </a>
                      </th>
                      {CONFIGS.map((c) => {
                        const chip = chipFor(r.results[c])
                        return <td key={c}><span className={`chip chip-${chip.tone}`} title={chip.title}>{chip.text}</span></td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected && <ScenarioDetail row={selected} />}
          </div>

          <div className="honest-notes">
            <h2>Honest notes</h2>
            <ul>
              <li>The agent is scripted to always take the bait: the worst case.</li>
              <li>Reply-to-sender is stopped by design: the address comes from an untrusted email.</li>
              {run.mode === 'assist' && (
                <li>Held calls need a human. If the human approves everything, the worst-case number applies.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

function ScoreCard({ card, mode }) {
  const guard = card.config === GUARD_CONFIG
  return (
    <article className={guard ? 'score-card guard' : 'score-card'}>
      <h2>{card.label}</h2>
      <div className="score-line">
        <span className="score-big attack">
          {card.attacksSucceeded}<span className="of"> / {card.attacks}</span>
        </span>
        <span className="score-what">attacks got through</span>
      </div>
      {card.asrIsRange && (
        <p className="score-range" title={ASSIST_RANGE_TIP}>
          up to <strong>{card.attacksWorst} / {card.attacks}</strong> if a human approves every held call ({card.asrText})
        </p>
      )}
      <div className="meter" aria-hidden="true"><span className="meter-attack" style={{ width: pct(card.asrWorst) }} /></div>
      <div className="score-line">
        <span className="score-big benign">{card.benignCompleted}<span className="of"> / {card.benign}</span></span>
        <span className="score-what">normal tasks done</span>
      </div>
      <div className="meter" aria-hidden="true"><span className="meter-benign" style={{ width: pct(card.benignCompletion) }} /></div>
      <p className="score-meta">
        {mode === 'assist' && <>held: attacks {pct(card.escalationAttacks)} · normal {pct(card.escalationBenign)} · </>}
        {card.overhead.calls > 0
          ? <>guard time p50 <code>{card.overhead.p50} ms</code> · p95 <code>{card.overhead.p95} ms</code> ({card.overhead.calls} calls)</>
          : <>no guard checks</>}
      </p>
    </article>
  )
}

function ScenarioDetail({ row }) {
  const result = row.results[GUARD_CONFIG]
  const incidents = incidentsFor(result)
  return (
    <aside className="detail-panel" aria-label="Scenario detail">
      <p className="detail-kicker"><span className={`kind kind-${row.kind}`}>{row.kind === 'attack' ? 'attack' : 'normal task'}</span> {row.category} · <code>{row.id}</code></p>
      <h2>{row.title}</h2>
      {row.userTask && <p className="user-task"><span className="muted">User asked:</span> “{row.userTask}”</p>}
      <div className="detail-chips">
        {CONFIGS.map((c) => {
          const chip = chipFor(row.results[c])
          return <span key={c}><span className="muted">{CONFIG_LABELS[c]}</span> <span className={`chip chip-${chip.tone}`}>{chip.text}</span></span>
        })}
      </div>
      {result && (
        <>
          <h3>Calls with the Data-Flow Guard</h3>
          <ol className="call-list">
            {result.calls.map((call) => {
              const b = outcomeBadge(call.outcome)
              return (
                <li key={call.step}>
                  <span className="muted step-no">step {call.step}</span>
                  <code className="tool">{call.tool}</code>
                  <code className="args">{keyArg(call)}</code>
                  <span className={`badge-out out-${b.tone}`}>{b.text}</span>
                </li>
              )
            })}
          </ol>
        </>
      )}
      {incidents.length > 0 && <h3>Incidents</h3>}
      {incidents.map((inc) => <IncidentCard key={inc.key} incident={inc} />)}
    </aside>
  )
}
