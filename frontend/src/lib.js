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
