import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorMessage, parseCsvHeader, statusPill } from '../src/lib.js'

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
  assert.equal(errorMessage(0, null), 'Could not reach the backend')
})

test('statusPill: grey before an audit, red with a count, green when calm', () => {
  assert.deepEqual(statusPill(null), { tone: 'none', text: 'No audit yet' })
  assert.equal(statusPill({ status: 'tingling', findings: [{}, {}] }).text, 'TINGLING · 2 findings')
  assert.equal(statusPill({ status: 'tingling', findings: [{}] }).text, 'TINGLING · 1 finding')
  assert.deepEqual(statusPill({ status: 'calm', findings: [] }), { tone: 'calm', text: 'CALM · no findings' })
})
