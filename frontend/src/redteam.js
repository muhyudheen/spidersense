// Pure helpers for the Red-Team Simulator (no React), so they can be tested with `node --test`.
// Every number and every SUCCEEDED / STOPPED / BLOCKED label is derived from the run response.

export const CONFIGS = ['no_guard', 'allowlist_only', 'allowlist_plus_dataflow']
export const GUARD_CONFIG = 'allowlist_plus_dataflow'

export const CONFIG_LABELS = {
  no_guard: 'No guard',
  allowlist_only: 'Allowlist only',
  allowlist_plus_dataflow: 'Allowlist + Data-Flow Guard',
}

export const CHECK_LABELS = {
  canary_leak: 'Canary leak',
  hijacked_destination: 'Hijacked destination',
  unverified_destination: 'Unverified destination',
  injected_command: 'Injected command',
  private_leak: 'Private data leak',
  secret_pattern: 'Secret pattern',
}

export const ASSIST_RANGE_TIP = 'best = a human rejects every held call; worst = a human approves every held call'

// Checks a run response has what the Red-Team page reads.
export function checkRedteamRun(body) {
  if (!body || typeof body !== 'object') throw new Error('Unexpected red-team response from the backend: not a JSON object')
  const missing = []
  if (!['strict', 'assist'].includes(body.mode)) missing.push('mode (strict or assist)')
  if (!body.metrics || typeof body.metrics !== 'object') missing.push('metrics')
  else for (const c of CONFIGS) if (!body.metrics[c]) missing.push(`metrics.${c}`)
  if (!Array.isArray(body.results)) missing.push('results (a list)')
  if (missing.length) throw new Error(`Unexpected red-team response from the backend: missing ${missing.join(', ')}`)
  return body
}

export const pct = (x) => `${Math.round(x * 100)}%`

// One scoreboard card per config, in CONFIGS order.
export function scoreboard(run) {
  return CONFIGS.map((config) => {
    const m = run.metrics[config]
    const range = run.mode === 'assist' && m.asr_best !== m.asr_worst
    return {
      config,
      label: CONFIG_LABELS[config],
      attacksSucceeded: m.attacks_succeeded,
      attacks: m.attacks,
      // In assist mode a held attack succeeds only if a human approves it: the worst case
      attacksWorst: Math.round(m.asr_worst * m.attacks),
      asrBest: m.asr_best,
      asrWorst: m.asr_worst,
      asrText: range ? `${pct(m.asr_best)}–${pct(m.asr_worst)}` : pct(m.asr_worst),
      asrIsRange: range,
      benignCompleted: m.benign_completed,
      benign: m.benign,
      benignCompletion: m.benign_completion,
      escalationAttacks: m.escalation_rate_attacks,
      escalationBenign: m.escalation_rate_benign,
      overhead: m.overhead_ms,
    }
  })
}

// The chip for one scenario under one config.
export function chipFor(result) {
  if (!result) return { tone: 'none', text: '—', title: 'not run under this config' }
  if (result.kind === 'attack') {
    if (result.attack_succeeded) return { tone: 'red', text: 'SUCCEEDED', title: 'the attack got through' }
    if (result.escalated && !result.blocked) {
      return { tone: 'amber', text: 'HELD', title: 'held for a human: stopped only if the human rejects it' }
    }
    return { tone: 'green', text: 'STOPPED', title: 'the attack was stopped' }
  }
  if (result.completed) return { tone: 'green', text: 'DONE', title: 'the normal task was completed' }
  if (result.escalated) return { tone: 'amber', text: 'HELD', title: 'held for a human' }
  return { tone: 'red', text: 'BLOCKED', title: 'the normal task was blocked' }
}

// Matrix rows: one per scenario, attacks first, then normal tasks, in the run's order.
// `scenarios` (from GET /api/redteam/scenarios) adds the user task when available.
export function matrixRows(run, scenarios = []) {
  const byId = new Map()
  for (const r of run.results) {
    if (!byId.has(r.scenario)) {
      const s = scenarios.find((x) => x.id === r.scenario)
      byId.set(r.scenario, { id: r.scenario, kind: r.kind, category: r.category, title: r.title,
        userTask: s ? s.user_task : null, results: {} })
    }
    byId.get(r.scenario).results[r.config] = r
  }
  const rows = [...byId.values()]
  return [...rows.filter((r) => r.kind === 'attack'), ...rows.filter((r) => r.kind !== 'attack')]
}

// Category filter chips with counts from the rows.
export function categoryCounts(rows) {
  const counts = new Map()
  for (const r of rows) counts.set(r.category, (counts.get(r.category) || 0) + 1)
  return [...counts.entries()].map(([category, count]) => ({ category, count }))
}

const STOPPING = ['blocked', 'escalated', 'escalated_approved', 'denied_by_allowlist']

// Incident cards for one result: one per finding on a call that was blocked, held or denied.
export function incidentsFor(result) {
  if (!result) return []
  const out = []
  for (const call of result.calls || []) {
    if (!STOPPING.includes(call.outcome)) continue
    const findings = call.findings && call.findings.length ? call.findings : [null]
    findings.forEach((f, i) => out.push({
      key: `${call.step}-${i}`,
      step: call.step,
      tool: call.tool,
      outcome: call.outcome,
      decision: call.decision ?? (f ? f.action : null),
      check: f ? f.check : null,
      action: f ? f.action : null,
      severity: f ? f.severity : null,
      arg: f ? f.arg : null,
      value: f ? f.value_excerpt : null,
      reason: f ? f.reason : (call.outcome === 'denied_by_allowlist' ? `${call.tool} is not on the allowlist.` : ''),
      evidence: f ? f.evidence || [] : [],
    }))
  }
  return out
}

// Splits `text` into [{text, hit}] segments, marking where the evidence span occurs. The span is tried
// whole first, then as its comma-separated parts (the backend joins several matched entities with ", ").
export function highlightSpan(text, span) {
  const value = String(text ?? '')
  if (!value || !span) return [{ text: value, hit: false }]
  const whole = String(span)
  const terms = value.toLowerCase().includes(whole.toLowerCase())
    ? [whole]
    : whole.split(/,\s*/).map((t) => t.trim()).filter((t) => t.length >= 4)
  const lower = value.toLowerCase()
  const marks = []
  for (const t of terms) {
    let from = 0
    for (;;) {
      const i = lower.indexOf(t.toLowerCase(), from)
      if (i === -1) break
      marks.push([i, i + t.length])
      from = i + t.length
    }
  }
  if (!marks.length) return [{ text: value, hit: false }]
  marks.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1])
    else merged.push([...m])
  }
  const segs = []
  let pos = 0
  for (const [a, b] of merged) {
    if (a > pos) segs.push({ text: value.slice(pos, a), hit: false })
    segs.push({ text: value.slice(a, b), hit: true })
    pos = b
  }
  if (pos < value.length) segs.push({ text: value.slice(pos), hit: false })
  return segs
}

// "web_fetch:https://vendor.example/page" → "web_fetch (vendor.example)"; "read_customer_db" stays.
export function originLabel(origin) {
  const s = String(origin ?? '')
  const i = s.indexOf(':')
  if (i === -1) return s
  const tool = s.slice(0, i)
  const rest = s.slice(i + 1)
  let where = rest
  try { where = new URL(rest).host || rest } catch { /* not a URL: keep as is */ }
  return `${tool} (${where})`
}

export const OUTCOME_LABELS = {
  executed: { tone: 'grey', text: 'EXECUTED' },
  blocked: { tone: 'red', text: 'BLOCKED' },
  escalated: { tone: 'amber', text: 'HELD FOR HUMAN' },
  escalated_approved: { tone: 'amber', text: 'HELD · APPROVED' },
  denied_by_allowlist: { tone: 'red', text: 'DENIED BY ALLOWLIST' },
}
export const outcomeBadge = (outcome) => OUTCOME_LABELS[outcome] || { tone: 'grey', text: String(outcome).toUpperCase() }

// The flow trace on an incident card: where the data came from → which step → which argument → decision.
export function flowTrace(incident) {
  const origin = incident.evidence[0] ? originLabel(incident.evidence[0].origin) : 'the agent'
  return [
    { kind: 'origin', text: origin },
    { kind: 'step', text: `step ${incident.step}` },
    { kind: 'sink', text: incident.arg ? `${incident.tool}.${incident.arg}` : incident.tool },
    { kind: 'decision', text: outcomeBadge(incident.outcome).text, tone: outcomeBadge(incident.outcome).tone },
  ]
}

// The tool call's key argument for labels, e.g. send_email → "audit@evil.example".
const KEY_ARGS = ['to', 'url', 'payee_upi', 'cmd', 'path', 'query', 'name', 'folder', 'text']
export function keyArg(call) {
  const args = call && call.args ? call.args : {}
  const k = KEY_ARGS.find((a) => args[a] != null) ?? Object.keys(args)[0]
  if (k == null) return ''
  const v = typeof args[k] === 'string' ? args[k] : JSON.stringify(args[k])
  return v.length > 48 ? `${v.slice(0, 47)}…` : v
}

// ---- Attack replay (three lanes, one per config) ----

// The stations a call passes: 0 source, 1 OfficeBot, 2 allowlist gate, 3 Data-Flow Guard, 4 outside world.
export const STATIONS = ['source', 'agent', 'allowlist', 'guard', 'world']

// Where a call's packet stops, and what it shows there, from the call's `outcome`.
export function packetStop(outcome) {
  switch (outcome) {
    case 'denied_by_allowlist': return { stopAt: 2, stamp: 'DENIED', tone: 'red' }
    case 'blocked': return { stopAt: 3, stamp: 'BLOCKED', tone: 'red' }
    case 'escalated': return { stopAt: 3, stamp: 'HELD FOR HUMAN', tone: 'amber' }
    case 'escalated_approved': return { stopAt: 4, stamp: 'APPROVED BY HUMAN', tone: 'amber' }
    default: return { stopAt: 4, stamp: null, tone: 'grey' }
  }
}

// How a lane ends, from the scenario result.
export function laneVerdict(result) {
  if (!result) return { tone: 'none', text: '—' }
  if (result.kind === 'attack') {
    if (result.attack_succeeded) return { tone: 'red', text: 'ATTACK SUCCEEDED' }
    if (result.escalated && !result.blocked) return { tone: 'amber', text: 'HELD FOR HUMAN' }
    return { tone: 'green', text: 'ATTACK STOPPED' }
  }
  if (result.completed) return { tone: 'green', text: 'DONE' }
  if (result.escalated) return { tone: 'amber', text: 'HELD FOR HUMAN' }
  return { tone: 'red', text: 'BLOCKED' }
}

// The replay for one matrix row: per lane, each call's packet (label, stop, stamp, reason) and the verdict.
// All lanes advance together, one call per step; a lane with fewer calls waits at its end.
export function replayPlan(row) {
  const lanes = CONFIGS.map((config) => {
    const result = row.results[config]
    const calls = (result ? result.calls : []).map((call) => {
      const stop = packetStop(call.outcome)
      const finding = (call.findings || []).find((f) => f.action !== 'warn') || null
      return {
        step: call.step,
        tool: call.tool,
        label: keyArg(call) ? `${call.tool} → ${keyArg(call)}` : call.tool,
        outcome: call.outcome,
        ...stop,
        reason: finding ? finding.reason : (call.outcome === 'denied_by_allowlist' ? `${call.tool} is not on the allowlist.` : ''),
      }
    })
    return { config, label: CONFIG_LABELS[config], calls, verdict: laneVerdict(result),
      gates: { allowlist: config !== 'no_guard', guard: config === GUARD_CONFIG } }
  })
  return { lanes, length: Math.max(0, ...lanes.map((l) => l.calls.length)) }
}

// ---- Overview KPIs ----

// The Overview's tiles, from one run's metrics. A tile is red when attacks got through, green when none did.
export function overviewKpis(run) {
  const allow = run.metrics.allowlist_only
  const guard = run.metrics[GUARD_CONFIG]
  const guardWorst = Math.round(guard.asr_worst * guard.attacks)
  return [
    { id: 'allowlist', label: 'Allowlist only', value: allow.attacks_succeeded, of: allow.attacks,
      unit: 'attacks got through', tone: allow.attacks_succeeded > 0 ? 'red' : 'green' },
    { id: 'guard', label: 'With Data-Flow Guard', value: guard.attacks_succeeded, of: guard.attacks,
      // assist: a held attack gets through only if a human approves it
      upTo: guardWorst > guard.attacks_succeeded ? guardWorst : null,
      unit: 'attacks got through', tone: guard.attacks_succeeded > 0 ? 'red' : 'green' },
    { id: 'benign', label: 'Normal work completed', value: guard.benign_completed, of: guard.benign,
      unit: 'tasks, with the guard on', tone: guard.benign_completed === guard.benign ? 'green' : 'green-partial' },
    { id: 'overhead', label: "Guard's median time per call", value: guard.overhead_ms.p50, decimals: 3,
      unit: `ms (p95 ${guard.overhead_ms.p95} ms, ${guard.overhead_ms.calls} calls)`, tone: 'cyan' },
  ]
}

// Count-up value at time t (0…1), eased; integers stay integers.
export function countUpValue(target, t, decimals = 0) {
  const eased = 1 - (1 - Math.min(1, Math.max(0, t))) ** 3
  const v = target * eased
  return decimals ? Number(v.toFixed(decimals)) : Math.round(v)
}

// ---- Data-Flow Guard page: the incident feed ----

export const CHECK_ORDER = ['canary_leak', 'hijacked_destination', 'unverified_destination', 'injected_command',
  'private_leak', 'secret_pattern']

// Every finding the guard made in a run, across all scenarios (the guard config only), newest step first.
export function feedIncidents(run) {
  const order = new Map()
  const out = []
  for (const r of run.results) {
    if (r.config !== GUARD_CONFIG) continue
    if (!order.has(r.scenario)) order.set(r.scenario, order.size)
    for (const call of r.calls || []) {
      ;(call.findings || []).forEach((f, i) => out.push({
        key: `${r.scenario}-${call.step}-${i}`,
        scenario: r.scenario, title: r.title, kind: r.kind,
        step: call.step, tool: f.tool || call.tool, arg: f.arg, outcome: call.outcome,
        check: f.check, action: f.action, severity: f.severity, reason: f.reason,
      }))
    }
  }
  return out.sort((a, b) => b.step - a.step || order.get(a.scenario) - order.get(b.scenario))
}

// Filter chips: how many findings each check made in the feed (checks with none are left out).
export function checkCounts(feed) {
  const counts = Object.fromEntries(CHECK_ORDER.map((c) => [c, 0]))
  for (const f of feed) counts[f.check] = (counts[f.check] || 0) + 1
  return Object.entries(counts).filter(([, n]) => n > 0).map(([check, count]) => ({ check, count }))
}

// What each check actually did in the run: check → {block, escalate, warn}.
export function actionsByCheck(feed) {
  const out = {}
  for (const f of feed) {
    out[f.check] = out[f.check] || {}
    out[f.check][f.action] = (out[f.check][f.action] || 0) + 1
  }
  return out
}

export const ACTION_LABELS = { block: 'BLOCK', escalate: 'HOLD FOR HUMAN', warn: 'WARN', allow: 'ALLOW' }
