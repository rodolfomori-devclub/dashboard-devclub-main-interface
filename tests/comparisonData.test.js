import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_FILTERS, SOURCE_DEFINITIONS, normalizeSource } from '../src/utils/salesData.js'
import { mergeSalesOperations } from '../src/services/salesOpsService.js'
import { summarizePeriod } from '../src/utils/periodData.js'
import { buildComparisonSnapshot, compareMetrics, comparisonGroups, comparisonRangeLength, comparisonSeries, validateComparisonRanges } from '../src/utils/comparisonData.js'

const range = { startDate: '2026-09-10', endDate: '2026-09-10' }
const date = '2026-09-10T12:00:00Z'
const manual = { id: 'm1', date: '2026-09-10', platform: 'Guru', product: 'DevClub', family: 'DevClub', gross: 60, net: 50, cashCollected: 10 }
function fixture({ failed = [], manuals = [manual], empty = false } = {}) {
  const payloads = {
    guru: { data: [{ id: 'g1', product: { name: 'DevClub' }, dates: { created_at: Date.parse(date) / 1000 }, payment: { total: 120 }, calculation_details: { net_amount: 90, total_amount: 120, net_affiliate_value: 20 } }] },
    tmb: { success: true, data: [{ id: 'tmb-42-0', raw: { pedido_id: 42 }, product: 'IAClub', value: 200, timestamp: date }] },
    asaas: { success: true, data: { totalGross: 99999, sales: { count: 1, totalValue: 1000, entryValue: 100, entries: [{ totalValue: 1000, entryValue: 100, createdAt: date, productDescription: 'DevClub' }] } } },
    boletex: { success: true, data: { sales: { count: 1, totalValue: 600, confirmedValue: 200, pendingValue: 400, listPriceValue: 500, entries: [{ id: 'b1', totalValue: 600, entryValue: 200, pendingValue: 400, listPrice: 500, createdAt: date, productDescription: 'MBA' }] } } },
    hotmart: { success: true, data: { count: 1, totalNet: 180, totalGross: 200, totalFees: 20, transactions: [{ transaction: 'h1', product: 'DevClub', orderDate: date, grossValue: 200, netValue: 180, fee: 20, paymentMethod: 'PIX' }] } },
    guruRefunds: { data: [{ id: 'r1', dates: { created_at: Date.parse(date) / 1000 }, product: { name: 'DevClub' }, calculation_details: { net_amount: 40, total_amount: 50 } }] },
    hotmartRefunds: { success: true, data: { count: 0, totalRefundAmount: 0, transactions: [] } },
  }
  const sources = SOURCE_DEFINITIONS.map(source => ({ ...source, status: failed.includes(source.id) ? 'unavailable' : 'ready', rows: failed.includes(source.id) || empty ? [] : normalizeSource(source.id, payloads[source.id]) }))
  const records = mergeSalesOperations(sources.flatMap(source => source.rows), { manualSales: failed.includes('manual') ? [] : manuals })
  sources.push({ id: 'manual', label: 'Vendas manuais', platform: 'Manual', kind: 'sale', status: failed.includes('manual') ? 'unavailable' : 'ready', rows: records.filter(row => row.isManual) })
  return { sources, records, fetchedAt: 1 }
}
const snapshot = (result, filters = {}, selectedRange = range) => buildComparisonSnapshot(result, { ...EMPTY_FILTERS, ...filters }, selectedRange)

test('comparison preserves the shared operational contract, cash separation and manual reconciliation', () => {
  const result = fixture({ manuals: [manual, { ...manual, id: 'linked', linkedExternalId: 'g1' }] })
  const actual = snapshot(result)
  assert.equal(actual.metrics.revenue.value, 2120)
  assert.equal(actual.metrics.revenue.value, summarizePeriod(result.records).total.revenue.value)
  assert.equal(actual.metrics.count.value, 6)
  assert.equal(actual.metrics.ticket.value, 2120 / 6)
  assert.equal(actual.metrics.received.value, 310 + 80)
  assert.equal(actual.metrics.received.partial, true)
  assert.equal(actual.metrics.net.value, 320)
  assert.equal(actual.metrics.net.partial, true)
  assert.equal(actual.metrics.refund.value, 40)
  assert.equal(actual.sources.find(source => source.id === 'guru').revenue.value, 90)
  assert.equal(actual.sources.find(source => source.id === 'manual').revenue.value, 50)
})

test('platform filters include matching manuals without merging their source identity', () => {
  const actual = snapshot(fixture(), { platform: 'Guru' })
  assert.equal(actual.metrics.revenue.value, 140)
  assert.equal(actual.metrics.count.value, 2)
  assert.equal(actual.metrics.revenue.partial, false)
  assert.deepEqual(actual.sources.map(source => source.id), ['guru', 'guruRefunds', 'manual'])
  assert.equal(snapshot(fixture(), { family: 'MBA' }).metrics.revenue.value, 600)
})

test('unavailable sources do not become zero, and empty manual ledger cannot mask their failure', () => {
  const allPlatforms = SOURCE_DEFINITIONS.map(source => source.id)
  const allFailed = snapshot(fixture({ failed: allPlatforms, manuals: [] }))
  assert.equal(allFailed.metrics.revenue.value, null)
  assert.equal(allFailed.metrics.count.value, null)
  assert.equal(allFailed.sources.find(source => source.id === 'manual').count.value, 0)
  const justManual = snapshot(fixture({ failed: allPlatforms }))
  assert.equal(justManual.metrics.revenue.value, 50)
  assert.equal(justManual.metrics.revenue.partial, true)
  assert.equal(snapshot(fixture({ empty: true, manuals: [] })).metrics.revenue.value, 0)
  assert.equal(snapshot(fixture({ empty: true, manuals: [] })).metrics.ticket.value, null)
})

test('differences respect A minus B, zero base, missing values and partial coverage', () => {
  assert.deepEqual(compareMetrics({ value: 120 }, { value: 100 }), { absolute: 20, percent: 20, reason: null })
  assert.deepEqual(compareMetrics({ value: 0 }, { value: 100 }), { absolute: -100, percent: -100, reason: null })
  assert.deepEqual(compareMetrics({ value: 120 }, { value: 0 }), { absolute: 120, percent: null, reason: 'zero-base' })
  assert.equal(compareMetrics({ value: 0 }, { value: 0 }).percent, null)
  assert.equal(compareMetrics({ value: null }, { value: 100 }).absolute, null)
  assert.equal(compareMetrics({ value: 120, partial: true }, { value: 100 }).reason, 'partial')
  const partial = snapshot(fixture({ failed: ['boletex'] }))
  assert.equal(partial.metrics.revenue.value, 1520)
  assert.equal(partial.metrics.revenue.partial, true)
  assert.equal(compareMetrics(partial.metrics.revenue, snapshot(fixture()).metrics.revenue).absolute, null)
})

test('ranges use inclusive days, validate actual dates and retain equal-length comparison', () => {
  assert.equal(validateComparisonRanges(range, range), 1)
  assert.equal(comparisonRangeLength({ startDate: '2024-02-28', endDate: '2024-03-01' }), 3)
  assert.throws(() => validateComparisonRanges(range, { ...range, endDate: '2026-09-11' }), /mesma duração/)
  assert.throws(() => comparisonRangeLength({ startDate: '2026-02-30', endDate: '2026-03-01' }), /datas válidas/)
  assert.throws(() => comparisonRangeLength({ startDate: '2026-09-11', endDate: '2026-09-10' }), /datas válidas/)
  assert.throws(() => validateComparisonRanges({ startDate: '2024-01-01', endDate: '2025-01-01' }, { startDate: '2024-01-01', endDate: '2025-01-01' }), /366/)
})

test('relative-day charts keep manual sales on their day and hourly charts exclude invented manual times', () => {
  const a = snapshot(fixture(), {}, { startDate: '2026-09-10', endDate: '2026-09-11' })
  const b = snapshot(fixture({ empty: true, manuals: [] }), {}, { startDate: '2026-08-01', endDate: '2026-08-02' })
  const daily = comparisonSeries(a, b)
  assert.equal(daily.rows.length, 2)
  assert.equal(daily.rows[0].aDate, '2026-09-10')
  assert.equal(daily.rows[0].bDate, '2026-08-01')
  assert.equal(daily.rows[0].label, 'Dia 1')
  assert.equal(daily.rows[0].aRevenue, 2120)
  assert.equal(daily.rows[0].bRevenue, 0)
  const hourly = comparisonSeries(a, b, { hourly: true })
  assert.equal(hourly.rows.reduce((sum, row) => sum + row.aRevenue, 0), 2070)
  assert.equal(hourly.omittedA, 1)
  assert.equal(hourly.rows[9].aCount, 5)
})

test('unknown consolidated balances remain visible without invented product or daily distribution', () => {
  const result = fixture({ empty: true, manuals: [] })
  const rows = normalizeSource('asaas', { success: true, data: { sales: { count: 2, totalValue: 1000, entryValue: 100, entries: [{ totalValue: 500, entryValue: 50, productDescription: 'DevClub', createdAt: date }] } } })
  result.records = rows
  const a = snapshot(result)
  const b = snapshot(fixture({ empty: true, manuals: [] }))
  assert.equal(a.metrics.revenue.value, 1000)
  assert.equal(comparisonSeries(a, b).rows[0].aRevenue, 500)
  assert.equal(comparisonSeries(a, b).omittedA, 1)
  const selected = snapshot(result, { product: 'DevClub' })
  assert.equal(selected.metrics.revenue.value, 500)
  assert.equal(selected.metrics.revenue.partial, true)
  assert.equal(selected.omittedAggregates, 1)
  const product = comparisonGroups(a, b).find(row => row.name === 'DevClub')
  assert.equal(product.a.revenue.value, 500)
  assert.equal(product.revenueDelta.reason, 'partial')
})

test('missing transaction amounts produce chart gaps, while valid counts remain', () => {
  const result = fixture({ empty: true, manuals: [] })
  result.records = normalizeSource('guru', { data: [{ id: 'unknown', product: { name: 'DevClub' }, dates: { created_at: Date.parse(date) / 1000 } }] })
  const a = snapshot(result)
  const b = snapshot(fixture({ empty: true, manuals: [] }))
  assert.equal(a.metrics.revenue.value, null)
  assert.equal(a.metrics.count.value, 1)
  assert.equal(comparisonSeries(a, b).rows[0].aRevenue, null)
  assert.equal(comparisonSeries(a, b, { hourly: true }).rows[9].aRevenue, null)
  assert.equal(comparisonSeries(a, b, { hourly: true }).rows[9].aCount, 1)
})

test('unidentified products also mark product-filter results as partial without allocating their value', () => {
  const result = fixture({ empty: true, manuals: [] })
  result.records = normalizeSource('guru', { data: [
    { id: 'named', product: { name: 'DevClub' }, calculation_details: { net_amount: 100 } },
    { id: 'unnamed', calculation_details: { net_amount: 50 } },
  ] })
  const named = snapshot(result, { product: 'DevClub' })
  assert.equal(named.metrics.revenue.value, 100)
  assert.equal(named.metrics.revenue.partial, true)
  assert.equal(named.allocationMissing, true)
  assert.equal(snapshot(result).metrics.revenue.value, 150)
})
