// Every route, by hash id. `nav` is the navbar entry it belongs to (Findings sits under ML Audit).
// Pure data, so it can be tested; the components are in pages/index.js.
export const ROUTES = [
  { id: 'audit', nav: 'audit' },
  { id: 'findings', nav: 'audit' },
  { id: 'agent', nav: 'agent' },
]

// Navbar entries, in order; each links to the route with the same id.
export const NAV = [
  { id: 'audit', label: 'ML Audit' },
  { id: 'agent', label: 'Agent' },
]

export const DEFAULT_ROUTE = 'audit'
