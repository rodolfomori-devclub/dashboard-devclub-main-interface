import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueBreakdown, buildRevenueNotices, revenuePaymentGroup } from '../src/utils/revenueBreakdown.js'
import { mergePeriodSources } from '../src/utils/periodData.js'
import { asaasCashView } from '../src/utils/sourceAvailability.js'

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
  assert.equal(result.cash.providers.some(provider => provider.id === 'asaas'), false)
  assert.equal(result.cash.value, 400)
})

test('filtered values do not allocate Asaas cash to a product or payment method', () => {
  const sources = [source('tmb'), source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash: { gross: 900, availablePeriods: 1, periods: 1 } })]
  const result = buildRevenueBreakdown([row('tmb', 'Boleto', 1000)], sources, { family: 'MBA' })
  assert.equal(result.cash.value, 400)
  assert.equal(result.cash.partial, true)
  assert.equal(result.cash.providers.some(provider => provider.id === 'asaas'), false)
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

test('cached history and today retain the separate Asaas ledger without inflating new-sale cash', () => {
  const batches = [
    { startDate: '2026-09-01', endDate: '2026-09-29', result: { records: [], sources: [source('asaas', { status: 'partial', salesAvailable: false, cashReceipts: [{ date: '2026-09-28', received: 600 }] })] } },
    { startDate: '2026-09-30', endDate: '2026-09-30', result: { records: [], sources: [source('asaas', { status: 'partial', salesAvailable: false, cashReceipts: [{ date: '2026-09-30', received: 300 }] })] } },
  ]
  const merged = mergePeriodSources(batches)
  assert.equal(merged[0].cashReceipts.length, 2)
  assert.equal(buildRevenueBreakdown([], merged).cash.value, null)
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

test('legacy invoices stay separate regardless of freshness and manual new-sale cash stays independent', () => {
  const asaas = source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash: { gross: 900, availablePeriods: 1, periods: 1 }, cashReceipts: [{ received: 900, date: '2026-10-01' }], snapshots: [{ status: 'stale' }] })
  const stale = buildRevenueBreakdown([], [asaas], { platform: 'Asaas' })
  assert.equal(stale.cash.value, null)
  assert.equal(stale.cash.partial, true)
  const undated = buildRevenueBreakdown([], [source('asaas', { status: 'partial', salesAvailable: false, cashReceipts: [{ received: 900, date: null }] })])
  assert.equal(undated.cash.value, null)
  assert.equal(undated.cash.partial, true)
  const manuals = [row('manual', 'Não informado', 100, { platform: 'Asaas', isManual: true, received: 100 }), row('manual', 'Pix', 50, { platform: 'Pix direto', isManual: true, received: 50 })]
  const manualModel = buildRevenueBreakdown(manuals, [source('manual')])
  assert.equal(manualModel.cash.value, 150)
  assert.equal(manualModel.cash.partial, false)
  assert.equal(buildRevenueNotices([source('manual')], {}, { records: manuals }).some(notice => notice.id === 'asaas-manual-cash'), false)
})


test('reported production case: three Hotmart sales 833.64 exclude 1255.36 Asaas invoices from main cash', () => {
  const sales = [1, 2, 3].map(id => row('hotmart', 'Cartão', 277.88, { id: `hotmart:${id}`, net: 277.88 }))
  const invoices = source('asaas', { status: 'partial', salesAvailable: false, reason: 'checkout_disabled',
    cash: { gross: 1255.36, net: 1230, fees: 25.36, count: 6, availablePeriods: 1, periods: 1 },
    cashReceipts: [{ date: '2026-10-01', received: 1255.36, count: 6 }],
    cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: 'ready', rows: [{ receiptDate: '2026-10-01', saleDate: '2026-10-01', received: 1255.36, count: 6 }] },
  })
  const sources = [source('guru'), source('hotmart'), source('tmb'), invoices]
  const result = buildRevenueBreakdown(sales, sources)
  assert.equal(Math.round(result.revenue.value * 100), 83364)
  assert.equal(result.revenue.count, 3)
  assert.equal(Math.round(result.revenue.ticket * 100), 27788)
  assert.equal(Math.round(result.cash.value * 100), 83364)
  assert.equal(result.cash.providers.some(provider => provider.id === 'asaas'), false)
  assert.equal(asaasCashView(sources).gross, 1255.36)
  assert.equal(invoices.cashReceipts[0].received, 1255.36)
})

test('only the confirmed entry of a new Asaas contract contributes, never its invoice statement', () => {
  const contract = row('asaas', 'Boleto parcelado', 2000, { received: 200, family: 'MBA', sellerId: 'ana' })
  const sourceAsaas = source('asaas', { cash: { gross: 1455.36, net: 1400, fees: 55.36, count: 7, availablePeriods: 1, periods: 1 }, cashReceipts: [{ date: '2026-10-01', received: 1455.36, count: 7 }] })
  const result = buildRevenueBreakdown([contract], [sourceAsaas])
  assert.equal(result.revenue.value, 2000)
  assert.equal(result.revenue.count, 1)
  assert.equal(result.cash.value, 200)
  assert.equal(result.cash.providers.find(provider => provider.id === 'asaas').value, 200)
  assert.equal(result.payments.boleto.providers[0].cash.value, 200)
  assert.equal(asaasCashView([sourceAsaas]).gross, 1455.36)
  assert.equal(buildRevenueBreakdown([contract], [sourceAsaas], { family: 'MBA' }).cash.value, 200)
})
