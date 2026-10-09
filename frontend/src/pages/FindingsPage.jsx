export default function FindingsPage({ audit }) {
  return (
    <section>
      <h1>Findings</h1>
      {audit
        ? <p className="muted">Audit of <strong>{audit.dataset.name}</strong> loaded. The findings list is the next step.</p>
        : <p className="muted">No audit yet. Run one from the Audit page.</p>}
    </section>
  )
}
