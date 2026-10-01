import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSource, filterSales, UNKNOWN } from '../src/utils/salesData.js'
import { enrichPeriodRecord, summarizePeriod, periodSeries, goalProgress, monthRanges } from '../src/utils/periodData.js'

const date = '2026-09-10T12:00:00Z'
function fixture() {
  const sources = {
    guru: { data: [{ id: 'g1', status: 'approved', dates: { created_at: Date.parse(date) / 1000 }, product: { name: 'DevClub' }, payment: { method: 'credit_card', total: 120 }, trackings: { utm_source: 'comercial' }, calculation_details: { net_amount: 90, total_amount: 120, net_affiliate_value: 20, discounts: { fee: 10 } } }] },
    tmb: { success: true, data: [{ id: 'tmb-42-0', raw: { pedido_id: 42 }, product: 'IAClub', value: 200, timestamp: date }] },
    asaas: { success: true, data: { totalGross: 99999, totalNet: 99990, sales: { count: 1, totalValue: 1000, entryValue: 100, entries: [{ totalValue: 1000, entryValue: 100, createdAt: date, productDescription: 'DevClub' }] } } },
    boletex: { success: true, data: { sales: { count: 1, totalValue: 600, confirmedValue: 200, pendingValue: 400, listPriceValue: 500, entries: [{ id: 'b1', totalValue: 600, entryValue: 200, pendingValue: 400, listPrice: 500, createdAt: date, productDescription: 'MBA' }] } } },
    hotmart: { success: true, data: { count: 1, totalNet: 180, totalGross: 200, totalFees: 20, transactions: [{ transaction: 'h1', product: 'DevClub', orderDate: Date.parse(date), grossValue: 200, netValue: 180, fee: 20, paymentMethod: 'PIX' }] } },
    guruRefunds: { data: [{ id: 'r1', dates: { created_at: Date.parse(date) / 1000 }, product: { name: 'DevClub' }, calculation_details: { net_amount: 40, total_amount: 50, net_affiliate_value: 5 } }] },
  }
  return Object.entries(sources).flatMap(([id, payload]) => normalizeSource(id, payload).map(enrichPeriodRecord))
}

test('unfiltered operational total preserves per-platform financial contracts without adding cash twice', () => {
  const actual = summarizePeriod(fixture())
  // Previous contract: Guru liquid + TMB contracted + Asaas sales.totalValue +
  // Boletex sales.totalValue + Hotmart liquid. Financial receipts are separate.
  assert.equal(actual.total.revenue.value, 90 + 200 + 1000 + 600 + 180)
  assert.equal(actual.digital.revenue.value, 90 + 180)
  assert.equal(actual.boleto.revenue.value, 200 + 1000 + 600)
  assert.equal(actual.total.count, 5)
  assert.equal(actual.total.received.value, 100 + 200)
  assert.equal(actual.total.pending.value, 400)
  assert.equal(actual.total.listPrice.value, 500)
  assert.equal(actual.total.affiliate.value, 20)
  assert.equal(actual.commercial.revenue.value, 90)
  assert.equal(actual.refund.revenue.value, 40)
  assert.equal(actual.ticket, 2070 / 5)
})

test('filters use actual transactions by product/family/platform/payment, never a proportional estimate', () => {
  const records = fixture()
  assert.equal(summarizePeriod(filterSales(records, { family: 'DevClub' })).total.revenue.value, 1270)
  assert.equal(summarizePeriod(filterSales(records, { platform: 'Asaas' })).total.revenue.value, 1000)
  assert.equal(summarizePeriod(filterSales(records, { payment: 'Pix' })).total.revenue.value, 180)
  assert.equal(summarizePeriod(filterSales(records, { product: 'MBA' })).total.received.value, 200)
})

test('undetailed consolidated balances stay visible but are never allocated to a named product or day', () => {
  const records = normalizeSource('asaas', { success: true, data: { sales: { count: 2, totalValue: 1000, entryValue: 100, entries: [{ totalValue: 500, entryValue: 50, productDescription: 'DevClub', createdAt: date }] } } }).map(enrichPeriodRecord)
  assert.equal(summarizePeriod(records).total.revenue.value, 1000)
  assert.equal(summarizePeriod(filterSales(records, { product: 'DevClub' })).total.revenue.value, 500)
  assert.equal(summarizePeriod(filterSales(records, { product: UNKNOWN })).total.revenue.value, 500)
  const chart = periodSeries(records, '2026-09-01', '2026-09-30')
  assert.equal(chart.undated, 1)
  assert.equal(chart.rows.reduce((sum, row) => sum + row.revenue, 0), 500)
})

test('daily and yearly charts preserve observed totals, months and source identities', () => {
  const records = fixture()
  const daily = periodSeries(records, '2026-09-01', '2026-09-30')
  const annual = periodSeries(records, '2026-01-01', '2026-12-31', true)
  assert.equal(daily.rows.length, 30)
  assert.equal(annual.rows.length, 12)
  assert.equal(daily.rows.reduce((sum, row) => sum + row.revenue, 0), 2070)
  assert.equal(annual.rows[8].revenue, 2070)
  assert.equal(annual.rows[8].refund, 40)
  assert.equal(annual.rows[8].affiliate, 20)
})

test('month queries cover leap days and goal pace clamps future/completed periods', () => {
  assert.deepEqual(monthRanges('2024-02-01', '2024-03-10'), [{ startDate: '2024-02-01', endDate: '2024-02-29' }, { startDate: '2024-03-01', endDate: '2024-03-10' }])
  assert.equal(goalProgress(100, 200, '2026-09-01', '2026-09-30', '2026-10-15').expected, 100)
  assert.equal(goalProgress(0, 200, '2026-10-01', '2026-10-31', '2026-09-30').expected, 0)
  assert.equal(goalProgress(100, 0, '2026-09-01', '2026-09-30', '2026-09-30').actual, null)
})

test('period charts preserve counts but leave gaps when transaction amounts are unavailable', () => {
  const rows = normalizeSource('guru', { data: [{ id: 'unknown', dates: { created_at: Date.parse(date) / 1000 }, product: { name: 'DevClub' } }] }).map(enrichPeriodRecord)
  const chart = periodSeries(rows, '2026-09-10', '2026-09-11')
  assert.equal(chart.rows[0].count, 1)
  assert.equal(chart.rows[0].revenue, null)
  assert.equal(chart.rows[0].digital, null)
  assert.equal(chart.rows[0].affiliate, null)
  assert.equal(chart.rows[1].count, 0)
  assert.equal(chart.rows[1].revenue, 0)
})
