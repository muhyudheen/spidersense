import AgentPage from './AgentPage.jsx'
import AuditPage from './AuditPage.jsx'
import FindingsPage from './FindingsPage.jsx'
import GuardPage from './GuardPage.jsx'
import OverviewPage from './OverviewPage.jsx'
import RedTeamPage from './RedTeamPage.jsx'

// The page component for each route id in ../routes.js
export const PAGE_COMPONENTS = {
  overview: OverviewPage,
  redteam: RedTeamPage,
  guard: GuardPage,
  audit: AuditPage,
  findings: FindingsPage,
  agent: AgentPage,
}
