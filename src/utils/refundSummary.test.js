import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRefundSummary, refundKind, refundPeriodLink } from './refundSummary.js'

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
