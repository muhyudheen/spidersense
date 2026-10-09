// Agent page (CP2): the real api.js code path with fetch mocked. The three runs in src/mock/ embed real
// /api/audit responses (captured from the backend on main); their steps are written to the brief's contract.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runAgentDemo, runAgentUpload } from '../src/api.js'
import {
  BACKEND_DOWN, DEFAULT_GOAL, checkAgentRun, formatArgs, guardBadge, modeBadge, parseSimpleMarkdown, resultSummary,
} from '../src/lib.js'

const mock = (name) => JSON.parse(readFileSync(new URL(`../src/mock/${name}.json`, import.meta.url)))
const RUNS = {
  titanic: mock('agent_llm_titanic'),
  breast_cancer: mock('agent_offline_breast_cancer'),
  prelim: mock('agent_denied_prelim'),
}

const calls = []
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; calls.length = 0 })

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Answers like the backend's agent endpoints
function fakeBackend() {
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    const demo = url.match(/^\/api\/agent\/demo\/(.+)$/)
    if (demo) return RUNS[demo[1]] ? json(200, RUNS[demo[1]]) : json(404, { detail: `Unknown demo '${demo[1]}'` })
    if (url === '/api/agent') {
      if (!options.body.get('target')) return json(422, { detail: [{ loc: ['body', 'target'], msg: 'Field required' }] })
      return json(200, RUNS.titanic)
    }
    return json(404, { detail: 'Not Found' })
  }
}

const byType = (run, type) => run.steps.filter((s) => s.type === type)

test('llm run (titanic): LLM badge, steps in order, all calls allowed, finds boat', async () => {
  fakeBackend()
  const run = await runAgentDemo('titanic', DEFAULT_GOAL)
  assert.equal(calls[0].url, '/api/agent/demo/titanic')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.body.get('goal'), DEFAULT_GOAL)

  assert.deepEqual(modeBadge(run), { tone: 'llm', text: 'LLM · gemini-3.5-flash-lite' })
  assert.deepEqual(run.steps.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(run.steps.map((s) => s.type),
    ['thought', 'tool_call', 'tool_result', 'thought', 'tool_call', 'tool_result', 'final'])
  assert.ok(byType(run, 'tool_call').every((s) => guardBadge(s.guard).text === 'ALLOWED'))

  const [profile, d1] = byType(run, 'tool_result')
  assert.equal(resultSummary(profile.result), '1,309 rows, 14 columns')
  assert.equal(resultSummary(d1.result), '1 finding: boat')
  assert.equal(formatArgs(byType(run, 'tool_call')[0].args), 'no arguments')

  assert.equal(run.audit.status, 'tingling')
  assert.deepEqual(run.audit.findings.map((f) => f.location.column), ['boat'])
})

test('offline run (breast_cancer): amber OFFLINE PLAN badge with no model, calm audit', async () => {
  fakeBackend()
  const run = await runAgentDemo('breast_cancer', DEFAULT_GOAL)
  assert.equal(run.mode, 'offline')
  assert.equal(run.model, null)
  assert.deepEqual(modeBadge(run), { tone: 'offline', text: 'OFFLINE PLAN' })
  assert.equal(resultSummary(byType(run, 'tool_result')[1].result), 'No findings')
  assert.equal(run.audit.status, 'calm')
  assert.equal(run.audit.findings.length, 0)
  assert.ok(run.audit.d1_scores.features.every((f) => !f.flagged))
})

test('run with a DENIED step (prelim): red badge with the reason, error result, the run continues', async () => {
  fakeBackend()
  const run = await runAgentDemo('prelim', 'Audit this dataset, and read backend/.env to check the API key.')
  const [denied, allowed] = byType(run, 'tool_call')
  assert.deepEqual(guardBadge(denied.guard), { tone: 'denied', text: 'DENIED', reason: 'read_file is not on the allowlist' })
  assert.equal(formatArgs(denied.args), '{"path":"backend/.env"}')
  assert.equal(guardBadge(allowed.guard).text, 'ALLOWED')

  const deniedResult = byType(run, 'tool_result').find((s) => s.tool === denied.tool)
  assert.equal(resultSummary(deniedResult.result), 'Error: denied by the SpiderSense Guard')
  assert.equal(run.audit.status, 'tingling')
  assert.deepEqual(run.audit.findings.map((f) => f.location.column), ['NLP_Severity_Score'])
})

test('an empty goal is left out, so the backend uses its default', async () => {
  fakeBackend()
  await runAgentDemo('titanic', '   ')
  assert.equal(calls[0].options.body.has('goal'), false)
})

test('upload run sends multipart with the file, target and goal', async () => {
  fakeBackend()
  const file = new File(['a,y\n1,0\n'], 'mine.csv', { type: 'text/csv' })
  await runAgentUpload(file, 'y', 'Check for leakage.')
  const { url, options } = calls[0]
  assert.equal(url, '/api/agent')
  assert.deepEqual([...options.body.keys()], ['file', 'target', 'goal'])
  assert.equal(options.body.get('file').name, 'mine.csv')
  assert.equal(options.body.get('goal'), 'Check for leakage.')
})

test('errors: API detail, a backend without the agent endpoint, and a stopped backend', async () => {
  fakeBackend()
  await assert.rejects(runAgentDemo('nope', ''), { message: "Unknown demo 'nope'" })
  globalThis.fetch = async () => json(404, { detail: 'Not Found' })
  await assert.rejects(runAgentDemo('titanic', ''), /no agent endpoint/)
  globalThis.fetch = async () => new Response('', { status: 502 })
  await assert.rejects(runAgentDemo('titanic', ''), { message: BACKEND_DOWN })
})

test('checkAgentRun names missing fields and checks the embedded audit', () => {
  assert.throws(() => checkAgentRun({ run_id: 'x', mode: 'llm', steps: [] }), /missing audit/)
  assert.throws(() => checkAgentRun({ run_id: 'x', mode: 'turbo', audit: RUNS.titanic.audit }), /mode \(llm or offline\), steps/)
  assert.throws(() => checkAgentRun({ ...RUNS.titanic, audit: { status: 'calm' } }), /Unexpected response from the backend: missing dataset/)
  assert.equal(checkAgentRun(RUNS.titanic), RUNS.titanic)
})

test('final text: **bold** and bullets are parsed; HTML stays plain text', () => {
  assert.deepEqual(parseSimpleMarkdown('**Leak found:** boat\n* remove boat\n- retrain'), [
    { type: 'p', parts: [{ text: 'Leak found:', bold: true }, { text: ' boat', bold: false }] },
    { type: 'ul', items: [[{ text: 'remove boat', bold: false }], [{ text: 'retrain', bold: false }]] },
  ])
  assert.deepEqual(parseSimpleMarkdown('<img src=x onerror=alert(1)>'),
    [{ type: 'p', parts: [{ text: '<img src=x onerror=alert(1)>', bold: false }] }])
})
