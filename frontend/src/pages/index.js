import AgentPage from './AgentPage.jsx'
import AuditPage from './AuditPage.jsx'
import FindingsPage from './FindingsPage.jsx'
import RedTeamPage from './RedTeamPage.jsx'

// The page component for each route id in ../routes.js
export const PAGE_COMPONENTS = {
  redteam: RedTeamPage,
  audit: AuditPage,
  findings: FindingsPage,
  agent: AgentPage,
}
