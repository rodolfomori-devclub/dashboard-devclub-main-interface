import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers'
import { asaasCashRanges, createAsaasCashLoader, readAsaasCash } from '../src/utils/asaasCashRange.js'
import { mergePeriodSources } from '../src/utils/periodData.js'
const payload = (value = 10) => ({ success: true, data: { totalGross: value, totalNet: value, totalFees: 0, count: value ? 1 : 0, sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('cash ranges cover real dates exactly once, inclusive and at most seven days', () => {
  const ranges = asaasCashRanges('2024-01-01', '2024-12-31')
  assert.equal(ranges.length, 53)
  let days = 0
  for (const [i, range] of ranges.entries()) {
    const length = (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 + 1
    assert.ok(length >= 1 && length <= 7); days += length
    if (i) assert.equal(Date.parse(range.startDate) - Date.parse(ranges[i - 1].endDate), 86400000)
  }
  assert.equal(days, 366)
  assert.throws(() => asaasCashRanges('2026-02-30', '2026-03-01'))
  assert.throws(() => asaasCashRanges('2026-01-01', '2027-01-02'))
})

test('annual operational merge retains Asaas as not requested without fake cash or sales', () => {
  const source = { id: 'asaas', kind: 'sale', status: 'not_requested', salesAvailable: false, rows: [], cash: null, reason: 'annual_cash_on_demand' }
  const result = mergePeriodSources(['01', '02'].map(month => ({ startDate: `2026-${month}-01`, result: { sources: [source], records: [] } })), true)[0]
  assert.equal(result.status, 'not_requested'); assert.equal(result.cash, null); assert.equal(result.salesAvailable, false); assert.equal(result.failures, 0)
})

test('loader caps global concurrency at two, deduplicates pending ranges and publishes sums only on completion', async () => {
  let active = 0, peak = 0, calls = 0
  const progress = []
  const loader = createAsaasCashLoader(async () => { calls++; active++; peak = Math.max(peak, active); await tick(); active--; return payload() })
  const first = loader.load('2026-01-01', '2026-01-20', { onProgress: value => progress.push(value) })
  assert.equal(loader.load('2026-01-01', '2026-01-20'), first)
  const other = loader.load('2026-02-01', '2026-02-10')
  const [a, b] = await Promise.all([first, other])
  assert.equal(peak, 2); assert.equal(calls, 5); assert.equal(a.cash.net, 30); assert.equal(b.cash.net, 20)
  assert.ok(progress.every(value => !Object.hasOwn(value, 'cash')))
  assert.equal(progress.at(-1).current, 3)
  assert.equal((await loader.load('2026-01-01', '2026-01-20')).cash.net, 30); assert.equal(calls, 5)
})

test('partial intervals retain a labeled subtotal and retry only failed intervals, including after a forced refresh', async () => {
  let fail = true, calls = 0
  const loader = createAsaasCashLoader(async ({ startDate }) => { calls++; if (fail && startDate.endsWith('-08')) throw new Error('upstream'); return payload() })
  const first = await loader.load('2026-01-01', '2026-01-14')
  assert.equal(first.status, 'partial'); assert.equal(first.cash.net, 10); assert.equal(first.cash.availablePeriods, 1); assert.equal(first.failedPeriods.length, 1)
  fail = false; const complete = await loader.load('2026-01-01', '2026-01-14')
  assert.equal(complete.status, 'ready'); assert.equal(complete.cash.net, 20); assert.equal(calls, 3)
  fail = true; assert.equal((await loader.load('2026-01-01', '2026-01-14', { force: true })).status, 'partial'); assert.equal(calls, 5)
  fail = false; assert.equal((await loader.load('2026-01-01', '2026-01-14')).status, 'ready'); assert.equal(calls, 6)
})

test('all failed remains unknown while a confirmed empty query has real zero cash', async () => {
  const failed = await createAsaasCashLoader(async () => { throw new Error('failed') }).load('2026-01-01', '2026-01-08')
  assert.equal(failed.status, 'unavailable'); assert.equal(failed.cash, null)
  const empty = await createAsaasCashLoader(async () => payload(0)).load('2026-01-01', '2026-01-08')
  assert.equal(empty.status, 'ready'); assert.equal(empty.cash.net, 0); assert.equal(empty.cash.count, 0)
  assert.throws(() => readAsaasCash({ ...payload(), data: { ...payload().data, totalNet: null } }))
})

test('session invalidation stops queued intervals and old responses never repopulate the new cache', async () => {
  const releases = []; let calls = 0
  const loader = createAsaasCashLoader(async () => { calls++; await new Promise(resolve => releases.push(resolve)); return payload() })
  const old = loader.load('2026-01-01', '2026-01-20')
  const rejected = assert.rejects(old, /cancelada/)
  await tick(); assert.equal(calls, 2); loader.invalidate(); releases.splice(0).forEach(resolve => resolve())
  await rejected; assert.equal(calls, 2)
  const fresh = loader.load('2026-01-01', '2026-01-01')
  await tick(); assert.equal(calls, 3); releases.splice(0).forEach(resolve => resolve())
  assert.equal((await fresh).cash.net, 10)
})

test('leaving a period cancels future queued requests after the two active requests settle', async () => {
  let cancelled = false, calls = 0
  const releases = []
  const loader = createAsaasCashLoader(async () => { calls++; await new Promise(resolve => releases.push(resolve)); return payload() })
  const pending = loader.load('2026-01-01', '2026-12-31', { isCancelled: () => cancelled })
  const rejected = assert.rejects(pending, /cancelada/)
  await tick(); assert.equal(calls, 2)
  cancelled = true; releases.splice(0).forEach(resolve => resolve())
  await rejected; assert.equal(calls, 2, 'all later weekly intervals must stop before issuing HTTP requests')
})
