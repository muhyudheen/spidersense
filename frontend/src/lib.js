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

export const BACKEND_DOWN = 'Backend not reachable: start it with uv run uvicorn main:app --port 8000 in backend/'

// The message to show for a failed API call. FastAPI sends {"detail": "..."}, or a list of
// {loc, msg} objects for a 422 validation error. A stopped backend shows up as a network error,
// or through the Vite dev proxy as a 502/503/504 without a JSON body.
export function errorMessage(status, body) {
  const detail = body && body.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => (d.loc ? `${d.loc.filter((x) => x !== 'body').join('.')}: ${d.msg}` : d.msg)).join('; ')
  }
  if (!status || [502, 503, 504].includes(status)) return BACKEND_DOWN
  return `Request failed (HTTP ${status})`
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

// "R2" → "R²" wherever it appears, e.g. "skill lost when scrambled (R2)"; other text unchanged.
export function metricLabel(metric) {
  return String(metric).replace(/\bR2\b/g, 'R²')
}

// The D1 chart title from d1_scores.metric: R² rendered, first letter capitalised.
export function chartTitle(metric) {
  const label = metricLabel(metric)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Evidence keys as readable labels: "skill_lost_when_scrambled" → "Skill lost when scrambled".
export function readableKey(key) {
  const label = key.replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
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

// Bars to draw: the top `max` by score plus every flagged one (a flagged column is never hidden).
// Returns the hidden ones too, so the chart can say how many there are and their highest score.
export function visibleBars(bars, max) {
  const shown = bars.filter((b, i) => i < max || b.flagged)
  const hidden = bars.filter((b, i) => !(i < max || b.flagged))
  return { shown, hidden, hiddenMax: hidden.length ? Math.max(...hidden.map((b) => b.score)) : null }
}
