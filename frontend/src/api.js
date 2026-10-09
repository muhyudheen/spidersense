import { checkAgentRun, checkAudit, errorMessage } from './lib.js'

// All calls go to /api, which the Vite dev server proxies to the backend on 127.0.0.1:8000.
// The mock responses in src/mock/ are used only by the tests (tests/api.test.js).

// Errors carry the HTTP status (0 when the backend could not be reached), so callers can tell cases apart.
async function request(path, options) {
  let res
  try {
    res = await fetch(`/api${path}`, options)
  } catch (e) {
    if (e && e.name === 'TimeoutError') throw Object.assign(new Error(AGENT_TIMEOUT_MESSAGE), { status: 0 })
    throw Object.assign(new Error(errorMessage(0, null)), { status: 0 })
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(errorMessage(res.status, body)), { status: res.status })
  return body
}

export function getDemoDatasets() {
  return request('/demo-datasets')
}

export async function auditDemo(name) {
  return checkAudit(await request(`/audit/demo/${encodeURIComponent(name)}`, { method: 'POST' }))
}

// columns: {target, split_col, group_col, time_col}; empty optional columns are left out of the form.
export async function auditUpload(file, columns) {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(columns)) {
    if (value) form.append(key, value)
  }
  return checkAudit(await request('/audit', { method: 'POST', body: form }))
}

// ---- Agent (CP2) ----

// An LLM run takes about 5–40 s; past 2 minutes something is stuck, so the page stops waiting.
const AGENT_TIMEOUT_MS = 120_000
const AGENT_TIMEOUT_MESSAGE = 'The agent run took more than 2 minutes, so the dashboard stopped waiting. Try again.'

async function agentRequest(path, form) {
  try {
    const body = await request(path, { method: 'POST', body: form, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) })
    return checkAgentRun(body)
  } catch (e) {
    // FastAPI's plain 404 means the backend running has no agent endpoint yet
    if (e.status === 404 && e.message === 'Not Found') {
      throw new Error('The backend has no agent endpoint (POST /api/agent…). Update backend/ to the latest main and restart it.')
    }
    throw e
  }
}

// An empty goal is left out, so the backend uses its default.
export function runAgentDemo(name, goal) {
  const form = new FormData()
  if (goal && goal.trim()) form.append('goal', goal.trim())
  return agentRequest(`/agent/demo/${encodeURIComponent(name)}`, form)
}

export function runAgentUpload(file, target, goal) {
  const form = new FormData()
  form.append('file', file)
  form.append('target', target)
  if (goal && goal.trim()) form.append('goal', goal.trim())
  return agentRequest('/agent', form)
}
