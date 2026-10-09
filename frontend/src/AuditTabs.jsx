import { hrefFor } from './router.js'
import StatusPill from './StatusPill.jsx'

// Tabs shared by the two ML Audit pages, with the latest audit's status pill.
export default function AuditTabs({ current, audit }) {
  const tabs = [{ id: 'audit', label: 'Run audit' }, { id: 'findings', label: 'Findings' }]
  return (
    <div className="subnav">
      <nav aria-label="ML Audit">
        {tabs.map((t) => (
          <a key={t.id} href={hrefFor(t.id)} className={t.id === current ? 'subnav-link active' : 'subnav-link'}
             aria-current={t.id === current ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      <StatusPill audit={audit} />
    </div>
  )
}
