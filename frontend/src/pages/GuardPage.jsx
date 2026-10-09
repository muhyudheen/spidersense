import { useEffect, useState } from 'react'
import { hrefFor } from '../router.js'
import { ACTION_LABELS, CHECK_LABELS, actionsByCheck, checkCounts, feedIncidents } from '../redteam.js'

// Static explanation of how the Data-Flow Guard decides (checked against backend/dataflow_guard and its
// config/dataflow_guard.json on feat/dataflow-guard-decoding), then the
// live incident feed from the last red-team run.

const CHECKS = [
  { ids: ['canary_leak'], name: 'Canary leak',
    catches: 'A planted fake secret (a canary customer row or API key) appears in anything leaving, even encoded.' },
  { ids: ['hijacked_destination', 'unverified_destination'], name: 'Hijacked / unverified destination',
    catches: 'A recipient, URL, webhook or payee that came only from untrusted content, not from the user; or one nothing trusted vouches for.' },
  { ids: ['injected_command'], name: 'Injected command',
    catches: 'A shell command built from text the agent read in an untrusted page, email or document.' },
  { ids: ['private_leak'], name: 'Private data leak',
    catches: 'Private data (customer records, internal files) heading to a destination that trusted content does not back.' },
  { ids: ['secret_pattern'], name: 'Secret pattern',
    catches: 'Things that look like secrets in outgoing data: API keys, AWS keys, JWTs, private keys, Aadhaar and PAN numbers.' },
]

export default function GuardPage({ mode, redteam }) {
  const { runs, busy, error, start } = redteam
  const current = runs[mode]
  const [filter, setFilter] = useState('all')
  useEffect(() => { if (!runs[mode]) start(mode) }, [mode])

  const feed = current ? feedIncidents(current.run) : []
  const counts = checkCounts(feed)
  const seen = actionsByCheck(feed)
  const shown = filter === 'all' ? feed : feed.filter((f) => f.check === filter)

  return (
    <section className="guard-page">
      <h1>Data-Flow Guard</h1>
      <p className="hero-sub">
        The allowlist asks <em>“may the agent use this tool?”</em>. The Data-Flow Guard asks
        <em> “where did each argument come from, and where is the data going?”</em>, before every tool call.
      </p>

      <h2>How it decides</h2>
      <div className="labels-grid">
        <article className="explain">
          <h3>Label 1: can it be trusted?</h3>
          <p><span className="tag tag-green">trusted</span> the user's own request, the contact list, the customer database.</p>
          <p><span className="tag tag-red">untrusted</span> web pages, inbox emails, documents and files, the scratchpad: anything an attacker could have written into.</p>
        </article>
        <article className="explain">
          <h3>Label 2: is it private?</h3>
          <p><span className="tag tag-amber">private</span> the customer database, contacts, the inbox, internal documents and files, planted canaries.</p>
          <p><span className="tag tag-grey">public</span> pages fetched from the web.</p>
        </article>
        <article className="explain">
          <h3>Where data can leave: sinks</h3>
          <ul className="sinks">
            <li><strong>destination</strong> email recipients, URLs, webhooks, phone numbers</li>
            <li><strong>financial</strong> payee UPI IDs, account numbers</li>
            <li><strong>command</strong> shell commands, code to run</li>
            <li><strong>outbound content</strong> email bodies, messages, data in a URL</li>
          </ul>
        </article>
      </div>

      <h3 className="sub-h">The five checks</h3>
      <div className="checks-grid">
        {CHECKS.map((c) => {
          const did = c.ids.flatMap((id) => Object.entries(seen[id] || {}))
          return (
            <article key={c.name} className="check-card">
              <h4>{c.name}</h4>
              <p>{c.catches}</p>
              <p className="check-seen">
                {current
                  ? did.length
                    ? <>In the last {mode} run: {did.map(([a, n]) => <span key={a} className={`act act-${a}`}>{n} × {ACTION_LABELS[a] || a}</span>)}</>
                    : <>In the last {mode} run: not triggered</>
                  : 'Run the simulator to see what it did'}
              </p>
            </article>
          )
        })}
      </div>

      <div className="facts">
        <p><strong>Strictest wins:</strong> <span className="act act-block">BLOCK</span> &gt; <span className="act act-escalate">HOLD FOR HUMAN</span> &gt; <span className="act act-warn">WARN</span> &gt; <span className="act act-allow">ALLOW</span>. In assist mode, calls it would block outright on a hijacked destination or a private leak are held for a human instead.</p>
        <p><strong>Tricks it undoes:</strong> base64, hex, URL encoding, invisible (zero-width) characters, look-alike letters (Cyrillic or Greek letters that look Latin).</p>
        <p><strong>No AI inside the guard:</strong> fixed rules, so the same input always gets the same decision.</p>
      </div>

      <div className="feed-head">
        <h2>Live incident feed</h2>
        <span className="muted">every finding from the last {mode} run, newest step first</span>
        {current && current.demo && <span className="demo-tag" title="The backend could not be reached, so this is a saved run from the real backend">demo data</span>}
        <button className="run-button small" onClick={() => start(mode)} disabled={busy}>{busy ? 'Running…' : '▶ Run again'}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!current && !error && <p className="loading" role="status"><span className="spinner" aria-hidden="true" />Running the suite…</p>}
      {current && (
        <>
          <div className="filters" role="group" aria-label="Filter by check">
            <button className={filter === 'all' ? 'filter active' : 'filter'} aria-pressed={filter === 'all'}
                    onClick={() => setFilter('all')}>all ({feed.length})</button>
            {counts.map(({ check, count }) => (
              <button key={check} className={filter === check ? 'filter active' : 'filter'} aria-pressed={filter === check}
                      onClick={() => setFilter(check)}>{CHECK_LABELS[check] || check} ({count})</button>
            ))}
          </div>
          <ul className="feed">
            {shown.map((f) => (
              <li key={f.key}>
                <a className={`feed-card act-border-${f.action}`} href={hrefFor(`redteam/${encodeURIComponent(f.scenario)}`)}>
                  <span className="feed-top">
                    <span className={`act act-${f.action}`}>{ACTION_LABELS[f.action] || f.action}</span>
                    <span className="check-name">{CHECK_LABELS[f.check] || f.check}</span>
                    <code className="tool">{f.tool}{f.arg ? `.${f.arg}` : ''}</code>
                    <span className="muted step-no">step {f.step}</span>
                  </span>
                  <span className="feed-reason">{f.reason}</span>
                  <span className="feed-scn"><span className={`kind kind-${f.kind}`}>{f.kind === 'attack' ? 'attack' : 'normal'}</span> {f.title} →</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
