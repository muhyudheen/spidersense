import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { countUpValue, overviewKpis } from '../src/redteam.js'

const mock = (name) => JSON.parse(readFileSync(new URL(`../src/mock/${name}.json`, import.meta.url)))

test('overview KPIs (strict) come from the run metrics', () => {
  const run = mock('redteam_strict')
  const [allow, guard, benign, overhead] = overviewKpis(run)
  assert.deepEqual([allow.value, allow.of, allow.tone], [9, 9, 'red'])
  assert.deepEqual([guard.value, guard.of, guard.tone, guard.upTo], [0, 9, 'green', null])
  assert.deepEqual([benign.value, benign.of], [11, 12])
  assert.equal(overhead.value, run.metrics.allowlist_plus_dataflow.overhead_ms.p50)
  assert.match(overhead.unit, /51 calls/)
})

test('overview KPIs (assist): the guard tile adds the worst case', () => {
  const guard = overviewKpis(mock('redteam_assist'))[1]
  assert.deepEqual([guard.value, guard.upTo, guard.of], [0, 4, 9])
})

test('a tile turns red as soon as one attack got through', () => {
  const run = structuredClone(mock('redteam_strict'))
  run.metrics.allowlist_plus_dataflow.attacks_succeeded = 1
  assert.equal(overviewKpis(run)[1].tone, 'red')
})

test('countUpValue eases from 0 to the target and keeps decimals', () => {
  assert.equal(countUpValue(9, 0), 0)
  assert.equal(countUpValue(9, 1), 9)
  assert.equal(countUpValue(9, 2), 9)
  assert.ok(countUpValue(9, 0.5) > 4.5) // ease-out: past halfway at half time
  assert.equal(countUpValue(0.052, 1, 3), 0.052)
})
