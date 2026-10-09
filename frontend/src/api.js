import { errorMessage } from './lib.js'
import mockPrelim from './mock/audit_prelim.json'
import mockCalm from './mock/audit_calm.json'
import mockDemos from './mock/demo_datasets.json'

// Until the backend is up (14:15 IST) the dashboard runs on the mock responses from FRONTEND_BRIEF.md.
const USE_MOCK = true

async function request(path, options) {
  let res
  try {
    res = await fetch(`/api${path}`, options)
  } catch {
    throw new Error(errorMessage(0, null))
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(errorMessage(res.status, body))
  return body
}

const mockDelay = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 600))

export function getDemoDatasets() {
  if (USE_MOCK) return mockDelay(mockDemos)
  return request('/demo-datasets')
}

export function auditDemo(name) {
  if (USE_MOCK) return mockDelay(name === 'clean' ? mockCalm : mockPrelim)
  return request(`/audit/demo/${encodeURIComponent(name)}`, { method: 'POST' })
}

// columns: {target, split_col, group_col, time_col}; empty optional columns are left out of the form.
export function auditUpload(file, columns) {
  if (USE_MOCK) return mockDelay(mockPrelim)
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(columns)) {
    if (value) form.append(key, value)
  }
  return request('/audit', { method: 'POST', body: form })
}
