import test from 'node:test'
import assert from 'node:assert/strict'
import { createPeriodCacheLoader, normalizePeriodSnapshot } from '../src/services/periodSalesService.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { asaasCashView } from '../src/utils/sourceAvailability.js'
import { SOURCE_DEFINITIONS } from '../src/utils/salesData.js'

// Reproduce the reported September totals without keeping customer records.
// Counts and allocations within each platform below are synthetic. The TMB
// fixture spans more than one provider page and preserves the observed gross;
// its per-sale cash total is an expectation for this fixture, not a live audit.
const baseline = { revenue: 298904.08, count: 185, guru: 236554.48, hotmart: 50565.80, cash: 287120.28, invoices: 114025.16 }
const recoveredTmb = { count: 177, gross: 414218.73592, cash: 165687.49 }
const stamp = '2026-10-01T13:56:00.000Z'
const cents = value => Math.round(value * 100)
const splitAmount = (total, count) => {
  const amount = cents(total), each = Math.floor(amount / count)
  return Array.from({ length: count }, (_, index) => (each + (index < amount % count ? 1 : 0)) / 100)
}
const tmbRows = Array.from({ length: recoveredTmb.count }, (_, index) => {
  const value = index === recoveredTmb.count - 1 ? 62218.73592 : 2000
  return { id: `synthetic-tmb-${index}`, product: 'MBA', value, timestamp: '2026-09-30T00:00:00Z',
    date: { original: '2026-09-30' }, raw: { pedido_id: `synthetic-${index}`, valor_total: value } }
})

function snapshot({ tmb = [], status = 'ready', pending = 0, fetchedAt = stamp } = {}) {
  const payloads = {
    guru: { success: true, data: splitAmount(baseline.guru, 150).map((net, index) => ({ id: `synthetic-guru-${index}`,
      product: { name: 'DevClub' }, payment: { method: 'credit_card' }, dates: { created_at: '2026-09-01T15:00:00Z' },
      calculation_details: { total_amount: net, net_amount: net, net_affiliate_value: 0 } })) },
    hotmart: { success: true, data: { financialSchemaVersion: 2, count: 34, totalNet: baseline.hotmart,
      totalGross: baseline.hotmart, totalFees: 0,
      transactions: splitAmount(baseline.hotmart, 34).map((net, index) => ({ transaction: `synthetic-hotmart-${index}`,
        product: 'DevClub', paymentMethod: 'CREDIT_CARD', orderDate: '2026-09-02T15:00:00Z',
        grossValue: net, netValue: net, fee: 0, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL' })) } },
    tmb: tmb === null ? null : { success: true, data: tmb },
    asaas: { success: true, data: { sales: null, count: 1, totalGross: baseline.invoices, totalNet: baseline.invoices, totalFees: 0,
      availability: { sales: 'unavailable', cash: 'ready', reason: 'checkout_disabled' },
      cashReceipts: [{ date: '2026-09-05', received: baseline.invoices, count: 1 }],
      cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: 'ready',
        rows: [{ receiptDate: '2026-09-05', saleDate: '2026-08-01', received: baseline.invoices, count: 1 }] } } },
    boletex: { success: true, data: { sales: { count: 1, totalValue: 11783.80, confirmedValue: 500,
      entries: [{ id: 'synthetic-boletex', productDescription: 'DevClub', totalValue: 11783.80,
        entryValue: 500, createdAt: '2026-09-03T15:00:00Z' }] } } },
    guruRefunds: { success: true, data: [] },
    hotmartRefunds: { success: true, data: { count: 0, totalRefundAmount: 0, transactions: [] } },
  }
  return { schemaVersion: 1, requested: { startDate: '2026-09-01', endDate: '2026-09-30' },
    segments: [{ startDate: '2026-09-01', endDate: '2026-09-30', kind: 'history',
      sources: SOURCE_DEFINITIONS.map(({ id }) => ({ id, status: id === 'tmb' ? status : 'ready', payload: payloads[id],
        fetchedAt, lastAttemptAt: fetchedAt, refreshing: id === 'tmb' && pending > 0 })) }],
    pending, complete: pending === 0, total: 7, completed: 7 - pending, generatedAt: stamp,
    schedule: { timezone: 'America/Sao_Paulo', hour: 4 } }
}
const breakdown = data => buildRevenueBreakdown(data.records, data.sources)
const provider = data => breakdown(data).cash.providers.find(row => row.id === 'tmb')
const pace = (data, scope = 'overall', scopeId = '') => calculateGoalPace({ ...data, year: 2026, month: 9, today: '2026-10-01',
  plan: { scope, scopeId, metric: 'cash', target: 600000, paceBasis: 'calendar' } })

test('September reported totals exclude old Asaas invoices from revenue, cash and goal pace', () => {
  const data = normalizePeriodSnapshot(snapshot())
  const result = breakdown(data)
  assert.equal(cents(result.revenue.value), cents(baseline.revenue))
  assert.equal(result.revenue.count, baseline.count)
  assert.equal(cents(result.cash.value), cents(baseline.cash))
  assert.equal(result.cash.providers.some(row => row.id === 'asaas'), false)
  assert.equal(asaasCashView(data.sources).gross, baseline.invoices)
  assert.equal(data.records.some(row => row.sourceId === 'asaas'), false)
  const prepared = prepareGoalData(data)
  assert.equal(cents(pace(prepared).actual), cents(baseline.cash))
  assert.equal(cents(pace(prepared).rows.at(-1).actual), cents(baseline.cash))
  assert.equal(prepared.cashRecords.some(row => row.sourceId === 'asaas' || row.sourceId === 'boletex'), false)
})

test('all recovered TMB rows survive monthly and annual normalization, with cash at 40% per sale', () => {
  for (const annual of [false, true]) {
    const data = normalizePeriodSnapshot(snapshot({ tmb: tmbRows }), { annual })
    const result = breakdown(data)
    assert.equal(data.records.filter(row => row.sourceId === 'tmb').length, recoveredTmb.count)
    assert.equal(result.revenue.count, baseline.count + recoveredTmb.count)
    assert.equal(cents(result.revenue.value), cents(baseline.revenue + recoveredTmb.gross))
    assert.equal(cents(provider(data).value), cents(recoveredTmb.cash))
    assert.equal(cents(result.cash.value), cents(baseline.cash + recoveredTmb.cash))
    assert.equal(result.cash.providers.some(row => row.id === 'asaas'), false)
    const boleto = result.payments.boleto.providers.find(row => row.id === 'tmb')
    assert.equal(boleto.count, recoveredTmb.count)
    assert.equal(cents(boleto.gross.value), cents(recoveredTmb.gross))
    assert.equal(cents(boleto.cash.value), cents(recoveredTmb.cash))
    assert.equal(boleto.entry.value, null, 'planned TMB entries never become received entries')
    if (!annual) assert.equal(asaasCashView(data.sources).gross, baseline.invoices)
  }
})

test('refresh replaces the old empty TMB snapshot while preserving separate Asaas invoices', async () => {
  const cached = snapshot({ status: 'stale', pending: 1, fetchedAt: '2026-10-01T12:18:00.000Z' })
  const fresh = snapshot({ tmb: tmbRows })
  const published = [], forces = []
  const load = createPeriodCacheLoader({ fetchSnapshot: async (_from, _to, options) => {
    forces.push(options.force)
    return forces.length === 1 ? cached : fresh
  }, fetchLedger: async () => ({ attributions: [], manualSales: [] }), wait: async () => {} })
  const final = await load('2026-09-01', '2026-09-30', { force: true, onSnapshot: data => published.push(data) })
  assert.deepEqual(forces, [true, false])
  assert.equal(published.length, 2)
  assert.equal(provider(published[0]).value, 0)
  assert.equal(cents(provider(published[1]).value), cents(recoveredTmb.cash))
  assert.equal(cents(breakdown(final).cash.value), cents(baseline.cash + recoveredTmb.cash))
  for (const data of published) assert.equal(asaasCashView(data.sources).gross, baseline.invoices)
})

test('TMB unavailable and confirmed empty remain distinct; stale known sales stay visible', () => {
  const unavailable = normalizePeriodSnapshot(snapshot({ tmb: null, status: 'unavailable' }))
  const empty = normalizePeriodSnapshot(snapshot())
  const stale = normalizePeriodSnapshot(snapshot({ tmb: tmbRows, status: 'stale' }))
  assert.equal(provider(unavailable).value, null)
  assert.equal(provider(empty).value, 0)
  assert.equal(cents(provider(stale).value), cents(recoveredTmb.cash))
  assert.equal(stale.sources.find(source => source.id === 'tmb').status, 'partial')
  assert.equal(breakdown(stale).cash.partial, true)
})

test('recovered TMB advances the same September pace by product, team and seller without Asaas invoices', () => {
  const data = normalizePeriodSnapshot(snapshot({ tmb: tmbRows }))
  data.records = data.records.map(row => row.sourceId === 'tmb' ? { ...row, sellerId: 'synthetic-seller' } : row)
  const prepared = prepareGoalData(data, { individuals: [{ id: 'synthetic-seller', teamId: 'synthetic-team' }] })
  const overall = pace(prepared)
  assert.equal(cents(overall.actual), cents(baseline.cash + recoveredTmb.cash))
  assert.equal(cents(overall.rows[29].dailyActual), cents(recoveredTmb.cash))
  assert.equal(overall.unallocated, 0)
  for (const [scope, scopeId] of [['product', 'MBA'], ['team', 'synthetic-team'], ['individual', 'synthetic-seller']]) {
    const result = pace(prepared, scope, scopeId)
    assert.equal(cents(result.actual), cents(recoveredTmb.cash))
    assert.equal(cents(result.rows.at(-1).actual), cents(recoveredTmb.cash))
    assert.equal(result.rows.slice(0, 29).every(row => row.dailyActual === 0), true)
  }
})
