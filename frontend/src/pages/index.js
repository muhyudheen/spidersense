import AuditPage from './AuditPage.jsx'
import FindingsPage from './FindingsPage.jsx'

// Sidebar entries, in order. A later page (Fix Agent, LeakBench, Report) is one more entry here.
export const PAGES = [
  { id: 'audit', label: 'Audit', component: AuditPage },
  { id: 'findings', label: 'Findings', component: FindingsPage },
]
