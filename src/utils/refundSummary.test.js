import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRefundSummary, refundKind, refundPeriodLink, reconcileGlobalRefunds } from './refundSummary.js'
import { summarizePeriod, periodSeries } from './periodData.js'

const sale = (id, overrides = {}) => ({ id, externalId: id, sourceId: 'guru', platform: 'Guru', kind: 'sale', quantity: 1,
  buyerEmail: 'cliente@example.test', product: 'DevClub', date: '2026-09-01T15:00:00Z', net: 100, revenue: 100,
  gross: 100, utm: {}, original: { status: 'approved', payment: { currency: 'BRL' } }, ...overrides })
const request = (overrides = {}) => ({ id: 'request-1', source: 'typeform', sources: ['typeform'], status: 'requested',
  email: 'cliente@example.test', product: 'DevClub', purchasedAt: '2026-09-01', requestedAt: '2026-10-20', ...overrides })
const range = { startDate: '2026-09-01', endDate: '2026-09-30' }

test('solicitação após sete dias e após o período retira a compra dos totais e gráficos, preservando histórico', () => {
  const original = sale('purchase-1')
  const result = reconcileGlobalRefunds([original], [request()], range)
  assert.equal(summarizePeriod(result.records).total.count, 0)
  assert.equal(summarizePeriod(result.records).total.revenue.value, 0)
  assert.equal(periodSeries(result.records, range.startDate, range.endDate).rows[0].revenue, 0)
  assert.equal(result.records[0].kind, 'refund')
  assert.equal(result.records[0].refundExclusion.status, 'requested')
  assert.equal(result.records[0].refundExclusion.requestedAt, '2026-10-20')
  assert.equal(result.records[0].revenue, 100)
  assert.equal(original.kind, 'sale')
  assert.equal(result.excludedCount, 1)
})

test('mesmo cliente com compras distintas: produto, data e plataforma impedem retirar outra compra', () => {
  const records = [sale('one'), sale('two', { product: 'MBA' }), sale('three', { date: '2026-09-02T15:00:00Z' }), sale('four', { platform: 'Hotmart', sourceId: 'hotmart' })]
  const result = reconcileGlobalRefunds(records, [request({ email: ' CLIENTE@example.test ', product: ' devclub ', platform: 'guru' })], range)
  assert.deepEqual(result.records.filter(row => row.kind === 'sale').map(row => row.id), ['two', 'three', 'four'])
})

test('identificação incompleta ou ambígua mantém as vendas e sinaliza conferência', () => {
  for (const requests of [[request()], [request({ purchasedAt: null })], [request({ product: '' })]]) {
    const result = reconcileGlobalRefunds([sale('one'), sale('two')], requests, range)
    assert.equal(summarizePeriod(result.records).total.count, 2)
    assert.equal(result.pendingRequests.length, 1)
  }
  const unrelated = reconcileGlobalRefunds([sale('one')], [request({ email: 'outro@example.test', purchasedAt: '2025-01-01' })], range)
  assert.equal(unrelated.pendingRequests.length, 0)
})

test('solicitações repetidas e confirmação financeira da mesma compra não descontam nem contam duas vezes', () => {
  const refund = { ...sale('refund-row'), externalId: 'one', sourceId: 'guruRefunds', kind: 'refund', original: { status: 'refunded', payment: { currency: 'BRL' } } }
  const result = reconcileGlobalRefunds([sale('one'), refund], [request(), request({ id: 'duplicate' })], range)
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].refundExclusion.status, 'refunded')
  assert.equal(result.excludedCount, 1)
  assert.equal(buildRefundSummary(result.records, [{ id: 'guruRefunds', status: 'ready' }]).confirmed, 1)
})

test('chargeback vincula somente o mesmo ID na mesma plataforma e exclui a venda', () => {
  const refund = { ...sale('chargeback-row'), externalId: 'one', sourceId: 'guruRefunds', kind: 'refund', original: { status: 'chargeback' } }
  const result = reconcileGlobalRefunds([sale('one'), sale('other-platform', { externalId: 'one', platform: 'Hotmart', sourceId: 'hotmart' }), refund], [], range)
  assert.equal(summarizePeriod(result.records).total.count, 1)
  assert.equal(result.records.find(row => row.platform === 'Guru').refundExclusion.status, 'chargeback')
})

test('revertido mais recente libera a compra, mas uma nova solicitação e evidência financeira continuam válidas', () => {
  const retained = request({ id: 'retained', status: 'retained', requestedAt: '2026-10-21', source: 'spreadsheet' })
  assert.equal(reconcileGlobalRefunds([sale('one')], [request(), retained], range).excludedCount, 0)
  assert.equal(reconcileGlobalRefunds([sale('one')], [retained, request({ requestedAt: '2026-10-22' })], range).excludedCount, 1)
  const refund = { ...sale('refund'), externalId: 'one', kind: 'refund', original: { status: 'chargeback' } }
  assert.equal(reconcileGlobalRefunds([sale('one'), refund], [retained], range).excludedCount, 1)
})

test('saldo agregado nunca é atribuído a uma solicitação e datas de compra usam Brasília', () => {
  assert.equal(reconcileGlobalRefunds([sale('aggregate', { isAggregate: true })], [request()], range).excludedCount, 0)
  assert.equal(reconcileGlobalRefunds([sale('one', { date: '2026-09-02T01:00:00Z' })], [request()], range).excludedCount, 1)
})

test('compra Guru usa ordered_at para vincular e preserva a data exibida da venda', () => {
  const original = sale('one', { original: { dates: { ordered_at: Date.parse('2026-09-02T15:00:00Z') / 1000 } } })
  const result = reconcileGlobalRefunds([original], [request({ purchasedAt: '2026-09-02' })], range)
  assert.equal(result.excludedCount, 1)
  assert.equal(result.records[0].date, original.date)
})

const sources = [{ id: 'guruRefunds', status: 'ready' }, { id: 'hotmartRefunds', status: 'ready' }]
const row = (platform, status, amount = 100, other = {}) => ({ kind: 'refund', platform, quantity: 1, gross: amount, net: amount == null ? null : amount * .94, revenue: amount * .94, original: { status, currency: 'BRL', ...(platform === 'Hotmart' ? { netValue: amount == null ? null : amount * .94, netCurrency: 'BRL' } : {}) }, ...other })

test('reembolsos totais/parciais ficam separados de disputas, rejeições e status desconhecidos', () => {
  const model = buildRefundSummary([
    row('Guru', 'refunded', 100), row('Guru', 'partially_refunded', 150),
    row('Guru', 'chargeback', 800), row('Guru', 'dispute', 500), row('Guru', 'rejected', 900),
    row('Hotmart', 'REFUNDED', 1997), row('Hotmart', 'PARTIALLY_REFUNDED', 250),
    row('Hotmart', '', 700), { ...row('Guru', 'refunded', 2000), kind: 'sale' },
  ], sources)
  assert.equal(model.confirmed, 4)
  assert.equal(model.partialRefunds, 2)
  assert.equal(model.disputes, 2)
  assert.equal(model.cancelled, 1)
  assert.equal(model.unknown, 1)
  assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: 2347.18 }])
  assert.deepEqual(model.refunded.values, [])
  assert.equal(model.refunded.unknown, 4)
})

test('compra reembolsada usa apenas líquido digital autorizado, nunca preço bruto nem valor devolvido', () => {
  const guru = row('Guru', 'refunded', 100, { original: { status: 'refunded', payment: { total: 1997, currency: 'BRL' } } })
  const model = buildRefundSummary([guru], sources, { platform: 'Guru' })
  assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: 94 }])
  assert.deepEqual(model.refunded.values, [])
  assert.equal(model.confirmed, 1)
})

test('fonte indisponível e TMB/Asaas não se tornam zero; vazio conhecido fica zero', () => {
  const model = buildRefundSummary([], sources)
  assert.equal(model.confirmed, 0)
  assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: 0 }])
  assert.equal(model.providers.find(provider => provider.id === 'asaas').confirmed, null)
  assert.equal(model.providers.find(provider => provider.id === 'tmb').confirmed, null)
  const missing = buildRefundSummary([], sources, { platform: 'TMB' })
  assert.equal(missing.confirmed, null)
  assert.deepEqual(missing.purchase.values, [])
  const unavailable = buildRefundSummary([], [{ id: 'guruRefunds', status: 'unavailable' }], { platform: 'Guru' })
  assert.equal(unavailable.confirmed, null)
  assert.deepEqual(unavailable.refunded.values, [])
})

test('moedas diferentes permanecem separadas e valores desconhecidos não viram zero', () => {
  const model = buildRefundSummary([row('Guru', 'refunded', null), row('Guru', 'refunded', 100), row('Hotmart', 'refunded', 50, { original: { status: 'REFUNDED', currency: 'USD', netValue: 47, netCurrency: 'USD' } }), row('Hotmart', 'refunded', 900, { original: { status: 'REFUNDED' } })], sources)
  assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: 94 }, { currency: 'USD', value: 47 }])
  assert.equal(model.purchase.unknown, 2)
  assert.equal(model.confirmed, 4)
})

test('central mostra valor efetivamente devolvido apenas quando informado e cancelamento TMB separado', () => {
  const records = [
    { platform: 'hotmart', kind: 'confirmed', status: 'partially_refunded', saleAmount: 1997, saleNetAmount: 1877.18, refundAmount: 200, currency: 'BRL' },
    { platform: 'tmb', kind: 'cancelled', status: 'cancelled', saleAmount: 3000, refundAmount: null, currency: 'BRL' },
    { platform: 'guru', kind: 'request', status: 'requested', saleAmount: null, refundAmount: null },
  ]
  const model = buildRefundSummary(records, [{ id: 'hotmart', status: 'available' }, { id: 'tmb', status: 'limited' }, { id: 'guru', status: 'unavailable' }], { overview: true })
  assert.equal(model.confirmed, 1)
  assert.equal(model.cancelled, 1)
  assert.deepEqual(model.purchase.values, [{ currency: 'BRL', value: 1877.18 }])
  assert.deepEqual(model.refunded.values, [{ currency: 'BRL', value: 200 }])
  assert.equal(model.providers.find(provider => provider.id === 'guru').confirmed, null)
  assert.equal(model.providers.find(provider => provider.id === 'tmb').confirmed, null)
})

test('links preservam o período e status nunca é deduzido da existência de valor', () => {
  assert.equal(refundPeriodLink('2026-10-01', '2026-10-05'), '/reembolsos?startDate=2026-10-01&endDate=2026-10-05')
  assert.equal(refundKind('APPROVED'), 'unknown')
  assert.equal(refundKind('Cancelado'), 'cancelled')
  const unknown = buildRefundSummary([row('Guru', undefined, 100)], sources)
  assert.equal(unknown.confirmed, null)
  assert.deepEqual(unknown.purchase.values, [])
})
