import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hrefFor, parseHash } from '../src/router.js'
import { DEFAULT_ROUTE, NAV, ROUTES } from '../src/routes.js'

const KNOWN = ['redteam', 'guard', 'audit', 'findings', 'agent']

test('parseHash reads the route id from the hash', () => {
  assert.equal(parseHash('#/redteam', KNOWN, 'audit'), 'redteam')
  assert.equal(parseHash('#/findings', KNOWN, 'audit'), 'findings')
  assert.equal(parseHash('#redteam', KNOWN, 'audit'), 'redteam')
  assert.equal(parseHash('#/Agent', KNOWN, 'audit'), 'agent')
})

test('parseHash ignores anything after the id (sub-paths, query)', () => {
  assert.equal(parseHash('#/redteam/exfil_email', KNOWN, 'audit'), 'redteam')
  assert.equal(parseHash('#/guard?check=canary_leak', KNOWN, 'audit'), 'guard')
})

test('parseHash falls back for an empty or unknown hash', () => {
  for (const h of ['', '#', '#/', '#/nope', undefined]) assert.equal(parseHash(h, KNOWN, 'audit'), 'audit')
})

test('hrefFor builds the hash link', () => {
  assert.equal(hrefFor('redteam'), '#/redteam')
})

test('the route table is consistent: unique ids, every nav entry has a route, the default exists', () => {
  const ids = ROUTES.map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const n of NAV) assert.ok(ids.includes(n.id), `nav ${n.id} has a route`)
  for (const r of ROUTES) assert.ok(NAV.some((n) => n.id === r.nav), `route ${r.id} belongs to a nav entry`)
  assert.ok(ids.includes(DEFAULT_ROUTE))
})
