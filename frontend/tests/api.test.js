// The real api.js code path with fetch mocked: each test answers with a mock response shaped like
// the real backend's (src/mock/), the way the Vite proxy would pass it on.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { auditDemo, auditUpload, getDemoDatasets } from '../src/api.js'
import { BACKEND_DOWN, chartTitle, d1Bars, readableKey } from '../src/lib.js'

const mock = (name) => JSON.parse(readFileSync(new URL(`../src/mock/${name}.json`, import.meta.url)))
const DEMO_RESPONSES = { prelim: mock('audit_prelim'), titanic: mock('audit_titanic'), breast_cancer: mock('audit_calm') }

const calls = []
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; calls.length = 0 })

// Answers like the backend: the demo list, a demo audit by name, an upload, or {"detail": ...} errors.
function fakeBackend() {
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url === '/api/demo-datasets') return json(200, mock('demo_datasets'))
    const demo = url.match(/^\/api\/audit\/demo\/(.+)$/)
    if (demo) return DEMO_RESPONSES[demo[1]] ? json(200, DEMO_RESPONSES[demo[1]]) : json(404, { detail: `Unknown demo '${demo[1]}'` })
    if (url === '/api/audit') {
      const target = options.body.get('target')
      if (target === 'id') return json(400, { detail: "Target column 'id' has a different value on every row" })
      return json(200, { ...mock('audit_prelim'), dataset: { ...mock('audit_prelim').dataset, name: options.body.get('file').name, target } })
    }
    return json(404, { detail: 'Not Found' })
  }
}

test('the demo buttons come from GET /api/demo-datasets', async () => {
  fakeBackend()
  const demos = await getDemoDatasets()
  assert.equal(calls[0].url, '/api/demo-datasets')
  assert.deepEqual(demos.map((d) => d.name), ['prelim', 'titanic', 'breast_cancer'])
})

test('prelim: tingling, 1 HIGH finding on NLP_Severity_Score', async () => {
  fakeBackend()
  const audit = await auditDemo('prelim')
  assert.equal(calls[0].url, '/api/audit/demo/prelim')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(audit.status, 'tingling')
  assert.deepEqual(audit.findings.map((f) => [f.severity, f.location.column]), [['high', 'NLP_Severity_Score']])
  assert.equal(chartTitle(audit.d1_scores.metric), 'Skill lost when scrambled (R²)')
})

test('titanic: tingling, 1 HIGH finding on boat; boat is the only flagged bar, at the top', async () => {
  fakeBackend()
  const audit = await auditDemo('titanic')
  assert.equal(audit.status, 'tingling')
  assert.deepEqual(audit.findings.map((f) => [f.severity, f.location.column]), [['high', 'boat']])
  const bars = d1Bars(audit.d1_scores)
  assert.deepEqual([bars[0].name, bars[0].score, bars[0].flagged], ['boat', 0.71, true])
  assert.ok(bars.slice(1).every((b) => !b.flagged && b.score <= 0.01))
  assert.equal(audit.d1_scores.threshold, 0.2)
  assert.equal(chartTitle(audit.d1_scores.metric), 'Skill lost when scrambled (AUC)')
})

test('breast_cancer: calm, no findings, chart still present with no flagged bars', async () => {
  fakeBackend()
  const audit = await auditDemo('breast_cancer')
  assert.equal(audit.status, 'calm')
  assert.equal(audit.findings.length, 0)
  assert.ok(audit.d1_scores.features.every((f) => !f.flagged))
})

test('D1 evidence keys show as readable labels', async () => {
  fakeBackend()
  const [finding] = (await auditDemo('prelim')).findings
  assert.deepEqual(Object.keys(finding.evidence).map(readableKey), [
    'Metric', 'Skill with all columns', 'Skill lost without column', 'Skill lost when scrambled', 'Threshold',
  ])
})

test('upload sends multipart with the file, target and only the chosen optional columns', async () => {
  fakeBackend()
  const file = new File(['a,b,y\n1,2,3\n'], 'mine.csv', { type: 'text/csv' })
  const audit = await auditUpload(file, { target: 'y', split_col: 'a', group_col: '', time_col: '' })
  const { url, options } = calls[0]
  assert.equal(url, '/api/audit')
  assert.equal(options.method, 'POST')
  assert.deepEqual([...options.body.keys()], ['file', 'target', 'split_col'])
  assert.equal(options.body.get('file').name, 'mine.csv')
  assert.equal(audit.dataset.name, 'mine.csv')
})

test("an API error shows the backend's detail message", async () => {
  fakeBackend()
  const file = new File(['id,y\n1,2\n'], 'bad.csv')
  await assert.rejects(auditUpload(file, { target: 'id' }), { message: "Target column 'id' has a different value on every row" })
  await assert.rejects(auditDemo('nope'), { message: "Unknown demo 'nope'" })
})

test('backend not running: the start command is shown (network error, or 502 from the Vite proxy)', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }
  await assert.rejects(getDemoDatasets(), { message: BACKEND_DOWN })
  globalThis.fetch = async () => new Response('', { status: 502 })
  await assert.rejects(auditDemo('prelim'), { message: BACKEND_DOWN })
  assert.equal(BACKEND_DOWN, 'Backend not reachable: start it with uv run uvicorn main:app --port 8000 in backend/')
})

test('a response missing fields the dashboard reads is reported, not rendered blank', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'tingling' }), { status: 200 })
  await assert.rejects(auditDemo('prelim'), /Unexpected response from the backend: missing dataset/)
})
