import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKEND_DOWN, chartTitle, checkAudit, d1Bars, errorMessage, evidenceValue, metricLabel, parseCsvHeader, readableKey,
  sortFindings, statusPill, visibleBars,
} from '../src/lib.js'

test('parseCsvHeader reads plain names from the first line only', () => {
  assert.deepEqual(parseCsvHeader('a,b,c\n1,2,3\n'), ['a', 'b', 'c'])
})

test('parseCsvHeader handles quoted names, doubled quotes, CRLF and a BOM', () => {
  assert.deepEqual(parseCsvHeader('﻿"Delay, hours","say ""hi""",plain\r\n1,2,3'),
    ['Delay, hours', 'say "hi"', 'plain'])
})

test('parseCsvHeader drops empty names (e.g. a pandas index column)', () => {
  assert.deepEqual(parseCsvHeader(',x,y'), ['x', 'y'])
})

test('errorMessage shows FastAPI detail strings and 422 lists', () => {
  assert.equal(errorMessage(400, { detail: 'Target column not found' }), 'Target column not found')
  assert.equal(errorMessage(422, { detail: [{ loc: ['body', 'target'], msg: 'Field required' }] }),
    'target: Field required')
  assert.equal(errorMessage(500, null), 'Request failed (HTTP 500)')
  assert.equal(errorMessage(404, null), 'Request failed (HTTP 404)')
  assert.equal(errorMessage(0, null), BACKEND_DOWN)
  assert.equal(errorMessage(502, null), BACKEND_DOWN)
})

test('statusPill: grey before an audit, red with a count, green when calm', () => {
  assert.deepEqual(statusPill(null), { tone: 'none', text: 'No audit yet' })
  assert.equal(statusPill({ status: 'tingling', findings: [{}, {}] }).text, 'TINGLING · 2 findings')
  assert.equal(statusPill({ status: 'tingling', findings: [{}] }).text, 'TINGLING · 1 finding')
  assert.deepEqual(statusPill({ status: 'calm', findings: [] }), { tone: 'calm', text: 'CALM · no findings' })
})

test('sortFindings puts high before medium before low, keeping API order within a severity', () => {
  const out = sortFindings([
    { id: 'a', severity: 'low' }, { id: 'b', severity: 'high' },
    { id: 'c', severity: 'medium' }, { id: 'd', severity: 'high' },
  ])
  assert.deepEqual(out.map((f) => f.id), ['b', 'd', 'c', 'a'])
})

test('metricLabel and evidenceValue format for display', () => {
  assert.equal(metricLabel('R2'), 'R²')
  assert.equal(metricLabel('AUC'), 'AUC')
  assert.equal(metricLabel('skill lost when scrambled (R2)'), 'skill lost when scrambled (R²)')
  assert.equal(chartTitle('skill lost when scrambled (AUC)'), 'Skill lost when scrambled (AUC)')
  assert.equal(readableKey('skill_lost_without_column'), 'Skill lost without column')
  assert.equal(evidenceValue(0.83), '0.83')
  assert.equal(evidenceValue('Transport_Mode'), 'Transport_Mode')
  assert.equal(evidenceValue([1, 2]), '[1,2]')
  assert.equal(evidenceValue(null), 'null')
})

test('d1Bars sorts by score, highest first, and clamps bar width to 0–1', () => {
  const bars = d1Bars({ features: [
    { name: 'a', score: 0.2, flagged: false }, { name: 'b', score: 0.9, flagged: true },
    { name: 'c', score: -0.3, flagged: false },
  ] })
  assert.deepEqual(bars.map((b) => b.name), ['b', 'a', 'c'])
  assert.equal(bars[2].width, 0)
  assert.equal(bars[2].score, -0.3)
})

test('checkAudit passes a contract response and names what is missing otherwise', () => {
  const ok = { dataset: { name: 'p', rows: 1, target: 't', task: 'regression' }, status: 'calm',
    counts: { high: 0, medium: 0, low: 0 }, findings: [], d1_scores: null }
  assert.equal(checkAudit(ok), ok)
  assert.throws(() => checkAudit({ ...ok, findings: undefined, status: 'red' }),
    /missing status \(tingling or calm\), findings \(a list\)/)
  assert.throws(() => checkAudit({ ...ok, dataset: { name: 'p' } }), /dataset\.rows, dataset\.target, dataset\.task/)
  assert.throws(() => checkAudit({ ...ok, d1_scores: { metric: 'AUC' } }), /d1_scores\.features/)
  assert.throws(() => checkAudit(null), /not a JSON object/)
})

test('visibleBars keeps the top N plus every flagged bar, and reports the hidden ones', () => {
  const bars = d1Bars({ features: [
    { name: 'a', score: 0.5, flagged: true }, { name: 'b', score: 0.3, flagged: false },
    { name: 'c', score: 0.02, flagged: false }, { name: 'd', score: 0.01, flagged: true },
    { name: 'e', score: 0.0, flagged: false },
  ] })
  const { shown, hidden, hiddenMax } = visibleBars(bars, 2)
  assert.deepEqual(shown.map((b) => b.name), ['a', 'b', 'd'])
  assert.deepEqual(hidden.map((b) => b.name), ['c', 'e'])
  assert.equal(hiddenMax, 0.02)
  assert.equal(visibleBars(bars, 10).hidden.length, 0)
})
