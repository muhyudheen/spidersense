// Every route, by hash id. `nav` is the navbar entry it belongs to (Findings sits under ML Audit).
// Pure data, so it can be tested; the components are in pages/index.js.
export const ROUTES = [
  { id: 'overview', nav: 'overview' },
  { id: 'redteam', nav: 'redteam' },
  { id: 'guard', nav: 'guard' },
  { id: 'audit', nav: 'audit' },
  { id: 'findings', nav: 'audit' },
  { id: 'agent', nav: 'agent' },
]

// Navbar entries, in order; each links to the route with the same id.
export const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'redteam', label: 'Red-Team Simulator' },
  { id: 'guard', label: 'Data-Flow Guard' },
  { id: 'audit', label: 'ML Audit' },
  { id: 'agent', label: 'Agent' },
]

export const DEFAULT_ROUTE = 'overview'
