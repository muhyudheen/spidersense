import { statusPill } from './lib.js'

export default function StatusPill({ audit }) {
  const { tone, text } = statusPill(audit)
  return (
    <div className={`pill pill-${tone}`} role="status" aria-live="polite">
      <span className="pill-dot" aria-hidden="true" />
      {text}
    </div>
  )
}
