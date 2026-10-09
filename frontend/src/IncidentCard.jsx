import { CHECK_LABELS, flowTrace, highlightSpan, outcomeBadge } from './redteam.js'

// One blocked or held call: what, why (large), the evidence, and where the data came from.
export default function IncidentCard({ incident }) {
  const badge = outcomeBadge(incident.outcome)
  const span = incident.evidence[0] ? incident.evidence[0].span : ''
  return (
    <article className={`incident incident-${badge.tone}`}>
      <header className="incident-head">
        <code className="tool">{incident.tool}{incident.arg ? `.${incident.arg}` : ''}</code>
        <span className={`badge-out out-${badge.tone}`}>{badge.text}</span>
        {incident.severity && <span className={`sev sev-${incident.severity}`}>{incident.severity}</span>}
        {incident.check && <span className="check-name">{CHECK_LABELS[incident.check] || incident.check}</span>}
        <span className="muted step-no">step {incident.step}</span>
      </header>
      <p className="incident-reason">{incident.reason}</p>
      {incident.value && (
        <p className="incident-value">
          {highlightSpan(incident.value, span).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
        </p>
      )}
      {incident.evidence.length > 0 && (
        <ul className="evidence-list">
          {incident.evidence.map((e, i) => (
            <li key={i}>
              <span className="ev-k">origin</span> <code>{e.origin}</code>
              <span className="ev-k">match</span> <code>{e.match_type}</code>
              <span className="ev-k">integrity</span>
              <code className={e.integrity === 'untrusted' ? 'untrusted' : ''}>{e.integrity}</code>
            </li>
          ))}
        </ul>
      )}
      <FlowTrace nodes={flowTrace(incident)} />
    </article>
  )
}

// [origin] → [step N] → [tool.arg] → [BLOCKED], as a small SVG chain.
function FlowTrace({ nodes }) {
  const widths = nodes.map((n) => Math.max(70, n.text.length * 8.4 + 20))
  const gap = 26
  const W = widths.reduce((a, b) => a + b, 0) + gap * (nodes.length - 1)
  let x = 0
  return (
    <svg className="flow-trace" viewBox={`0 0 ${W} 34`} width={W} height={34} role="img"
         aria-label={`Flow: ${nodes.map((n) => n.text).join(' → ')}`}>
      {nodes.map((n, i) => {
        const x0 = x
        x += widths[i] + gap
        return (
          <g key={i}>
            <rect className={`ft-node ft-${n.kind} ${n.tone ? `ft-${n.tone}` : ''}`} x={x0} y={3} width={widths[i]} height={28} rx={6} />
            <text className="ft-text" x={x0 + widths[i] / 2} y={17} textAnchor="middle" dominantBaseline="central">{n.text}</text>
            {i < nodes.length - 1 && (
              <path className="ft-arrow" d={`M ${x0 + widths[i] + 4} 17 h ${gap - 10} m -5 -4 l 5 4 l -5 4`} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
