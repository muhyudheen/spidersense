import { useEffect, useRef, useState } from 'react'
import { getDemoDatasets, runAgentDemo, runAgentUpload } from '../api.js'
import {
  DEFAULT_GOAL, formatArgs, guardBadge, modeBadge, parseCsvHeader, parseSimpleMarkdown, resultSummary,
} from '../lib.js'
import StatusPill from '../StatusPill.jsx'
import { AuditView } from './FindingsPage.jsx'

const STEP_DELAY_MS = 300 // trace rows appear one after another once the response arrives

export default function AgentPage({ setAudit }) {
  const [demos, setDemos] = useState(null)
  const [demosError, setDemosError] = useState('')
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [file, setFile] = useState(null)
  const [header, setHeader] = useState([])
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [run, setRun] = useState(null)
  const [duration, setDuration] = useState(null)
  const [shown, setShown] = useState(0)

  function loadDemos() {
    setDemosError('')
    getDemoDatasets().then(setDemos, (e) => setDemosError(e.message))
  }
  useEffect(loadDemos, [])

  // Elapsed seconds while the agent runs, so a 40 s wait doesn't look frozen
  useEffect(() => {
    if (!busy) return
    const t0 = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200)
    return () => clearInterval(id)
  }, [busy])

  // Reveal the trace one step at a time (all at once if the viewer prefers reduced motion)
  useEffect(() => {
    if (!run || shown >= run.steps.length) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(run.steps.length); return }
    const id = setTimeout(() => setShown((n) => n + 1), STEP_DELAY_MS)
    return () => clearTimeout(id)
  }, [run, shown])

  async function start(call) {
    setBusy(true)
    setError('')
    setRun(null)
    setShown(0)
    const t0 = Date.now()
    try {
      const result = await call()
      setDuration((Date.now() - t0) / 1000)
      setRun(result)
      setAudit(result.audit)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function chooseFile(f) {
    setError('')
    setFile(null)
    setHeader([])
    setTarget('')
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError(`"${f.name}" is not a .csv file.`)
      return
    }
    const names = parseCsvHeader(await f.slice(0, 64 * 1024).text())
    if (names.length === 0) {
      setError(`Could not read column names from the first line of "${f.name}".`)
      return
    }
    setFile(f)
    setHeader(names)
  }

  const done = run && shown >= run.steps.length

  return (
    <section>
      <h1>Agent</h1>
      <p className="muted intro">
        The agent decides which checks to call and why; the checks decide what is a finding.
        Every tool call goes through the SpiderSense Guard.
      </p>

      <label className="field goal">
        <span>Goal</span>
        <textarea rows={2} value={goal} disabled={busy} onChange={(e) => setGoal(e.target.value)} />
      </label>

      <h2>Run on a demo dataset</h2>
      {demosError && (
        <p className="error">
          Could not load the demo list: {demosError}{' '}
          <button className="retry" onClick={loadDemos}>Retry</button>
        </p>
      )}
      {!demos && !demosError && <p className="muted">Loading demo datasets…</p>}
      {demos && (
        <div className="demo-grid">
          {demos.map((d) => (
            <button key={d.name} className="demo-card" disabled={busy}
                    onClick={() => start(() => runAgentDemo(d.name, goal))}>
              <span className="demo-title">Run agent on {d.title}</span>
              <span className="demo-target">target: <code>{d.target}</code></span>
            </button>
          ))}
        </div>
      )}

      <h2>Or upload a CSV</h2>
      <div className="agent-upload">
        <label className="dropzone">
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => chooseFile(e.target.files[0])} />
          {file
            ? <span><strong>{file.name}</strong> · {header.length} columns · click to replace</span>
            : <span>Choose one <strong>.csv</strong> file</span>}
        </label>
        {file && (
          <>
            <label className="field">
              <span>Target column <span className="required">(required)</span></span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                <option value="">Choose…</option>
                {header.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="primary" disabled={busy || !target}
                    onClick={() => start(() => runAgentUpload(file, target, goal))}>
              Run agent
            </button>
          </>
        )}
      </div>

      {busy && (
        <div className="loading agent-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          SpiderSense agent is thinking… <span className="elapsed">{elapsed.toFixed(0)} s</span>
          <span className="muted hint">An LLM run takes about 5–40 s; the offline plan about 3 s.</span>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {run && <Trace run={run} shown={shown} duration={duration} />}

      {done && (
        <div className="agent-audit">
          <div className="agent-audit-head">
            <h2>Audit result</h2>
            <StatusPill audit={run.audit} />
          </div>
          <AuditView audit={run.audit} />
        </div>
      )}
    </section>
  )
}

function Trace({ run, shown, duration }) {
  const mode = modeBadge(run)
  const calls = run.steps.filter((s) => s.type === 'tool_call')
  const denied = calls.filter((s) => guardBadge(s.guard).tone === 'denied').length
  const lastRef = useRef(null)

  // Keep the newest step in view while the trace plays
  useEffect(() => { lastRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [shown])

  return (
    <div className="trace-wrap">
      <div className="trace-head">
        <span className={`mode mode-${mode.tone}`}>{mode.text}</span>
        <span className="muted">run <code>{run.run_id}</code></span>
        <span className="muted">{run.steps.length} steps · {calls.length} tool call{calls.length === 1 ? '' : 's'}</span>
        {denied > 0 && <span className="denied-count">{denied} denied by the guard</span>}
        {duration != null && <span className="muted">{duration.toFixed(1)} s</span>}
      </div>
      {run.goal && <p className="trace-goal">Goal: “{run.goal}”</p>}
      <ol className="trace">
        {run.steps.slice(0, shown).map((step, i) => (
          <TraceStep key={step.n ?? i} step={step} ref={i === shown - 1 ? lastRef : null} />
        ))}
      </ol>
    </div>
  )
}

function TraceStep({ step, ref }) {
  const n = <span className="step-n" aria-hidden="true">{step.n}</span>

  if (step.type === 'thought') {
    return <li ref={ref} className="step step-thought">{n}<p><span aria-hidden="true">💭 </span><em>{step.text}</em></p></li>
  }
  if (step.type === 'tool_call') {
    const badge = guardBadge(step.guard)
    return (
      <li ref={ref} className={`step step-call step-${badge.tone}`}>
        {n}
        <div className="call">
          <span aria-hidden="true">🔧</span>
          <code className="tool">{step.tool}</code>
          <code className="args">{formatArgs(step.args)}</code>
          <span className={`guard guard-${badge.tone}`} title={badge.reason}>{badge.text}</span>
          {badge.tone === 'denied' && badge.reason && <span className="guard-reason">{badge.reason}</span>}
        </div>
      </li>
    )
  }
  if (step.type === 'tool_result') return <ResultStep step={step} n={n} ref={ref} />
  if (step.type === 'final') {
    return <li ref={ref} className="step step-final">{n}<div className="final-box"><FinalText text={step.text} /></div></li>
  }
  // A step type this dashboard doesn't know yet: show it raw rather than hide it
  return <li ref={ref} className="step">{n}<pre className="result-json">{JSON.stringify(step, null, 2)}</pre></li>
}

function ResultStep({ step, n, ref }) {
  const [open, setOpen] = useState(false)
  const isError = Boolean(step.result && step.result.error)
  return (
    <li ref={ref} className={isError ? 'step step-result step-error' : 'step step-result'}>
      {n}
      <div className="result">
        <button className="result-head" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <code className="tool">{step.tool}</code>
          <span>→ {resultSummary(step.result)}</span>
        </button>
        {open && <pre className="result-json">{JSON.stringify(step.result, null, 2)}</pre>}
      </div>
    </li>
  )
}

// LLM output: rendered from parsed data as React text, never as HTML.
function FinalText({ text }) {
  const parts = (ps) => ps.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))
  return parseSimpleMarkdown(text).map((b, i) => (b.type === 'ul'
    ? <ul key={i}>{b.items.map((item, j) => <li key={j}>{parts(item)}</li>)}</ul>
    : <p key={i}>{parts(b.parts)}</p>))
}
