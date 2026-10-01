import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueBreakdown, buildRevenueNotices, revenuePaymentGroup } from '../src/utils/revenueBreakdown.js'
import { mergePeriodSources } from '../src/utils/periodData.js'

const platforms = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', asaas: 'Asaas', boletex: 'Boletex', manual: 'Manual' }
const source = (id, extra = {}) => ({ id, label: platforms[id], platform: platforms[id], kind: 'sale', status: 'ready', ...extra })
const row = (sourceId, payment, revenue, extra = {}) => ({ id: `fixture:${sourceId}:${payment}`, sourceId, platform: platforms[sourceId], kind: 'sale', quantity: 1, revenue, gross: revenue, received: null, payment, date: '2026-10-01T12:00:00Z', utm: {}, ...extra })

test('payment cards classify the actual method across platforms and preserve residual/negative totals', () => {
  const sales = [row('guru', 'Cartão', 100), row('guru', 'Pix', 200), row('guru', 'Boleto', 300), row('hotmart', 'Cartão', 400), row('hotmart', 'Boleto', 500), row('hotmart', 'Não informado', 50, { isAggregate: true, quantity: 0 }), row('hotmart', 'Não informado', -10, { isAggregate: true, quantity: -1 }), row('hotmart', 'Paypal', 60)]
  const result = buildRevenueBreakdown(sales, [source('guru'), source('hotmart')])
  assert.equal(result.payments.card.value, 500)
  assert.equal(result.payments.boleto.value, 800)
  assert.equal(result.payments.pix.value, 200)
  assert.equal(result.payments.unknown.value, 40)
  assert.equal(result.payments.other.value, 60)
  assert.equal(result.revenue.value, 1600)
  assert.equal(Object.values(result.payments).reduce((total, group) => total + (group.value ?? 0), 0), result.revenue.value)
  assert.equal(result.payments.card.providers.find(provider => provider.id === 'hotmart').partial, true)
  assert.equal(result.payments.card.providers.find(provider => provider.id === 'guru').value, 100)
  assert.equal(revenuePaymentGroup('Cartão de débito'), 'card')
})

test('known-empty, unavailable, unknown classification and missing financial values stay distinct', () => {
  assert.equal(buildRevenueBreakdown([], [source('guru')]).payments.card.value, 0)
  const unavailable = buildRevenueBreakdown([], [source('guru', { status: 'unavailable' }), source('manual')])
  assert.equal(unavailable.revenue.value, null)
  assert.equal(unavailable.payments.card.value, null)
  const unknown = buildRevenueBreakdown([row('guru', 'Não informado', 80)], [source('guru')])
  assert.equal(unknown.payments.card.value, null)
  assert.equal(unknown.payments.boleto.value, null)
  assert.equal(unknown.payments.unknown.value, 80)
  const missing = buildRevenueBreakdown([row('guru', 'Cartão', null)], [source('guru')])
  assert.equal(missing.payments.card.value, null)
  assert.equal(missing.payments.card.count, 1)
  assert.equal(missing.payments.card.partial, true)
})

test('TMB rule affects cash, not revenue, and Asaas receipts do not manufacture boleto sales', () => {
  const result = buildRevenueBreakdown([row('tmb', 'Boleto', 1000)], [source('tmb'), source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash: { gross: 900, net: 850, fees: 50, count: 2, availablePeriods: 1, periods: 1 } })])
  assert.equal(result.revenue.value, 1000)
  assert.equal(result.payments.boleto.value, 1000)
  assert.equal(result.payments.boleto.providers.some(provider => provider.id === 'asaas'), false)
  assert.equal(result.cash.providers.find(provider => provider.id === 'tmb').value, 400)
  assert.equal(result.cash.providers.find(provider => provider.id === 'asaas').value, 900)
  assert.equal(result.cash.value, 1300)
})

test('filtered values do not allocate Asaas cash to a product or payment method', () => {
  const sources = [source('tmb'), source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash: { gross: 900, availablePeriods: 1, periods: 1 } })]
  const result = buildRevenueBreakdown([row('tmb', 'Boleto', 1000)], sources, { family: 'MBA' })
  assert.equal(result.cash.value, 400)
  assert.equal(result.cash.partial, true)
  assert.equal(result.cash.providers.find(provider => provider.id === 'asaas').value, null)
  const notices = buildRevenueNotices(sources, { family: 'MBA' })
  assert.ok(notices.some(notice => notice.id === 'asaas-allocation'))
})

test('manual TMB is cash by rule but remains an unknown payment until the method is known', () => {
  const result = buildRevenueBreakdown([row('manual', 'Não informado', 100, { platform: 'TMB', isManual: true, received: 10 })], [source('manual')])
  assert.equal(result.cash.value, 40)
  assert.equal(result.revenue.value, 100)
  assert.equal(result.payments.boleto.value, null)
  assert.equal(result.payments.card.value, null)
  assert.equal(result.payments.unknown.providers[0].label, 'TMB')
})

test('cached history and today retain every Asaas receipt without changing known cash', () => {
  const batches = [
    { startDate: '2026-09-01', endDate: '2026-09-29', result: { records: [], sources: [source('asaas', { cashReceipts: [{ date: '2026-09-28', received: 600 }] })] } },
    { startDate: '2026-09-30', endDate: '2026-09-30', result: { records: [], sources: [source('asaas', { cashReceipts: [{ date: '2026-09-30', received: 300 }] })] } },
  ]
  const merged = mergePeriodSources(batches)
  assert.equal(merged[0].cashReceipts.length, 2)
  assert.equal(buildRevenueBreakdown([], merged).cash.value, 900)
  assert.equal(buildRevenueBreakdown([], merged, { payment: 'Boleto' }).cash.value, null)
})

test('stale sales preserve visible subtotals and explain warnings only through notifications', () => {
  const sources = [source('tmb', { status: 'partial' }), source('asaas', { status: 'not_requested', salesAvailable: false })]
  const result = buildRevenueBreakdown([row('tmb', 'Boleto', 800)], sources)
  assert.equal(result.revenue.value, 800)
  assert.equal(result.payments.boleto.partial, true)
  assert.equal(result.cash.value, 320)
  assert.equal(result.cash.partial, true)
  const notices = buildRevenueNotices(sources, {}, { cache: { staleSources: 1, pollTimedOut: true } })
  for (const id of ['partial-sales', 'tmb-cash-rule', 'asaas-on-demand', 'stale-cache', 'cache-in-progress']) assert.ok(notices.some(notice => notice.id === id))
})

test('cash freshness, unknown receipt dates and excluded manual Asaas remain explicit', () => {
  const asaas = source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash: { gross: 900, availablePeriods: 1, periods: 1 }, cashReceipts: [{ received: 900, date: '2026-10-01' }], snapshots: [{ status: 'stale' }] })
  const stale = buildRevenueBreakdown([], [asaas], { platform: 'Asaas' })
  assert.equal(stale.cash.value, 900)
  assert.equal(stale.cash.partial, true)
  const undated = buildRevenueBreakdown([], [source('asaas', { cashReceipts: [{ received: 900, date: null }] })])
  assert.equal(undated.cash.value, 900)
  assert.equal(undated.cash.partial, true)
  const manuals = [row('manual', 'Não informado', 100, { platform: 'Asaas', isManual: true, received: 100 }), row('manual', 'Pix', 50, { platform: 'Pix direto', isManual: true, received: 50 })]
  const manualModel = buildRevenueBreakdown(manuals, [source('manual')])
  assert.equal(manualModel.cash.value, 50)
  assert.equal(manualModel.cash.partial, true)
  assert.ok(buildRevenueNotices([source('manual')], {}, { records: manuals }).some(notice => notice.id === 'asaas-manual-cash'))
})
