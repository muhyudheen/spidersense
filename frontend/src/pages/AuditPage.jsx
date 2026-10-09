import { useEffect, useState } from 'react'
import { auditDemo, auditUpload, getDemoDatasets } from '../api.js'
import { parseCsvHeader } from '../lib.js'
import AuditTabs from '../AuditTabs.jsx'

const OPTIONAL = [
  { key: 'split_col', label: 'Split column', hint: 'values like train/test' },
  { key: 'group_col', label: 'Group column', hint: 'e.g. customer or route ID' },
  { key: 'time_col', label: 'Time column', hint: 'used from CP2' },
]
const EMPTY_COLUMNS = { target: '', split_col: '', group_col: '', time_col: '' }

export default function AuditPage({ audit, onAudit }) {
  const [demos, setDemos] = useState(null)
  const [demosError, setDemosError] = useState('')
  const [file, setFile] = useState(null)
  const [header, setHeader] = useState([])
  const [columns, setColumns] = useState(EMPTY_COLUMNS)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function loadDemos() {
    setDemosError('')
    getDemoDatasets().then(setDemos, (e) => setDemosError(e.message))
  }
  useEffect(loadDemos, [])

  async function run(call) {
    setBusy(true)
    setError('')
    try {
      onAudit(await call())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function chooseFile(f) {
    setError('')
    setFile(null)
    setHeader([])
    setColumns(EMPTY_COLUMNS)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError(`"${f.name}" is not a .csv file.`)
      return
    }
    // Only the start of the file is read in the browser, to get the header line.
    const names = parseCsvHeader(await f.slice(0, 64 * 1024).text())
    if (names.length === 0) {
      setError(`Could not read column names from the first line of "${f.name}".`)
      return
    }
    setFile(f)
    setHeader(names)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    chooseFile(e.dataTransfer.files[0])
  }

  // A column chosen as the target can't also be the split, group or time column.
  const setColumn = (key) => (e) => {
    const next = { ...columns, [key]: e.target.value }
    if (key === 'target') for (const { key: k } of OPTIONAL) if (next[k] === next.target) next[k] = ''
    setColumns(next)
  }

  return (
    <section>
      <AuditTabs current="audit" audit={audit} />
      <h1>Audit</h1>

      <h2>Demo datasets</h2>
      {demosError && (
        <p className="error">
          Could not load the demo list: {demosError}{' '}
          <button className="retry" onClick={loadDemos}>Retry</button>
        </p>
      )}
      {!demos && !demosError && <p className="muted">Loading demo datasets…</p>}
      {demos && (
        <div className="demo-grid">
          {demos.map((d) => (
            <button key={d.name} className="demo-card" disabled={busy}
                    onClick={() => run(() => auditDemo(d.name))}>
              <span className="demo-title">Load {d.title}</span>
              <span className="muted">{d.description}</span>
              <span className="demo-target">target: <code>{d.target}</code></span>
            </button>
          ))}
        </div>
      )}

      <h2>Upload a CSV</h2>
      <label
        className={dragging ? 'dropzone dragging' : 'dropzone'}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input type="file" accept=".csv,text/csv" disabled={busy}
               onChange={(e) => chooseFile(e.target.files[0])} />
        {file
          ? <span><strong>{file.name}</strong> · {header.length} columns · click or drop to replace</span>
          : <span>Drop one <strong>.csv</strong> file here, or click to choose</span>}
      </label>

      {file && (
        <div className="column-form">
          <label className="field">
            <span>Target column <span className="required">(required)</span></span>
            <select value={columns.target} onChange={setColumn('target')} disabled={busy}>
              <option value="">Choose…</option>
              {header.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {OPTIONAL.map(({ key, label, hint }) => (
            <label className="field" key={key}>
              <span>{label} <span className="muted">(optional, {hint})</span></span>
              <select value={columns[key]} onChange={setColumn(key)} disabled={busy}>
                <option value="">None</option>
                {header.filter((n) => n !== columns.target).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ))}
          <button className="primary" disabled={busy || !columns.target}
                  onClick={() => run(() => auditUpload(file, columns))}>
            Run audit
          </button>
        </div>
      )}

      {busy && <p className="loading" role="status"><span className="spinner" aria-hidden="true" />Spider-sense tingling…</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
