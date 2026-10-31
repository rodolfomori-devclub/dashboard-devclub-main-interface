import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderRangeLoader, mergeFreshSalesLedger } from '../src/components/daily/dailyData.js'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { buildRefundSummary } from '../src/utils/refundSummary.js'

const date = '2026-10-19', stamp = Date.parse(`${date}T18:00:00Z`)
const hotmartSale = (net = 29000, extra = {}) => ({ transaction: 'hotmart-known', product: 'DevClub', paymentMethod: 'CREDIT_CARD',
  orderDate: `${date}T15:00:00Z`, grossValue: 30000, netValue: net, fee: 1000, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', ...extra })
const hotmart = (rows = [hotmartSale()], coverage) => ({ success: true, data: { financialSchemaVersion: 2, transactions: rows, count: rows.length,
  totalGross: rows.reduce((sum, row) => sum + (row.grossValue ?? 0), 0), totalNet: rows.reduce((sum, row) => sum + (row.netValue ?? 0), 0),
  totalFees: rows.reduce((sum, row) => sum + (row.fee ?? 0), 0), ...(coverage ? { financialCoverage: coverage } : {}) } })
const guru = (net = 171000) => ({ success: true, data: [{ id: 'guru-known', payment: { method: 'credit_card' }, product: { name: 'DevClub' },
  dates: { created_at: `${date}T15:00:00Z` }, calculation_details: { net_amount: net } }] })
const empty = id => ['guru', 'guruRefunds', 'tmb'].includes(id) ? { success: true, data: [] }
  : ['hotmart', 'hotmartRefunds', 'hubla', 'hublaRefunds'].includes(id) ? hotmart([])
    : id === 'asaas' ? { success: true, data: { count: 0, totalGross: 0, totalNet: 0, totalFees: 0, cashReceipts: [], sales: null,
      availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } }
      : { success: true, data: { sales: { count: 0, totalValue: 0, entries: [] } } }
const source = (result, id) => result.sources.find(item => item.id === id)
const card = result => buildRevenueBreakdown(result.sources.flatMap(item => item.rows), result.sources).payments.card.value
function fixture() {
  let time = stamp
  const payloads = { guru: guru(), hotmart: hotmart() }, calls = []
  const loader = createProviderRangeLoader({ now: () => time, fetchProvider: async (id, from, to) => {
    calls.push({ id, from, to })
    const value = payloads[id] ?? empty(id)
    if (value instanceof Error) throw value
    return structuredClone(value)
  } })
  return { ...loader, payloads, calls, advance: (milliseconds = 60001) => { time += milliseconds } }
}

test('one failed provider preserves its last valid subtotal while healthy sources advance, including repeated failures', async () => {
  const f = fixture()
  const first = await f.load(date, date)
  assert.equal(card(first), 200000)
  f.advance()
  f.payloads.hotmart = new Error('synthetic timeout')
  f.payloads.guru = guru(172000)
  const next = await f.load(date, date, { force: true })
  assert.equal(card(next), 201000)
  const retained = source(next, 'hotmart')
  assert.equal(retained.status, 'partial')
  assert.equal(retained.cacheStatus, 'stale')
  assert.equal(retained.reason, 'provider_unavailable')
  assert.match(retained.error, /Hotmart.*última leitura válida/)
  assert.equal(retained.fetchedAt, stamp)
  assert.equal(retained.lastAttemptAt, stamp + 60001)
  assert.equal(source(next, 'guru').fetchedAt, stamp + 60001)
  f.advance()
  const again = await f.load(date, date, { force: true })
  assert.equal(card(again), 201000)
  assert.equal(source(again, 'hotmart').fetchedAt, stamp, 'Failures never pretend that retained data was collected again')
  assert.equal(source(first, 'hotmart').status, 'ready', 'Previously published snapshots stay immutable')
})

test('malformed and explicit unsuccessful replies cannot erase a valid source', async () => {
  const f = fixture()
  await f.load(date, date)
  for (const reply of [{ success: false, data: null }, { success: true, data: { count: 1, transactions: 'invalid' } }, null]) {
    f.advance()
    // Undefined and null are invalid transport bodies, not known-empty sales.
    const load = reply === null ? createProviderRangeLoader({ fetchProvider: async id => id === 'hotmart' ? null : empty(id) }) : null
    if (load) {
      assert.equal(source(await load.load(date, date), 'hotmart').status, 'unavailable')
      continue
    }
    f.payloads.hotmart = reply
    const result = await f.load(date, date, { force: true })
    assert.equal(card(result), 200000)
    assert.equal(source(result, 'hotmart').cacheStatus, 'stale')
  }
})

test('known transaction net disappearing in HTTP 200 preserves the provider; numeric reductions, zero and removals replace it', async () => {
  const f = fixture()
  await f.load(date, date)
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(null, { netCurrency: null })], { net: { complete: false, known: 0, missing: 1 } })
  let result = await f.load(date, date, { force: true })
  assert.equal(card(result), 200000)
  assert.equal(source(result, 'hotmart').reason, 'financial_incomplete')
  assert.equal(source(result, 'hotmart').fetchedAt, stamp)
  f.payloads.guru = guru(null)
  f.advance()
  result = await f.load(date, date, { force: true })
  assert.equal(card(result), 200000)
  assert.equal(source(result, 'guru').reason, 'financial_incomplete')
  f.payloads.guru = guru()
  for (const net of [28000, 0]) {
    f.advance()
    f.payloads.hotmart = hotmart([hotmartSale(net)])
    result = await f.load(date, date, { force: true })
    assert.equal(card(result), 171000 + net)
    assert.equal(source(result, 'hotmart').status, 'ready')
    assert.equal(source(result, 'hotmart').cacheStatus, undefined)
    assert.equal(source(result, 'hotmart').error, undefined)
  }
  f.advance()
  f.payloads.hotmart = hotmart([])
  result = await f.load(date, date, { force: true })
  assert.equal(source(result, 'hotmart').rows.length, 0, 'A healthy removal is authoritative, even after previously known sales')
  f.payloads.hotmart = new Error('synthetic outage after a real empty snapshot')
  f.advance()
  assert.equal(source(await f.load(date, date, { force: true }), 'hotmart').rows.length, 0, 'Failure preserves the latest valid empty snapshot, not an older positive total')
})

test('fees-only partial responses, new unknown sales and explicit foreign currency are accepted without stale fallback', async () => {
  const f = fixture()
  await f.load(date, date)
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(28000, { fee: null })], { net: { complete: true }, fees: { complete: false } })
  let result = await f.load(date, date, { force: true })
  assert.equal(card(result), 199000)
  assert.equal(source(result, 'hotmart').status, 'partial')
  assert.equal(source(result, 'hotmart').cacheStatus, undefined)
  assert.equal(source(result, 'asaas').cacheStatus, undefined, 'Cash-only Asaas is a valid partial response')
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(28000), hotmartSale(null, { transaction: 'new-unknown', netCurrency: null })], { net: { complete: false } })
  result = await f.load(date, date, { force: true })
  assert.equal(source(result, 'hotmart').rows.length, 2)
  assert.equal(source(result, 'hotmart').cacheStatus, undefined, 'New unknown financial fields do not discard valid new records')
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(100, { currency: 'USD', netCurrency: 'USD', feeCurrency: 'USD' })])
  result = await f.load(date, date, { force: true })
  assert.equal(source(result, 'hotmart').cacheStatus, undefined, 'Explicit foreign currency never reuses a former BRL amount for the transaction')
  assert.equal(source(result, 'hotmart').rows[0].net, null)
})

test('Hotmart purchase currency does not erase a previously known BRL net when commission data disappears', async () => {
  const f = fixture()
  f.payloads.hotmart = hotmart([hotmartSale(29000, { currency: 'USD', netCurrency: 'BRL' })])
  assert.equal(card(await f.load(date, date)), 200000)
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(null, { currency: 'USD', netCurrency: null })], { net: { complete: false } })
  const retained = await f.load(date, date, { force: true })
  assert.equal(card(retained), 200000)
  assert.equal(source(retained, 'hotmart').reason, 'financial_incomplete')
  assert.equal(source(retained, 'hotmart').fetchedAt, stamp)
  f.advance()
  f.payloads.hotmart = hotmart([hotmartSale(100, { currency: 'USD', netCurrency: 'USD' })])
  const foreign = await f.load(date, date, { force: true })
  assert.equal(source(foreign, 'hotmart').cacheStatus, undefined)
  assert.equal(source(foreign, 'hotmart').rows[0].net, null)
})

test('no history stays unavailable and range changes never borrow a different day or month', async () => {
  const f = fixture()
  await f.load(date, date)
  f.payloads.hotmart = new Error('synthetic outage')
  for (const [from, to] of [['2026-10-18', '2026-10-18'], ['2026-10-01', date]]) {
    const result = await f.load(from, to)
    assert.equal(source(result, 'hotmart').status, 'unavailable')
    assert.equal(source(result, 'hotmart').fetchedAt, null)
    assert.equal(source(result, 'hotmart').rows.length, 0)
  }
  f.invalidate()
  assert.equal(source(await f.load(date, date), 'hotmart').status, 'unavailable', 'Invalidation starts a new provider generation')
})

test('provider cache and inflight requests are shared while source timestamps and fresh ledger attribution stay separate', async () => {
  const f = fixture()
  const [first, same] = await Promise.all([f.load(date, date), f.load(date, date)])
  assert.equal(first, same)
  const count = f.calls.length
  f.advance(1000)
  assert.equal(await f.load(date, date), first)
  assert.equal(f.calls.length, count)
  const assign = sellerId => async () => ({ manualSales: [], attributions: [{ source: 'hotmart', externalId: 'hotmart-known', sellerId }] })
  const before = await mergeFreshSalesLedger(first, date, date, assign('before'))
  f.payloads.hotmart = new Error('synthetic outage')
  const next = await f.load(date, date, { force: true })
  const after = await mergeFreshSalesLedger(next, date, date, assign('after'))
  assert.equal(before.records.find(row => row.sourceId === 'hotmart').sellerId, 'before')
  assert.equal(after.records.find(row => row.sourceId === 'hotmart').sellerId, 'after')
  assert.equal(source(next, 'hotmart').rows[0].sellerId, undefined, 'Retained provider data never captures an old seller overlay')
})

test('refund source fallback remains visible and explicitly partial', async () => {
  const f = fixture()
  f.payloads.guruRefunds = { success: true, data: [{ id: 'refund-known', status: 'refunded', dates: { created_at: `${date}T15:00:00Z`, canceled_at: `${date}T16:00:00Z` }, calculation_details: { net_amount: 50 } }] }
  await f.load(date, date)
  f.advance()
  f.payloads.guruRefunds = new Error('synthetic refund timeout')
  const result = await f.load(date, date, { force: true })
  const summary = buildRefundSummary(result.sources.flatMap(item => item.rows), result.sources)
  const refund = summary.providers.find(item => item.id === 'guru')
  assert.equal(refund.refundsAvailable, true)
  assert.equal(refund.partial, true)
  assert.equal(refund.confirmed, 1)
  assert.equal(source(result, 'guruRefunds').cacheStatus, 'stale')
})
