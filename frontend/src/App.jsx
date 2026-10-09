import { useState } from 'react'
import { PAGE_COMPONENTS } from './pages/index.js'
import { DEFAULT_ROUTE, NAV, ROUTES } from './routes.js'
import { hrefFor, navigate, useHashRoute } from './router.js'
import { useHealth } from './useHealth.js'
import ModeToggle from './ModeToggle.jsx'

const ROUTE_IDS = ROUTES.map((r) => r.id)

export default function App() {
  const routeId = useHashRoute(ROUTE_IDS, DEFAULT_ROUTE)
  const route = ROUTES.find((r) => r.id === routeId)
  const health = useHealth()
  const [audit, setAudit] = useState(null)
  // The Data-Flow Guard's mode, shared by the Red-Team and Guard pages
  const [mode, setMode] = useState('strict')
  const [menuOpen, setMenuOpen] = useState(false)
  const Page = PAGE_COMPONENTS[route.id]

  function onAudit(result) {
    setAudit(result)
    navigate('findings')
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href={hrefFor(NAV[0].id)}><span aria-hidden="true">🕷️</span> SpiderSense</a>
        <button className="menu-button" aria-expanded={menuOpen} aria-controls="nav-links"
                onClick={() => setMenuOpen(!menuOpen)}>
          Menu
        </button>
        <nav id="nav-links" className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Pages">
          {NAV.map((n) => (
            <a key={n.id} href={hrefFor(n.id)} onClick={() => setMenuOpen(false)}
               className={route.nav === n.id ? 'nav-link active' : 'nav-link'}
               aria-current={route.nav === n.id ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav-status">
          <span className={`health health-${health}`} role="status">
            <span className="health-dot" aria-hidden="true" />
            {health === 'online' ? 'API online' : health === 'offline' ? 'API offline' : 'API…'}
          </span>
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </header>

      <main className="main">
        {/* onAudit shows the result on Findings; setAudit only updates it (the Agent page shows its own) */}
        <Page audit={audit} onAudit={onAudit} setAudit={setAudit} mode={mode} setMode={setMode} health={health} />
      </main>
    </div>
  )
}
