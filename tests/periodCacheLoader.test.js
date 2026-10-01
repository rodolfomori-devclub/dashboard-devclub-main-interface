import test from 'node:test'
import assert from 'node:assert/strict'
import { createPeriodCacheLoader, normalizePeriodSnapshot, periodCacheStatus, bucketHasSalesSource } from '../src/services/periodSalesService.js'
import { mergeFreshSalesLedger } from '../src/components/daily/dailyData.js'
import { SOURCE_DEFINITIONS } from '../src/utils/salesData.js'
import { periodSeries, summarizePeriod } from '../src/utils/periodData.js'

const stamp = '2026-10-01T07:00:00.000Z'
const payloads = (date, net = 100) => ({
  guru: { data: [{ id: `guru-${date}`, product: { name: 'DevClub' }, dates: { created_at: Date.parse(`${date}T12:00:00Z`) / 1000 }, calculation_details: { net_amount: net, total_amount: net + 20, net_affiliate_value: 0 } }] },
  guruRefunds: { data: [] }, tmb: { success: true, data: [] },
  asaas: { success: true, data: { count: 1, totalGross: 80, totalNet: 75, totalFees: 5, sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } },
  boletex: { success: true, data: { sales: { count: 0, totalValue: 0, entries: [] } } },
  hotmart: { success: true, data: { count: 1, totalNet: 50, totalGross: 55, totalFees: 5, transactions: [] } },
  hotmartRefunds: { success: true, data: { count: 0, totalRefundAmount: 0, transactions: [] } },
})
const segment = (startDate, endDate = startDate, kind = 'history') => ({ startDate, endDate, kind, sources: SOURCE_DEFINITIONS.map(({ id }) => ({ id, status: 'ready', payload: payloads(startDate)[id], fetchedAt: stamp, lastAttemptAt: stamp, refreshing: false, error: null })) })
const snapshot = (segments, pending = 0) => ({ schemaVersion: 1, requested: { startDate: segments[0].startDate, endDate: segments.at(-1).endDate }, segments, complete: pending === 0, pending, total: segments.length * 7, completed: segments.length * 7 - pending, generatedAt: stamp, schedule: { timezone: 'America/Sao_Paulo', hour: 4 } })
const manual = (id, date) => ({ id, date, product: 'DevClub', family: 'DevClub', platform: 'Pix direto', gross: 40, net: 30, cashCollected: 40, status: 'pending' })
const emptyLedger = async () => ({ attributions: [], manualSales: [] })

test('a month starting today reports actual provider timestamps without inventing historical freshness', () => {
  const item = segment('2026-10-01', '2026-10-01', 'today')
  item.sources[0].fetchedAt = '2026-10-01T10:15:00.000Z'
  item.sources[1].fetchedAt = null
  const value = snapshot([item]); value.generatedAt = '2026-10-01T18:00:00.000Z'
  const status = periodCacheStatus(value)
  assert.equal(status.oldestSnapshotAt, null); assert.equal(status.todaySnapshotAt, stamp)
  assert.equal(status.todayNewestSnapshotAt, '2026-10-01T10:15:00.000Z')
})

test('history plus today preserves source money, aggregate identities and annual manual dates', async () => {
  const history = segment('2026-01-01', '2026-01-31')
  const current = segment('2026-02-01', '2026-02-01', 'today')
  let ledgerCalls = 0
  const load = createPeriodCacheLoader({ fetchSnapshot: async () => snapshot([history, current]), fetchLedger: async (from, to) => {
    ledgerCalls++; assert.equal(from, '2026-01-01'); assert.equal(to, '2026-02-01')
    return { attributions: [{ source: 'guru', externalId: 'guru-2026-01-01', sellerId: 'seller-current' }], manualSales: [manual('january', '2026-01-20'), manual('february', '2026-02-01'), { ...manual('linked', '2026-02-01'), linkedExternalId: 'already-in-provider' }] }
  } })
  const result = await load('2026-01-01', '2026-02-01', { annual: true })
  assert.equal(ledgerCalls, 1)
  assert.equal(summarizePeriod(result.records).total.revenue.value, 360)
  assert.equal(result.records.find(row => row.externalId === 'guru-2026-01-01').sellerId, 'seller-current')
  assert.equal(new Set(result.records.filter(row => row.isAggregate).map(row => row.id)).size, 2)
  assert.deepEqual(periodSeries(result.records, '2026-01-01', '2026-02-01', true).rows.map(row => row.revenue), [180, 180])
  assert.equal(result.sources.find(source => source.id === 'asaas').status, 'not_requested')
  assert.equal(result.cache.oldestSnapshotAt, stamp)
})

test('old complete snapshot is published during refresh, force is sent once, ledger stays outside snapshots', async () => {
  const stale = segment('2026-09-01', '2026-09-30')
  stale.sources[0] = { ...stale.sources[0], status: 'stale', refreshing: true, fetchedAt: '2026-09-30T07:00:00.000Z' }
  const fresh = segment('2026-09-01', '2026-09-30')
  const calls = [], visible = [], waits = []; let ledgerCalls = 0
  const load = createPeriodCacheLoader({ fetchSnapshot: async (_from, _to, options) => { calls.push(options); return calls.length === 1 ? snapshot([stale], 1) : snapshot([fresh]) }, fetchLedger: async () => { ledgerCalls++; return { manualSales: [manual('now', '2026-09-10')], attributions: [] } }, wait: async ms => waits.push(ms) })
  const result = await load('2026-09-01', '2026-09-30', { force: true, onSnapshot: value => visible.push(value) })
  assert.deepEqual(calls.map(call => call.force), [true, false])
  assert.deepEqual(waits, [2000]); assert.equal(ledgerCalls, 1); assert.equal(visible.length, 2)
  assert.equal(visible[0].cache.pending, 1); assert.equal(visible[0].cache.oldestSnapshotAt, '2026-09-30T07:00:00.000Z')
  assert.equal(visible[0].sources.find(source => source.id === 'guru').status, 'partial')
  assert.equal(result.records.filter(row => row.isManual).length, 1)
  await load('2026-09-01', '2026-09-30')
  assert.equal(calls.at(-1).force, false); assert.equal(ledgerCalls, 2, 'a new page load must refresh the ledger even for the same provider snapshot')
})

test('cold source remains loading until settled, provider failure is not zero and ledger failure remains explicit', async () => {
  const cold = segment('2026-09-01')
  cold.sources = cold.sources.map(source => ({ ...source, status: 'loading', payload: null, fetchedAt: null }))
  const failed = { ...cold, sources: cold.sources.map(source => ({ ...source, status: 'unavailable', error: 'provider_unavailable' })) }
  let calls = 0, ledgerCalls = 0; const visible = []
  const load = createPeriodCacheLoader({ fetchSnapshot: async () => ++calls === 1 ? snapshot([cold], 7) : snapshot([failed]), fetchLedger: async () => { ledgerCalls++; throw new Error('ledger unavailable') }, wait: async () => { assert.equal(visible.length, 0); assert.equal(ledgerCalls, 0) } })
  const result = await load('2026-09-01', '2026-09-01', { onSnapshot: value => visible.push(value) })
  assert.equal(result.records.length, 0); assert.equal(result.operationsStatus, 'unavailable')
  assert.ok(result.sources.every(source => source.status === 'unavailable'))
  assert.equal(result.cache.oldestSnapshotAt, null)
})

test('stale Asaas receipt metadata stays separate from cache status and never becomes a sale', () => {
  const item = segment('2026-09-01')
  item.sources.find(source => source.id === 'asaas').status = 'stale'
  const source = normalizePeriodSnapshot(snapshot([item])).sources.find(source => source.id === 'asaas')
  assert.equal(source.reason, 'checkout_disabled'); assert.equal(source.salesAvailable, false)
  assert.equal(source.cash.gross, 80); assert.equal(source.cash.net, 75); assert.equal(source.rows.length, 0)
  assert.equal(source.cacheStatus, 'stale'); assert.equal(source.snapshots[0].fetchedAt, stamp)
})

test('leaving a period or changing identity stops future polls and ledger reads', async () => {
  for (const byIdentity of [false, true]) {
    let calls = 0, cancelled = false, generation = 0
    const item = segment('2026-09-01'); item.sources = item.sources.map(source => ({ ...source, status: 'loading', payload: null }))
    const load = createPeriodCacheLoader({ fetchSnapshot: async () => { calls++; return snapshot([item], 1) }, fetchLedger: async () => assert.fail('ledger must not run after cancellation'), getGeneration: () => generation, wait: async () => { if (byIdentity) generation++; else cancelled = true } })
    await assert.rejects(load('2026-09-01', '2026-09-01', { isCancelled: () => cancelled }), /cancelada/)
    assert.equal(calls, 1)
  }
})

test('history appears while today loads and timeout preserves partial values without polling forever', async () => {
  let time = 0, calls = 0, ledgerCalls = 0
  const history = segment('2026-09-01', '2026-09-14')
  const today = segment('2026-09-15', '2026-09-15', 'today')
  today.sources = today.sources.map(source => ({ ...source, status: 'loading', payload: null, fetchedAt: null }))
  const visible = []
  const load = createPeriodCacheLoader({ fetchSnapshot: async () => { calls++; return snapshot([history, today], 7) }, fetchLedger: async () => { ledgerCalls++; return emptyLedger() }, now: () => time, maxWaitMs: 5000, wait: async ms => { time += ms } })
  const result = await load('2026-09-01', '2026-09-15', { onSnapshot: value => visible.push(value) })
  assert.equal(calls, 3); assert.equal(ledgerCalls, 1); assert.equal(visible.length, 1)
  assert.equal(result.cache.pollTimedOut, true); assert.equal(result.cache.pending, 7)
  assert.equal(summarizePeriod(result.records).total.revenue.value, 150)
  assert.equal(result.sources.find(source => source.id === 'guru').status, 'partial')
  assert.equal(result.sources.find(source => source.id === 'guru').snapshots[1].status, 'loading')
  assert.equal(bucketHasSalesSource(result.sources, ['guru', 'hotmart'], '2026-09-14', '2026-09-14'), true)
  assert.equal(bucketHasSalesSource(result.sources, ['guru', 'hotmart'], '2026-09-15', '2026-09-15'), false, 'today pending cannot inherit a confirmed zero from ready history')
})

test('AbortSignal interrupts the waiting period immediately and stops all later requests', async () => {
  const controller = new AbortController(); let calls = 0
  const cold = segment('2026-09-01'); cold.sources = cold.sources.map(source => ({ ...source, status: 'loading', payload: null }))
  const load = createPeriodCacheLoader({ fetchSnapshot: async () => { calls++; return snapshot([cold], 7) }, fetchLedger: emptyLedger })
  const pending = load('2026-09-01', '2026-09-01', { signal: controller.signal, onProgress: () => controller.abort() })
  await assert.rejects(pending, /cancelada/); assert.equal(calls, 1)
})

test('malformed, missing and overlapping snapshots fail explicitly without provider fallback', async () => {
  const invalid = [null, { data: [] }, snapshot([segment('2026-09-01', '2026-09-10'), segment('2026-09-10', '2026-09-30')])]
  for (const value of invalid) {
    const load = createPeriodCacheLoader({ fetchSnapshot: async () => value, fetchLedger: async () => assert.fail('invalid snapshot must not read ledger') })
    await assert.rejects(load('2026-09-01', '2026-09-30'), /Cache do período/)
  }
  const load = createPeriodCacheLoader({ fetchSnapshot: async () => { throw new Error('HTTP503') } })
  await assert.rejects(load('2026-09-01', '2026-09-30'), /HTTP503/)
})

test('reusing providers reads current assignments and reconciliation without mutating cached records', async () => {
  const providers = normalizePeriodSnapshot(snapshot([segment('2026-09-01')]))
  const first = await mergeFreshSalesLedger(providers, '2026-09-01', '2026-09-01', async () => ({ manualSales: [manual('pending', '2026-09-01')], attributions: [{ source: 'guru', externalId: 'guru-2026-09-01', sellerId: 'old-seller' }] }))
  const next = await mergeFreshSalesLedger(providers, '2026-09-01', '2026-09-01', async () => ({ manualSales: [{ ...manual('pending', '2026-09-01'), linkedExternalId: 'guru-2026-09-01' }], attributions: [{ source: 'guru', externalId: 'guru-2026-09-01', sellerId: 'new-seller' }] }))
  assert.equal(first.records.filter(row => row.isManual).length, 1); assert.equal(next.records.filter(row => row.isManual).length, 0)
  assert.equal(next.records.find(row => row.sourceId === 'guru').sellerId, 'new-seller')
  assert.equal(providers.records.find(row => row.sourceId === 'guru').sellerId, undefined)
  const failed = await mergeFreshSalesLedger(providers, '2026-09-01', '2026-09-01', async () => { throw new Error('denied') })
  assert.equal(failed.sources.find(source => source.id === 'manual').status, 'unavailable')
  assert.equal((await mergeFreshSalesLedger(providers, '2026-09-01', '2026-09-01', emptyLedger)).sources.find(source => source.id === 'manual').status, 'ready')
})
