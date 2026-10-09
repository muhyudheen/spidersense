import { checkAudit, errorMessage } from './lib.js'
import mockPrelim from './mock/audit_prelim.json'
import mockCalm from './mock/audit_calm.json'
import mockDemos from './mock/demo_datasets.json'

// The dashboard talks to the real backend. For frontend work without a backend, start it with
// `VITE_USE_MOCK=1 npm run dev`: the mock responses from FRONTEND_BRIEF.md are used and the page says so.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

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

export async function auditDemo(name) {
  if (USE_MOCK) return mockDelay(name === 'breast_cancer' ? mockCalm : mockPrelim)
  return checkAudit(await request(`/audit/demo/${encodeURIComponent(name)}`, { method: 'POST' }))
}

// columns: {target, split_col, group_col, time_col}; empty optional columns are left out of the form.
export async function auditUpload(file, columns) {
  if (USE_MOCK) return mockDelay(mockPrelim)
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(columns)) {
    if (value) form.append(key, value)
  }
  return checkAudit(await request('/audit', { method: 'POST', body: form }))
}
