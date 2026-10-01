import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPlatformCashRule } from '../src/utils/platformCash.js'
import { normalizeSource, filterSales, paymentLabel } from '../src/utils/salesData.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'
import { buildRevenueBreakdown, buildRevenueNotices } from '../src/utils/revenueBreakdown.js'
import { mergeSalesOperations, saleSnapshot } from '../src/services/salesOpsService.js'
import { sourceFinancialMetadata } from '../src/utils/sourceAvailability.js'

const source = (id, extra = {}) => ({ id, platform: id === 'guru' ? 'Guru' : 'Hotmart', label: id, kind: 'sale', status: 'ready', ...extra })
const date = '2026-10-01T01:00:00Z'
const guru = (net = 1500) => normalizeSource('guru', { data: [{ id: 'g1', product: { name: 'DevClub' }, payment: { method: 'credit_card', total: 1997 }, dates: { created_at: date }, calculation_details: { total_amount: 1997, net_amount: net, discounts: { mdr: 497 } } }] })[0]
const hotmart = (net = 1882.68) => normalizeSource('hotmart', { data: { count: 1, totalGross: 1997, totalNet: net, totalFees: 114.32,
  transactions: [{ transaction: 'h1', product: 'DevClub', orderDate: date, paymentMethod: 'CREDIT_CARD_MASTERCARD', grossValue: 1997, netValue: net, fee: 114.32, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL' }] } })[0]
const pace = (data, scope = 'overall', scopeId = '') => calculateGoalPace({ ...data, year: 2026, month: 9, today: '2026-09-30', plan: { metric: 'cash', scope, scopeId, target: 10000 } })

test('Guru and Hotmart cash use the complete backend net without a second deduction, including zero', () => {
  for (const row of [guru(), hotmart(), guru(0), hotmart(0)]) {
    assert.equal(row.received, row.net)
    assert.equal(row.cashRule, 'platform_net_100_percent')
    assert.equal(saleSnapshot(row).cashCollected, row.net)
    assert.deepEqual(applyPlatformCashRule(applyPlatformCashRule(row)), row)
  }
  assert.equal(hotmart().received, 1882.68)
  assert.equal(hotmart().gross, 1997)
  for (const value of [null, undefined, '', ' ', false, Infinity, 'bad']) assert.equal(applyPlatformCashRule({ kind: 'sale', sourceId: 'guru', net: value }).received, null)
  const manual = { kind: 'sale', sourceId: 'manual', platform: 'Guru', isManual: true, net: 1000, received: 200 }
  assert.strictEqual(applyPlatformCashRule(manual), manual)
  const refund = { kind: 'refund', sourceId: 'guruRefunds', net: 1000 }
  assert.strictEqual(applyPlatformCashRule(refund), refund)
})

test('platform cash follows Brazil sale dates and the same product/team/seller attribution without duplicates', () => {
  const ledger = { attributions: [{ source: 'guru', externalId: 'g1', sellerId: 'ana' }, { source: 'hotmart', externalId: 'h1', sellerId: 'bia' }],
    manualSales: [{ id: 'linked', platform: 'Guru', net: 1500, cashCollected: 1500, linkedSource: 'guru', linkedExternalId: 'g1' }] }
  const rows = mergeSalesOperations([guru(), hotmart()], ledger)
  const data = prepareGoalData({ records: rows, sources: [source('guru'), source('hotmart')] }, { individuals: [{ id: 'ana', teamId: 'closers' }, { id: 'bia', teamId: 'closers' }] })
  assert.equal(data.cashRecords.length, 2)
  assert.equal(Number(pace(data).actual.toFixed(2)), 3382.68)
  assert.equal(Number(pace(data).rows[29].dailyActual.toFixed(2)), 3382.68)
  assert.equal(Number(pace(data, 'product', 'DevClub').actual.toFixed(2)), 3382.68)
  assert.equal(Number(pace(data, 'team', 'closers').actual.toFixed(2)), 3382.68)
  assert.equal(pace(data, 'individual', 'ana').actual, 1500)
  assert.equal(pace(data).definitive, true)
  assert.equal(buildRevenueBreakdown(filterSales(rows, { platform: 'Hotmart' }), [source('guru'), source('hotmart')], { platform: 'Hotmart' }).cash.value, 1882.68)
})

test('partial or missing platform net remains explicit, and source outages never turn cash into zero', () => {
  assert.equal(buildRevenueBreakdown([], [source('guru')]).cash.value, 0)
  assert.equal(buildRevenueBreakdown([], [source('guru', { status: 'unavailable' })]).cash.value, null)
  const missing = buildRevenueBreakdown([guru(null)], [source('guru')])
  assert.equal(missing.cash.value, null)
  assert.equal(missing.cash.partial, true)
  for (const status of ['partial', 'stale']) {
    const data = prepareGoalData({ records: [guru()], sources: [source('guru', { status })] })
    assert.equal(pace(data).actual, 1500)
    assert.equal(pace(data).definitive, false)
  }
  const undated = prepareGoalData({ records: [{ ...guru(), date: null }], sources: [source('guru')] })
  assert.equal(pace(undated).actual, 1500)
  assert.equal(pace(undated).unallocated, 1500)
  assert.equal(pace(undated).definitive, false)
  assert.ok(buildRevenueNotices([source('guru')]).some(item => item.id === 'platform-net-cash'))
})

test('actual Hotmart card brands are counted as cards while PIX and boleto retain their classifications', () => {
  for (const method of ['CREDIT_CARD_MASTERCARD', 'CREDIT_CARD_VISA', 'CREDIT_CARD_ELO']) assert.equal(paymentLabel(method), 'Cartão')
  assert.equal(paymentLabel('PIX'), 'Pix')
  assert.equal(paymentLabel('BILLET'), 'Boleto')
  assert.equal(buildRevenueBreakdown([hotmart()], [source('hotmart')]).payments.card.value, 1882.68)
})

test('Hotmart foreign currencies are never relabeled as reais in either current or old cached totals', () => {
  const domestic = { transaction: 'brl', grossValue: 1997, netValue: 1882.68, fee: 114.32, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', orderDate: date }
  const foreign = { transaction: 'foreign', grossValue: 102.39, netValue: 89.32, fee: 9.27, currency: 'EUR', netCurrency: 'USD', feeCurrency: 'EUR', orderDate: date }
  for (const version of [undefined, 2]) {
    const data = { financialSchemaVersion: version, count: 2, totalGross: version ? 1997 : 2099.39, totalNet: version ? 1882.68 : 1972, totalFees: version ? 114.32 : 123.59, transactions: [domestic, foreign],
      ...(version ? { financialCoverage: { gross: { complete: false }, net: { complete: false }, fees: { complete: false } } } : {}) }
    const records = normalizeSource('hotmart', { data })
    assert.equal(records.length, 2)
    assert.deepEqual([records[1].gross, records[1].net, records[1].fees, records[1].received], [null, null, null, null])
    assert.equal(records[1].original.netValue, 89.32)
    const sources = [source('hotmart', sourceFinancialMetadata('hotmart', data))]
    const model = buildRevenueBreakdown(records, sources)
    assert.equal(model.revenue.value, 1882.68)
    assert.equal(model.cash.value, 1882.68)
    assert.equal(model.cash.partial, true)
    assert.equal(model.revenue.count, 2)
    assert.ok(buildRevenueNotices(sources, {}, { records }).some(item => item.id === 'foreign-currency'))
  }
})

test('Hotmart respects independent purchase/commission currencies, and unknown net stays unknown', () => {
  const data = { financialSchemaVersion: 2, count: 1, totalGross: null, totalNet: 500, totalFees: null,
    transactions: [{ transaction: 'converted-by-source', grossValue: 100, currency: 'USD', netValue: 500, netCurrency: 'BRL', fee: 5, feeCurrency: 'USD', orderDate: date }] }
  const row = normalizeSource('hotmart', { data })[0]
  assert.equal(row.gross, null)
  assert.equal(row.net, 500)
  assert.equal(row.received, 500)
  const unknown = normalizeSource('hotmart', { data: { financialSchemaVersion: 2, count: 1, totalGross: 1997, totalNet: null, totalFees: 114.32,
    transactions: [{ transaction: 'unknown-net', grossValue: 1997, currency: 'BRL', netValue: null, netCurrency: null, fee: 114.32, feeCurrency: 'BRL', orderDate: date }] } })[0]
  assert.equal(unknown.gross, 1997)
  assert.equal(unknown.net, null)
  assert.equal(unknown.received, null)
})

test('Guru refund charts prefer the actual cancellation date without turning a refund into cash', () => {
  const [row] = normalizeSource('guruRefunds', { data: [{ id: 'refund-1', status: 'refunded', payment: { total: 1997, currency: 'BRL' },
    dates: { created_at: '2026-08-01T12:00:00Z', canceled_at: '2026-09-30T12:00:00Z' }, calculation_details: { total_amount: 1997, net_amount: 1500 } }] })
  assert.equal(row.date, '2026-09-30T12:00:00.000Z')
  assert.equal(row.kind, 'refund')
  assert.equal(row.received, null)
})
