import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { filterSales } from '../src/utils/salesData.js'

const names = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', asaas: 'Asaas', boletex: 'Boletex', manual: 'Manual' }
const source = (id, extra = {}) => ({ id, platform: names[id], label: names[id], kind: 'sale', status: 'ready', ...extra })
const row = (id, sourceId, payment, gross, net, extra = {}) => ({ id, sourceId, platform: names[sourceId], kind: 'sale', quantity: 1,
  payment, gross, net, revenue: net ?? gross, received: null, date: '2026-10-01T12:00:00Z', family: 'DevClub', utm: {}, ...extra })
const ids = group => group.providers.map(provider => provider.id)

test('each payment card lists only platforms with that method in the current filtered records', () => {
  const rows = [row('g-card', 'guru', 'Cartão', 1000, 900), row('g-pix', 'guru', 'Pix', 400, 390), row('h-boleto', 'hotmart', 'Boleto', 2000, 1800), row('t-boleto', 'tmb', 'Boleto', 3000, null, { family: 'MBA' })]
  const sources = Object.keys(names).map(id => source(id))
  const model = buildRevenueBreakdown(rows, sources)
  assert.deepEqual(ids(model.payments.card), ['guru'])
  assert.deepEqual(ids(model.payments.boleto), ['hotmart', 'tmb'])
  assert.deepEqual(ids(model.payments.pix), ['guru'])
  assert.equal(model.payments.card.value, 900)
  assert.equal(model.payments.boleto.value, 4800)
  assert.equal(model.revenue.value, 6090)
  const mba = buildRevenueBreakdown(filterSales(rows, { family: 'MBA' }), sources, { family: 'MBA' })
  assert.deepEqual(ids(mba.payments.card), [])
  assert.deepEqual(ids(mba.payments.boleto), ['tmb'])
  assert.equal(mba.payments.card.value, 0)
})

test('boleto platform details separate gross, operational cash and confirmed down payment', () => {
  const rows = [row('g', 'guru', 'Boleto', 1000, 900), row('h', 'hotmart', 'Boleto', 2000, 1880),
    row('t', 'tmb', 'Boleto', 3000, null, { original: { raw: { valor_entrada: 200, valor_total: 3000 }, isConfirmed: true } }),
    row('b', 'boletex', 'Boleto parcelado', 5000, null, { received: 1200, original: { entryValue: 1200 } }),
    row('a', 'asaas', 'Boleto parcelado', 4000, null, { received: 300, original: { entryValue: 300 } })]
  const sources = ['guru', 'hotmart', 'tmb', 'boletex'].map(id => source(id)).concat(source('asaas', { cashReceipts: [{ received: 900, date: '2026-10-01' }] }))
  const model = buildRevenueBreakdown(rows, sources)
  const details = Object.fromEntries(model.payments.boleto.providers.map(provider => [provider.id, [provider.gross.value, provider.cash.value, provider.entry.value]]))
  assert.deepEqual(details.guru, [1000, 900, null])
  assert.deepEqual(details.hotmart, [2000, 1880, null])
  assert.deepEqual(details.tmb, [3000, 1200, null])
  assert.deepEqual(details.boletex, [5000, null, null])
  assert.deepEqual(details.asaas, [4000, 300, 300])
  assert.equal(model.cash.value, 900 + 1880 + 1200 + 300)
  assert.equal(model.payments.boleto.value, 900 + 1880 + 3000 + 5000 + 4000)
  assert.equal(model.payments.boleto.providers.find(provider => provider.id === 'tmb').entry.partial, true)
})

test('a cash-only Asaas statement never becomes a boleto platform, gross or entry', () => {
  const sources = [source('asaas', { status: 'partial', salesAvailable: false, cashReceipts: [{ received: 500, date: '2026-10-01' }] })]
  const model = buildRevenueBreakdown([], sources)
  assert.deepEqual(ids(model.payments.boleto), [])
  assert.deepEqual(ids(model.payments.card), [])
  assert.equal(model.payments.boleto.value, null)
  assert.equal(model.cash.value, null)
})

test('manual platform attribution combines the right method while preserving declared cash once', () => {
  const rows = [row('g', 'guru', 'Boleto', 1000, 900), row('m', 'manual', 'Boleto', 500, 450, { isManual: true, platform: 'Guru', received: 100 }),
    row('mc', 'manual', 'Cartão', 600, 550, { isManual: true, platform: 'Guru', received: 200 })]
  const model = buildRevenueBreakdown(rows, [source('guru'), source('manual')])
  assert.deepEqual(ids(model.payments.boleto), ['guru'])
  assert.deepEqual(ids(model.payments.card), ['guru'])
  const boleto = model.payments.boleto.providers[0]
  assert.equal(boleto.gross.value, 1500)
  assert.equal(boleto.cash.value, 1000)
  assert.equal(boleto.value, 1350)
  assert.equal(boleto.entry.value, null)
  assert.equal(model.cash.value, 1200)
})

test('empty, unavailable and unclassified payment states stay distinct without fake platform rows', () => {
  const empty = buildRevenueBreakdown([], [source('guru')])
  assert.equal(empty.payments.card.value, 0)
  assert.deepEqual(ids(empty.payments.card), [])
  const failed = buildRevenueBreakdown([], [source('guru', { status: 'unavailable' }), source('manual')])
  assert.equal(failed.payments.card.value, null)
  assert.deepEqual(ids(failed.payments.card), [])
  const unknown = buildRevenueBreakdown([row('unknown', 'guru', 'Não informado', 1000, 900)], [source('guru')])
  assert.equal(unknown.payments.card.value, null)
  assert.equal(unknown.payments.boleto.value, null)
  assert.equal(unknown.payments.unknown.value, 900)
  const zero = buildRevenueBreakdown([row('zero', 'hotmart', 'Boleto', 1000, 0)], [source('hotmart')]).payments.boleto.providers[0]
  assert.equal(zero.cash.value, 0)
  assert.equal(zero.entry.value, null)
})
