// Pure helpers (no React), so they can be tested with `node --test`.

// Column names from a CSV header line. Handles quoted names ("a,b"), doubled quotes ("say ""hi""") and a BOM.
export function parseCsvHeader(text) {
  const line = text.replace(/^﻿/, '').split(/\r?\n/)[0]
  const names = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { names.push(cur.trim()); cur = '' }
    else cur += ch
  }
  names.push(cur.trim())
  return names.filter((n) => n !== '')
}

// The message to show for a failed API call. FastAPI sends {"detail": "..."}, or a list of
// {loc, msg} objects for a 422 validation error.
export function errorMessage(status, body) {
  const detail = body && body.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => (d.loc ? `${d.loc.filter((x) => x !== 'body').join('.')}: ${d.msg}` : d.msg)).join('; ')
  }
  // Through the Vite proxy a stopped backend shows up as a 5xx without a JSON body
  if (status >= 500) return `Request failed (HTTP ${status}). Is the backend running on port 8000?`
  return status ? `Request failed (HTTP ${status})` : 'Could not reach the backend'
}

// The header pill: grey before any audit, red when tingling, green when calm.
export function statusPill(audit) {
  if (!audit) return { tone: 'none', text: 'No audit yet' }
  if (audit.status === 'tingling') {
    const n = audit.findings.length
    return { tone: 'tingling', text: `TINGLING · ${n} finding${n === 1 ? '' : 's'}` }
  }
  return { tone: 'calm', text: 'CALM · no findings' }
}

export const SEVERITY_ORDER = ['high', 'medium', 'low']

// Findings sorted high → medium → low; the API's order is kept within a severity.
export function sortFindings(findings) {
  const rank = (f) => {
    const i = SEVERITY_ORDER.indexOf(f.severity)
    return i === -1 ? SEVERITY_ORDER.length : i
  }
  return [...findings].sort((a, b) => rank(a) - rank(b))
}

// "R2" → "R²" for display; other metric names unchanged.
export function metricLabel(metric) {
  return metric === 'R2' ? 'R²' : metric
}

// Evidence values for the key/value table: numbers and strings as they are, anything else as JSON.
export function evidenceValue(value) {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return JSON.stringify(value)
}

// D1 chart rows, highest score first. Scores are clamped to the 0–1 axis for drawing only.
export function d1Bars(d1) {
  return [...d1.features]
    .sort((a, b) => b.score - a.score)
    .map((f) => ({ ...f, width: Math.min(1, Math.max(0, f.score)) }))
}

// Checks that an audit response has the fields the dashboard reads, so a contract mismatch shows a
// clear message instead of a blank page. Returns the response unchanged.
export function checkAudit(body) {
  const missing = []
  if (!body || typeof body !== 'object') throw new Error('Unexpected response from the backend: not a JSON object')
  if (!body.dataset || typeof body.dataset !== 'object') missing.push('dataset')
  else for (const k of ['name', 'rows', 'target', 'task']) if (body.dataset[k] === undefined) missing.push(`dataset.${k}`)
  if (!['tingling', 'calm'].includes(body.status)) missing.push('status (tingling or calm)')
  if (!body.counts || typeof body.counts !== 'object') missing.push('counts')
  if (!Array.isArray(body.findings)) missing.push('findings (a list)')
  if (body.d1_scores != null && !Array.isArray(body.d1_scores.features)) missing.push('d1_scores.features (a list)')
  if (missing.length) throw new Error(`Unexpected response from the backend: missing ${missing.join(', ')}`)
  return body
}
