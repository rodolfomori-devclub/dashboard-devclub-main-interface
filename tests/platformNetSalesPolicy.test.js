import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPlatformCashRule, isNetSalesPlatform } from '../src/utils/platformCash.js'
import { normalizeSource, sumAmount, summarizeSales, groupSales, hourlySales } from '../src/utils/salesData.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { buildTvData } from '../src/components/tv/tvData.js'
import { mergeSalesOperations, manualSaleRecord, saleSnapshot } from '../src/services/salesOpsService.js'
import { enrichPeriodRecord, periodSeries } from '../src/utils/periodData.js'
import { normalizePeriodSnapshot } from '../src/services/periodSalesService.js'
import { buildRefundSummary } from '../src/utils/refundSummary.js'
import { sourceFinancialMetadata } from '../src/utils/sourceAvailability.js'

const date = '2026-10-01T15:00:00Z'
const source = id => ({ id, kind: 'sale', status: 'ready', platform: id === 'guru' ? 'Guru' : 'Hotmart' })
const sale = (sourceId, net, extra = {}) => ({ id: `${sourceId}:fixture`, sourceId, platform: source(sourceId).platform,
  kind: 'sale', quantity: 1, gross: 1997, net, revenue: 1997, received: 1997, listPrice: 2497,
  fees: 119.82, date, family: 'DevClub', product: 'DevClub', payment: 'Cartão', sellerId: 'ana', utm: {}, ...extra })
const directory = { individuals: [{ id: 'ana', name: 'Ana', teamId: 'sales' }], teams: [{ id: 'sales', name: 'Comercial' }] }

for (const provider of ['guru', 'hotmart']) {
  test(`${provider}: all financial consumers reapply authoritative net to old/raw records without deducting fees twice`, () => {
    const input = sale(provider, 1877.18)
    const original = structuredClone(input)
    const rows = [input], sources = [source(provider)]
    const prepared = prepareGoalData({ records: rows, sources }, directory)
    const daily = buildRevenueBreakdown(rows, sources)
    const tv = buildTvData({ sales: { records: rows, sources }, directory, year: 2026, month: 10, today: '2026-10-01' })
    for (const metric of ['gross', 'net', 'revenue', 'received']) {
      assert.equal(sumAmount(rows, metric).value, 1877.18)
      assert.equal(summarizeSales(rows)[metric].value, 1877.18)
    }
    assert.equal(groupSales(rows, 'product')[0].gross.value, 1877.18)
    assert.equal(hourlySales(rows).hours[12].value, 1877.18)
    assert.equal(hourlySales(rows, { valueField: 'quantity' }).hours[12].value, 1, 'quantity plots are not replaced by currency')
    assert.equal(periodSeries(rows, '2026-10-01', '2026-10-01').rows[0].revenue, 1877.18)
    assert.equal(enrichPeriodRecord(input).gross, 1877.18)
    assert.equal(daily.gross.value, 1877.18)
    assert.equal(daily.cash.value, 1877.18)
    assert.equal(daily.payments.card.value, 1877.18)
    assert.equal(tv.overview.gross, 1877.18)
    assert.equal(tv.sellers[0].gross, 1877.18)
    assert.equal(tv.products[0].gross, 1877.18)
    assert.equal(tv.daily.hours[12].gross, 1877.18)
    assert.equal(tv.daily.hours[12].cash, 1877.18)
    for (const metric of ['gross', 'cash', 'net', 'operational']) {
      const pace = calculateGoalPace({ ...prepared, year: 2026, month: 10, today: '2026-10-01', plan: { scope: 'overall', metric } })
      assert.equal(pace.actual, 1877.18, metric)
    }
    assert.equal(saleSnapshot(input).gross, 1877.18)
    assert.equal(saleSnapshot(input).cashCollected, 1877.18)
    assert.equal(summarizeSales(rows).listPrice.known, 0, 'no digital list price leaks into cross-platform totals')
    assert.deepEqual(input, original, 'private original provider evidence is immutable')
    assert.deepEqual(applyPlatformCashRule(applyPlatformCashRule(input)), applyPlatformCashRule(input))
  })

  test(`${provider}: missing net never falls back to gross, previous cash or a percentage estimate; explicit zero survives`, () => {
    for (const net of [null, undefined, '', ' ', false, Infinity, 'invalid']) {
      const input = sale(provider, net)
      const normalized = applyPlatformCashRule(input)
      for (const key of ['gross', 'net', 'revenue', 'received', 'listPrice']) assert.equal(normalized[key], null, key)
      assert.equal(buildRevenueBreakdown([input], [source(provider)]).gross.value, null)
      assert.equal(hourlySales([input]).hours[12].value, null)
    }
    const zero = applyPlatformCashRule(sale(provider, 0))
    assert.deepEqual([zero.gross, zero.net, zero.revenue, zero.received], [0, 0, 0, 0])
    assert.equal(buildRevenueBreakdown([zero], [source(provider)]).gross.partial, false)
  })
}

test('manual Guru/Hotmart obey the same net rule, and reconciliation still removes their duplicate', () => {
  for (const platform of ['Guru', ' hotMART ']) {
    assert.equal(isNetSalesPlatform(platform), true)
    const manual = { id: 'manual-one', platform, date: '2026-10-01', gross: 1997, net: 1877.18, cashCollected: 100, family: 'DevClub' }
    const result = manualSaleRecord(manual)
    assert.deepEqual([result.gross, result.revenue, result.received], [1877.18, 1877.18, 1877.18])
    const merged = mergeSalesOperations([sale('hotmart', 1877.18)], { manualSales: [{ ...manual, linkedExternalId: 'fixture' }] })
    assert.equal(merged.length, 1)
    assert.equal(merged[0].gross, 1877.18)
    assert.equal(manualSaleRecord({ ...manual, net: null }).gross, null)
  }
})

test('old cached Hotmart payloads read through the new net policy without rewriting historical source payloads', () => {
  const payload = { success: true, data: { count: 1, totalGross: 1997, totalNet: 1877.18, totalFees: 119.82,
    transactions: [{ transaction: 'fixture', product: 'DevClub', orderDate: date, grossValue: 1997, netValue: 1877.18,
      fee: 119.82, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL' }] } }
  const snapshot = { requested: { startDate: '2026-10-01', endDate: '2026-10-01' }, pending: 0, completed: 1, total: 1,
    segments: [{ startDate: '2026-10-01', endDate: '2026-10-01', kind: 'today', sources: [{ id: 'hotmart', status: 'ready', payload }] }] }
  const result = normalizePeriodSnapshot(snapshot)
  const row = result.records.find(row => row.sourceId === 'hotmart')
  assert.equal(row.gross, 1877.18)
  assert.equal(row.revenue, 1877.18)
  assert.equal(row.received, 1877.18)
  assert.equal(payload.data.transactions[0].grossValue, 1997)
  const missing = structuredClone(payload)
  missing.data.totalNet = null; missing.data.transactions[0].netValue = null
  assert.equal(normalizeSource('hotmart', missing)[0].gross, null)
})

test('TMB contract and forty percent cash, Asaas new entry, and manual other platforms remain unchanged', () => {
  const rows = [sale('tmb', null, { platform: 'TMB', gross: 3000, revenue: 3000 }),
    sale('asaas', null, { platform: 'Asaas', gross: 2000, revenue: 2000, received: 200 }),
    manualSaleRecord({ id: 'pix', platform: 'Pix direto', date: '2026-10-01', gross: 100, net: 90, cashCollected: 80 })]
  const sources = [source('tmb'), source('asaas'), source('manual')]
  const data = prepareGoalData({ records: rows, sources })
  assert.deepEqual(data.records.map(row => row.gross), [3000, 2000, 100])
  assert.deepEqual(data.cashRecords.map(row => row.received), [1200, 200, 80])
})

test('refunded digital purchase details require authorized net while actual returned cash remains independent', () => {
  const records = [{ platform: 'hotmart', kind: 'confirmed', status: 'refunded', saleAmount: 1997, refundAmount: 1997, currency: 'BRL' }]
  const sources = [{ id: 'hotmart', status: 'ready' }]
  const unknown = buildRefundSummary(records, sources, { overview: true })
  assert.equal(unknown.purchase.unknown, 1)
  assert.deepEqual(unknown.purchase.values, [])
  assert.deepEqual(unknown.refunded.values, [{ currency: 'BRL', value: 1997 }])
  const known = buildRefundSummary([{ ...records[0], saleNetAmount: 1877.18 }], sources, { overview: true })
  assert.deepEqual(known.purchase.values, [{ currency: 'BRL', value: 1877.18 }])
  assert.deepEqual(known.refunded.values, [{ currency: 'BRL', value: 1997 }])
})

test('legacy cached Hotmart refunds cannot reintroduce the purchase gross through tables, CSV or period series', () => {
  const payload = { success: true, data: { count: 1, totalRefundAmount: 1997,
    transactions: [{ transaction: 'refund-old', product: 'DevClub', orderDate: date, status: 'REFUNDED', value: 1997, currency: 'BRL' }] } }
  const snapshot = { requested: { startDate: '2026-10-01', endDate: '2026-10-01' }, pending: 0, completed: 1, total: 1,
    segments: [{ startDate: '2026-10-01', endDate: '2026-10-01', kind: 'today', sources: [{ id: 'hotmartRefunds', status: 'ready', payload }] }] }
  const result = normalizePeriodSnapshot(snapshot)
  const refund = result.records.find(row => row.sourceId === 'hotmartRefunds')
  assert.deepEqual([refund.gross, refund.net, refund.revenue], [null, null, null])
  assert.equal(periodSeries(result.records, '2026-10-01', '2026-10-01').rows[0].refund, null)
  assert.equal(result.sources.find(source => source.id === 'hotmartRefunds').status, 'partial')
  assert.equal(buildRefundSummary(result.records, result.sources).purchase.unknown, 1)
  assert.equal(payload.data.transactions[0].value, 1997, 'private historical evidence remains unchanged')
})

test('explicit Hotmart refund purchase net and actual refund are separate, including zero and distinct currencies', () => {
  for (const netValue of [1877.18, 0]) {
    const payload = { data: { count: 1, totalRefundAmount: 1997, transactions: [{ transaction: 'refund-net', value: 1997,
      netValue, netCurrency: 'BRL', refundAmount: 100, refundCurrency: 'USD', currency: 'BRL', status: 'PARTIALLY_REFUNDED', orderDate: date }] } }
    const rows = normalizeSource('hotmartRefunds', payload)
    assert.equal(rows.length, 1)
    assert.deepEqual([rows[0].gross, rows[0].net, rows[0].revenue], [netValue, netValue, netValue])
    const model = buildRefundSummary(rows, [{ id: 'hotmartRefunds', status: 'ready' }])
    assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: netValue }])
    assert.deepEqual(model.refunded.values, [{ currency: 'USD', value: 100 }])
    assert.equal(sourceFinancialMetadata('hotmartRefunds', payload.data).status, 'ready')
  }
  const rows = normalizeSource('hotmartRefunds', { data: { count: 1, transactions: [{ transaction: 'foreign-net',
    netValue: 40, netCurrency: 'USD', value: 1997, currency: 'BRL', status: 'REFUNDED', orderDate: date }] } })
  assert.equal(rows[0].revenue, null, 'foreign net never enters BRL operational totals')
  assert.deepEqual(buildRefundSummary(rows, [{ id: 'hotmartRefunds', status: 'partial' }]).purchase.values, [{ currency: 'USD', value: 40 }])
})
