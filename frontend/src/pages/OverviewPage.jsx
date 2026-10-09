import { hrefFor } from '../router.js'
import { overviewKpis } from '../redteam.js'
import { useCountUp } from '../useCountUp.js'

const STEPS = [
  { icon: '📖', title: 'Read', text: 'The agent reads a web page, an email or a document.' },
  { icon: '🏷️', title: 'Label', text: 'Everything it read is labelled: trusted or untrusted, private or public.' },
  { icon: '🔍', title: 'Check', text: 'Before each tool call: where did this argument come from, and where is the data going?' },
  { icon: '⛔', title: 'Block', text: "The attacker's address never leaves. Normal work goes through." },
]

const FEATURES = [
  { id: 'redteam', icon: '🎯', title: 'Red-Team Simulator',
    text: 'Attacks and normal tasks, each run with no guard, an allowlist, and the Data-Flow Guard. Watch every call replay.' },
  { id: 'audit', icon: '🧪', title: 'ML Audit',
    text: 'Catches models that cheat: target leakage (D1) and leaked personal data (D9), plus an agent that audits for you.' },
]

export default function OverviewPage({ mode, redteam }) {
  const { runs, busy, error, start } = redteam
  const current = runs[mode]
  const tiles = current ? overviewKpis(current.run) : null

  return (
    <section className="overview">
      <div className="hero">
        <h1>Your AI agent can be tricked. <span className="hero-accent">SpiderSense stops the data from leaving.</span></h1>
        <p className="hero-sub">
          A hidden line in a web page tells the agent to email your customer list out. An allowlist lets it through,
          because email is an allowed tool. The Data-Flow Guard asks where the address came from, and blocks it.
        </p>
        <div className="hero-actions">
          <button className="run-button" onClick={() => start(mode)} disabled={busy}>
            {busy ? 'Running…' : '▶ Run the simulator'}
          </button>
          <span className="muted">mode: <strong className={`mode-word mode-${mode}`}>{mode}</strong></span>
          {current && current.demo && <span className="demo-tag" title="The backend could not be reached, so this is a saved run from the real backend">demo data</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <div className="kpis" aria-live="polite">
        {tiles
          ? tiles.map((t) => <KpiTile key={`${mode}-${t.id}`} tile={t} />)
          : ['Allowlist only', 'With Data-Flow Guard', 'Normal work completed', "Guard's median time per call"].map((label) => (
            <article key={label} className="kpi kpi-empty">
              <p className="kpi-label">{label}</p>
              <p className="kpi-value">—</p>
              <p className="kpi-unit">Run the simulator</p>
            </article>
          ))}
      </div>
      {tiles && (
        <p className="kpi-link"><a href={hrefFor('redteam')}>See every attack replayed on the Red-Team Simulator →</a></p>
      )}

      <h2>How it works</h2>
      <ol className="how">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="how-icon" aria-hidden="true">{s.icon}</span>
            <strong>{i + 1}. {s.title}</strong>
            <span className="muted">{s.text}</span>
          </li>
        ))}
      </ol>

      <div className="features">
        {FEATURES.map((f) => (
          <a key={f.id} className="feature" href={hrefFor(f.id)}>
            <span className="feature-icon" aria-hidden="true">{f.icon}</span>
            <strong>{f.title} →</strong>
            <span className="muted">{f.text}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function KpiTile({ tile }) {
  const value = useCountUp(tile.value, tile.decimals || 0)
  return (
    <article className={`kpi kpi-${tile.tone}`}>
      <p className="kpi-label">{tile.label}</p>
      <p className="kpi-value">
        {tile.decimals ? value.toFixed(tile.decimals) : value}
        {tile.of != null && <span className="kpi-of"> / {tile.of}</span>}
      </p>
      <p className="kpi-unit">{tile.unit}</p>
      {tile.upTo != null && (
        <p className="kpi-note" title="best = a human rejects every held call; worst = a human approves every held call">
          up to {tile.upTo} / {tile.of} if a human approves every held call
        </p>
      )}
    </article>
  )
}
