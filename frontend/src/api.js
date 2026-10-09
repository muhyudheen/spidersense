import { checkAudit, errorMessage } from './lib.js'

// All calls go to /api, which the Vite dev server proxies to the backend on 127.0.0.1:8000.
// The mock responses in src/mock/ are used only by the tests (tests/api.test.js).

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
