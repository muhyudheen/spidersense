import { useState } from 'react'
import D1Chart from '../D1Chart.jsx'
import { SEVERITY_ORDER, evidenceValue, readableKey, sortFindings } from '../lib.js'

export default function FindingsPage({ audit }) {
  if (!audit) {
    return (
      <section>
        <h1>Findings</h1>
        <p className="muted">No audit yet. Run one from the Audit page.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>Findings</h1>
      <AuditView audit={audit} />
    </section>
  )
}

// Summary line, D1 chart and finding cards for one audit response. Also used by the Agent page.
export function AuditView({ audit }) {
  const { dataset, counts } = audit
  return (
    <>
      <p className="summary">
        <strong>{dataset.name}</strong>
        <span>{dataset.rows.toLocaleString('en-IN')} rows</span>
        <span>target <code>{dataset.target}</code></span>
        <span>{dataset.task}</span>
        {SEVERITY_ORDER.map((s) => (
          <span key={s} className={`count count-${s}`}>{counts[s] ?? 0} {s}</span>
        ))}
      </p>

      {/* The chart is the demo's main visual, so it comes before the list and is visible without scrolling */}
      {audit.d1_scores && <D1Chart d1={audit.d1_scores} />}

      {/* Keyed by audit, so a new audit starts with every card closed */}
      <FindingList key={audit.audit_id} findings={audit.findings} />
    </>
  )
}

function FindingList({ findings }) {
  const [openId, setOpenId] = useState(null)
  if (findings.length === 0) return <p className="no-findings">No findings for this dataset.</p>

  return (
    <ul className="findings">
      {sortFindings(findings).map((f) => {
        const open = f.id === openId
        return (
          <li key={f.id} className={`finding finding-${f.severity}`}>
            <button className="finding-head" aria-expanded={open} onClick={() => setOpenId(open ? null : f.id)}>
              <span className={`badge badge-${f.severity}`}>{f.severity}</span>
              <code className="check-id">{f.check}</code>
              <span className="finding-title">{f.title}</span>
              <span className="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
            <p className="finding-summary">{f.summary}</p>
            {f.location && Object.keys(f.location).length > 0 && (
              <p className="finding-location">
                {Object.entries(f.location).map(([k, v]) => (
                  <span key={k}>{k} <code>{evidenceValue(v)}</code></span>
                ))}
              </p>
            )}
            {open && <FindingDetail finding={f} />}
          </li>
        )
      })}
    </ul>
  )
}

function FindingDetail({ finding }) {
  const evidence = Object.entries(finding.evidence ?? {})
  return (
    <div className="finding-detail">
      <h3>Evidence</h3>
      {evidence.length === 0
        ? <p className="muted">No evidence fields in this finding.</p>
        : (
          <table className="evidence">
            <tbody>
              {evidence.map(([k, v]) => (
                <tr key={k}><th scope="row">{readableKey(k)}</th><td><code>{evidenceValue(v)}</code></td></tr>
              ))}
            </tbody>
          </table>
        )}
      {finding.fix && (
        <>
          <h3>Suggested fix</h3>
          <p className="fix">{finding.fix}</p>
        </>
      )}
    </div>
  )
}
