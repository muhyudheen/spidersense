import { useState } from 'react'
import { PAGES } from './pages/index.js'
import StatusPill from './StatusPill.jsx'

export default function App() {
  const [pageId, setPageId] = useState(PAGES[0].id)
  const [audit, setAudit] = useState(null)
  const Page = PAGES.find((p) => p.id === pageId).component

  function onAudit(result) {
    setAudit(result)
    setPageId('findings')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span aria-hidden="true">🕷️</span> SpiderSense
        </div>
        <StatusPill audit={audit} />
      </header>

      <nav className="sidebar" aria-label="Pages">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={p.id === pageId ? 'nav-item active' : 'nav-item'}
            aria-current={p.id === pageId ? 'page' : undefined}
            onClick={() => setPageId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className="main">
        <Page audit={audit} onAudit={onAudit} />
      </main>
    </div>
  )
}
