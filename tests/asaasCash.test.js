import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSource, EMPTY_FILTERS, filterSales } from '../src/utils/salesData.js'
import { sourceHasSales, sourceFinancialMetadata, asaasCashView } from '../src/utils/sourceAvailability.js'
import { mergePeriodSources, summarizePeriod } from '../src/utils/periodData.js'
import { buildComparisonSnapshot } from '../src/utils/comparisonData.js'

const cashPayload = { success: true, data: { totalGross: 500, totalNet: 495, totalFees: 5, count: 2, sales: null, totalPurchaseValue: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } }
const cashSource = () => ({ id: 'asaas', platform: 'Asaas', label: 'Asaas', kind: 'sale', rows: [], ...sourceFinancialMetadata('asaas', cashPayload.data) })
const range = { startDate: '2026-09-01', endDate: '2026-09-30' }
const guru = normalizeSource('guru', { data: [{ id: 'g1', product: { name: 'DevClub' }, calculation_details: { net_amount: 100, total_amount: 120 }, dates: { created_at: '2026-09-01T12:00:00Z' } }] })
const guruSource = { id: 'guru', platform: 'Guru', kind: 'sale', status: 'ready', rows: guru }
const manualSource = { id: 'manual', platform: 'Manual', kind: 'sale', status: 'ready', rows: [] }

test('cash-only Asaas creates no synthetic sales and preserves its real cash independently', () => {
  assert.deepEqual(normalizeSource('asaas', cashPayload), [])
  const source = cashSource()
  assert.equal(source.status, 'partial')
  assert.equal(sourceHasSales(source), false)
  assert.equal(asaasCashView([source]).net, 495)
  const result = { sources: [source, guruSource, manualSource], records: guru }
  const actual = buildComparisonSnapshot(result, EMPTY_FILTERS, range)
  assert.equal(actual.metrics.revenue.value, 100)
  assert.equal(actual.metrics.count.value, 1)
  assert.equal(actual.metrics.ticket.value, 100)
  assert.equal(actual.metrics.revenue.partial, true)
  assert.equal(actual.sources.find(row => row.id === 'asaas').revenue.value, null)
  assert.equal(summarizePeriod(result.records).total.received.known, 0)
  assert.equal(summarizePeriod(result.records).total.revenue.value, 100)
})

test('Asaas-only filters do not turn unknown contracts into zero; unaffected providers remain complete', () => {
  const result = { sources: [cashSource(), guruSource, manualSource], records: guru }
  const asaas = buildComparisonSnapshot(result, { ...EMPTY_FILTERS, platform: 'Asaas' }, range)
  assert.equal(asaas.metrics.count.value, null)
  assert.equal(asaas.metrics.revenue.value, null)
  assert.equal(asaas.metrics.ticket.value, null)
  const other = buildComparisonSnapshot(result, { ...EMPTY_FILTERS, platform: 'Guru' }, range)
  assert.equal(other.metrics.revenue.value, 100)
  assert.equal(other.metrics.revenue.partial, false)
  assert.equal(asaasCashView(result.sources, { platform: 'Guru' }), null)
  const onlyCash = buildComparisonSnapshot({ sources: [cashSource(), manualSource], records: [] }, EMPTY_FILTERS, range)
  assert.equal(onlyCash.metrics.count.value, null)
  assert.equal(onlyCash.metrics.revenue.value, null)
})

test('cash is not distributed into product, family, payment, offer or UTM filters', () => {
  for (const key of ['family', 'product', 'payment', 'offer', 'source', 'medium', 'campaign', 'content', 'term']) {
    assert.equal(asaasCashView([cashSource()], { [key]: 'any' }).allocationMissing, true)
  }
  assert.equal(asaasCashView([cashSource()], { platform: 'Asaas' }).allocationMissing, false)
  assert.equal(summarizePeriod(filterSales(guru, { product: 'DevClub' })).total.revenue.value, 100)
})

test('annual cash aggregation retains partial sources and adds each queried month only once', () => {
  const results = ['01', '02'].map(month => ({ startDate: `2026-${month}-01`, result: { sources: [cashSource(), guruSource], records: guru } }))
  const sources = mergePeriodSources(results, true)
  const asaas = sources.find(row => row.id === 'asaas')
  assert.equal(asaas.status, 'partial')
  assert.equal(asaas.salesAvailable, false)
  assert.equal(asaas.failures, 0)
  assert.deepEqual(asaas.cash, { gross: 1000, net: 990, fees: 10, count: 4, availablePeriods: 2, periods: 2 })
  assert.equal(asaasCashView(sources).partial, false)
  assert.equal(summarizePeriod(sources.flatMap(row => row.rows)).total.revenue.value, 200)
  assert.equal(sources.find(row => row.id === 'guru').status, 'ready')
  results.push({ startDate: '2026-03-01', result: { sources: [{ id: 'asaas', platform: 'Asaas', kind: 'sale', status: 'unavailable', rows: [] }], records: [] } })
  const partial = asaasCashView(mergePeriodSources(results, true))
  assert.equal(partial.net, 990)
  assert.equal(partial.availablePeriods, 2)
  assert.equal(partial.periods, 3)
  assert.equal(partial.partial, true)
})

test('a zero cash response remains known while malformed metadata cannot manufacture cash', () => {
  const zero = { ...cashPayload.data, totalGross: 0, totalNet: 0, totalFees: 0, count: 0 }
  assert.equal(sourceFinancialMetadata('asaas', zero).cash.net, 0)
  assert.equal(sourceFinancialMetadata('asaas', zero).salesAvailable, false)
  assert.throws(() => sourceFinancialMetadata('asaas', { ...zero, totalNet: null }), /indisponível/)
  assert.throws(() => normalizeSource('asaas', { data: { sales: null } }), /Vendas indisponíveis/)
  assert.deepEqual(sourceFinancialMetadata('guru', cashPayload.data), { status: 'ready' })
})
