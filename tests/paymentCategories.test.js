import test from 'node:test'
import assert from 'node:assert/strict'
import { salesPaymentLabel } from '../src/utils/platformCash.js'
import { filterSales, filterOptions, groupSales, UNKNOWN } from '../src/utils/salesData.js'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { buildComparisonSnapshot, comparisonGroups } from '../src/utils/comparisonData.js'
import { buildTvData } from '../src/components/tv/tvData.js'

const platforms = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', boletex: 'Boletex', asaas: 'Asaas' }
const row = (sourceId, payment, net, extra = {}) => ({ id: `${sourceId}:${payment}`, kind: 'sale', sourceId,
  platform: platforms[sourceId], payment, gross: net, net, revenue: net, received: net,
  quantity: 1, date: '2026-10-19T12:00:00Z', product: 'DevClub', family: 'DevClub', utm: {}, ...extra })
const sourcesFor = records => [...new Set(records.map(row => row.sourceId))].map(id => ({ id, label: platforms[id] || 'Manual',
  platform: platforms[id] || 'Manual', kind: 'sale', status: 'ready', rows: records.filter(row => row.sourceId === id) }))

test('commercial category follows the native or manually declared platform and preserves original methods', () => {
  for (const [id, expected] of Object.entries({ guru: 'Cartão', hotmart: 'Cartão', tmb: 'Boleto', boletex: 'Boleto' })) {
    for (const method of ['Cartão', 'Pix', 'Boleto', 'APPLE_PAY', 'Paypal', 'Não informado', null]) {
      const native = Object.freeze(row(id, method, 100))
      const manual = Object.freeze({ ...native, sourceId: 'manual', isManual: true })
      assert.equal(salesPaymentLabel(native), expected)
      assert.equal(salesPaymentLabel(manual), expected)
      assert.equal(native.payment, method)
      assert.equal(manual.payment, method)
    }
  }
  assert.equal(salesPaymentLabel(row('asaas', 'Pix', 100, { platform: 'Guru' })), 'Pix', 'native source wins over an incidental display name')
  assert.equal(salesPaymentLabel(row('guru', 'Pix', 100, { kind: 'refund' })), 'Pix', 'refund details keep their original method')
})

test('daily, period filters, groups, comparison and monthly/daily TV reconcile the incident amounts', () => {
  const records = [row('guru', 'Cartão', 149227.588179705), row('guru', 'Pix', 23687.022),
    row('hotmart', 'Cartão', 24612.84), row('hotmart', 'APPLE_PAY', 1933.13),
    row('tmb', null, 1000), row('boletex', 'Pix', 2000), row('asaas', 'Pix', 50)]
  const original = structuredClone(records)
  const sources = sourcesFor(records)
  const result = buildRevenueBreakdown(records, sources)
  assert.equal(result.payments.card.value.toFixed(2), '199460.58')
  assert.equal(result.payments.card.count, 4)
  assert.equal(result.payments.boleto.value, 3000)
  assert.equal(result.payments.boleto.count, 2)
  assert.equal(result.payments.pix.value, 50, 'other sources retain their methods and amounts')
  assert.deepEqual(filterOptions(records, 'payment'), ['Boleto', 'Cartão', 'Pix'])
  assert.deepEqual(filterSales(records, { payment: 'Cartão' }), records.slice(0, 4))
  assert.deepEqual(filterSales(records, { payment: 'Boleto' }), records.slice(4, 6))
  assert.deepEqual(filterSales(records, { payment: 'Pix' }), records.slice(6))
  assert.equal(filterSales(records, { payment: UNKNOWN }).length, 0)
  const groups = groupSales(records, 'payment')
  assert.equal(groups.find(group => group.name === 'Cartão').revenue.value, result.payments.card.value)
  assert.equal(groups.reduce((total, group) => total + group.count, 0), records.length)
  const range = { startDate: '2026-10-19', endDate: '2026-10-19' }
  const comparison = buildComparisonSnapshot({ records, sources }, { payment: 'Cartão' }, range)
  assert.equal(comparison.metrics.revenue.value, result.payments.card.value)
  assert.equal(comparison.allocationMissing, false)
  const all = buildComparisonSnapshot({ records, sources }, {}, range)
  const cardGroup = comparisonGroups(all, all, 'payment').find(group => group.name === 'Cartão')
  assert.equal(cardGroup.a.revenue.value, result.payments.card.value)
  assert.equal(cardGroup.a.revenue.partial, false, 'known platform category needs no original payment to be allocated')
  const tv = buildTvData({ sales: { records, sources, operationsStatus: 'ready' }, year: 2026, month: 10, today: '2026-10-19' })
  for (const payments of [tv.payments, tv.daily.payments]) {
    assert.equal(payments.find(group => group.id === 'card').gross, result.payments.card.value)
    assert.equal(payments.find(group => group.id === 'boleto').gross, 3000)
    assert.equal(payments.find(group => group.id === 'pix').gross, 50)
  }
  assert.deepEqual(records, original)
})

test('a known commercial aggregate category does not create false comparison gaps in another category', () => {
  const records = [row('guru', null, 80, { isAggregate: true, quantity: 2 }), row('tmb', null, 200)]
  const sources = sourcesFor(records)
  const range = { startDate: '2026-10-19', endDate: '2026-10-19' }
  const filtered = buildComparisonSnapshot({ records, sources }, { payment: 'Boleto' }, range)
  assert.equal(filtered.metrics.revenue.value, 200)
  assert.equal(filtered.allocationMissing, false)
  const all = buildComparisonSnapshot({ records, sources }, {}, range)
  const groups = comparisonGroups(all, all, 'payment')
  assert.equal(groups.find(group => group.name === 'Cartão').a.revenue.value, 80)
  assert.ok(groups.every(group => !group.a.revenue.partial))
})
