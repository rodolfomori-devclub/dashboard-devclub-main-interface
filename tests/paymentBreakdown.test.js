import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { filterSales } from '../src/utils/salesData.js'

const names = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', asaas: 'Asaas', boletex: 'Boletex', manual: 'Manual' }
const source = (id, extra = {}) => ({ id, platform: names[id], label: names[id], kind: 'sale', status: 'ready', ...extra })
const row = (id, sourceId, payment, gross, net, extra = {}) => ({ id, sourceId, platform: names[sourceId], kind: 'sale', quantity: 1,
  payment, gross, net, revenue: net ?? gross, received: null, date: '2026-10-01T12:00:00Z', family: 'DevClub', utm: {}, ...extra })
const ids = group => group.providers.map(provider => provider.id)

test('each payment card lists only platforms in that commercial category in the filtered records', () => {
  const rows = [row('g-card', 'guru', 'Cartão', 1000, 900), row('g-pix', 'guru', 'Pix', 400, 390), row('h-boleto', 'hotmart', 'Boleto', 2000, 1800), row('t-boleto', 'tmb', 'Boleto', 3000, null, { family: 'MBA' })]
  const sources = Object.keys(names).map(id => source(id))
  const model = buildRevenueBreakdown(rows, sources)
  assert.deepEqual(ids(model.payments.card), ['guru', 'hotmart'])
  assert.deepEqual(ids(model.payments.boleto), ['tmb'])
  assert.deepEqual(ids(model.payments.pix), [])
  assert.equal(model.payments.card.value, 3090)
  assert.equal(model.payments.boleto.value, 3000)
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
  assert.equal(details.guru, undefined)
  assert.equal(details.hotmart, undefined)
  const cards = Object.fromEntries(model.payments.card.providers.map(provider => [provider.id, [provider.gross.value, provider.cash.value, provider.entry.value]]))
  assert.deepEqual(cards.guru, [900, 900, null])
  assert.deepEqual(cards.hotmart, [1880, 1880, null])
  assert.deepEqual(details.tmb, [3000, 1200, null])
  assert.deepEqual(details.boletex, [5000, null, null])
  assert.deepEqual(details.asaas, [4000, 300, 300])
  assert.equal(model.cash.value, 900 + 1880 + 1200 + 300)
  assert.equal(model.payments.boleto.value, 3000 + 5000 + 4000)
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

test('manual digital platform attribution applies full net cash once in the card category', () => {
  const rows = [row('g', 'guru', 'Boleto', 1000, 900), row('m', 'manual', 'Boleto', 500, 450, { isManual: true, platform: 'Guru', received: 100 }),
    row('mc', 'manual', 'Cartão', 600, 550, { isManual: true, platform: 'Guru', received: 200 })]
  const model = buildRevenueBreakdown(rows, [source('guru'), source('manual')])
  assert.deepEqual(ids(model.payments.boleto), [])
  assert.deepEqual(ids(model.payments.card), ['guru'])
  const card = model.payments.card.providers[0]
  assert.equal(card.gross.value, 1900)
  assert.equal(card.cash.value, 1900)
  assert.equal(card.value, 1900)
  assert.equal(card.entry.value, null)
  assert.equal(model.cash.value, 1900)
})

test('empty, unavailable and unclassified payment states stay distinct without fake platform rows', () => {
  const empty = buildRevenueBreakdown([], [source('guru')])
  assert.equal(empty.payments.card.value, 0)
  assert.deepEqual(ids(empty.payments.card), [])
  const failed = buildRevenueBreakdown([], [source('guru', { status: 'unavailable' }), source('manual')])
  assert.equal(failed.payments.card.value, null)
  assert.deepEqual(ids(failed.payments.card), [])
  const classified = buildRevenueBreakdown([row('known-platform', 'guru', 'Não informado', 1000, 900)], [source('guru')])
  assert.equal(classified.payments.card.value, 900)
  const unknown = buildRevenueBreakdown([row('unknown', 'manual', 'Não informado', 1000, 900, { isManual: true })], [source('manual')])
  assert.equal(unknown.payments.card.value, null)
  assert.equal(unknown.payments.boleto.value, null)
  assert.equal(unknown.payments.unknown.value, 900)
  const zero = buildRevenueBreakdown([row('zero', 'hotmart', 'Boleto', 1000, 0)], [source('hotmart')]).payments.card.providers[0]
  assert.equal(zero.cash.value, 0)
  assert.equal(zero.entry.value, null)
})

test('sales categories include all digital-platform sales and keep the other providers classified by payment', () => {
  const rows = [row('g-card', 'guru', 'Cartão', 1000, 900), row('g-pix', 'guru', 'Pix', 400, 390), row('h-boleto', 'hotmart', 'Boleto', 2000, 1800), row('t-boleto', 'tmb', 'Boleto', 3000, null, { family: 'MBA' })]
  const sources = Object.keys(names).map(id => source(id))
  const model = buildRevenueBreakdown(rows, sources)
  assert.deepEqual(ids(model.payments.card), ['guru', 'hotmart'])
  assert.deepEqual(ids(model.payments.boleto), ['tmb'])
  assert.deepEqual(ids(model.payments.pix), [])
  assert.equal(model.payments.card.value, 3090)
  assert.equal(model.payments.boleto.value, 3000)
  assert.equal(model.revenue.value, 6090)
  const mba = buildRevenueBreakdown(filterSales(rows, { family: 'MBA' }), sources, { family: 'MBA' })
  assert.deepEqual(ids(mba.payments.card), [])
  assert.deepEqual(ids(mba.payments.boleto), ['tmb'])
  assert.equal(mba.payments.card.value, 0)
})

test('65 card payments plus 10 Pix payments show all 75 Guru sales once in Cartão', () => {
  const rows = Array.from({ length: 75 }, (_, index) => row(`g-${index}`, 'guru', index < 65 ? 'Cartão' : 'Pix', 1000, 900))
  const original = structuredClone(rows)
  const model = buildRevenueBreakdown(rows, [source('guru')])
  assert.equal(model.payments.card.count, 75)
  assert.equal(model.payments.card.value, 67500)
  assert.equal(model.payments.card.providers[0].cash.value, 67500)
  assert.equal(model.payments.card.partial, false)
  assert.equal(model.gross.count, 75)
  for (const key of ['boleto', 'pix', 'unknown', 'other']) {
    assert.equal(model.payments[key].count, 0)
    assert.equal(model.payments[key].value, 0)
    assert.equal(model.payments[key].partial, false)
  }
  assert.equal(Object.values(model.payments).reduce((total, group) => total + (group.count ?? 0), 0), 75)
  assert.equal(Object.values(model.payments).reduce((total, group) => total + (group.value ?? 0), 0), model.revenue.value)
  assert.deepEqual(rows, original, 'business categorization preserves source payment methods')
  const card = buildRevenueBreakdown(filterSales(rows, { payment: 'Cartão' }), [source('guru')], { payment: 'Cartão' })
  assert.equal(card.payments.card.count, 75)
  assert.equal(card.payments.card.value, 67500)
  const pix = buildRevenueBreakdown(filterSales(rows, { payment: 'Pix' }), [source('guru')], { payment: 'Pix' })
  assert.equal(pix.payments.card.count, 0)
  assert.equal(pix.payments.card.value, 0)
  assert.deepEqual(pix.payments.pix.providers, [])
})

test('other providers retain Pix, boleto, card, other and unknown amounts without digital duplicates', () => {
  const rows = [row('g', 'guru', 'Pix', 1000, 900), row('h', 'hotmart', 'Boleto', 1000, 900),
    row('t', 'tmb', 'Boleto', 2000, null), row('m-pix', 'manual', 'Pix', 100, 90, { isManual: true, platform: 'Pix direto' }),
    row('m-card', 'manual', 'Cartão', 200, 180, { isManual: true, platform: 'Outra' }),
    row('m-other', 'manual', 'Paypal', 300, 270, { isManual: true, platform: 'Outra' }),
    row('m-unknown', 'manual', null, 400, 360, { isManual: true, platform: 'Outra' })]
  const model = buildRevenueBreakdown(rows, ['guru', 'hotmart', 'tmb', 'manual'].map(id => source(id)))
  assert.equal(model.payments.card.value, 1980)
  assert.equal(model.payments.boleto.value, 2000)
  assert.equal(model.payments.pix.value, 90)
  assert.equal(model.payments.other.value, 270)
  assert.equal(model.payments.unknown.value, 360)
  assert.equal(Object.values(model.payments).reduce((total, group) => total + (group.count ?? 0), 0), 7)
  assert.equal(Object.values(model.payments).reduce((total, group) => total + (group.value ?? 0), 0), model.revenue.value)
})

test('missing net, zero, unavailable sources and unknown non-digital methods preserve their meaning', () => {
  const missing = buildRevenueBreakdown([row('g-missing', 'guru', 'Pix', 1000, null)], [source('guru')])
  assert.equal(missing.payments.card.count, 1)
  assert.equal(missing.payments.card.value, null)
  assert.equal(missing.payments.card.partial, true)
  assert.equal(missing.payments.card.providers[0].cash.value, null)
  const zero = buildRevenueBreakdown([row('h-zero', 'hotmart', null, 1000, 0)], [source('hotmart')])
  assert.equal(zero.payments.card.count, 1)
  assert.equal(zero.payments.card.value, 0)
  assert.equal(zero.payments.card.partial, false)
  const unavailable = buildRevenueBreakdown([], [source('hotmart', { status: 'unavailable' })])
  assert.equal(unavailable.payments.card.value, null)
  assert.equal(unavailable.payments.card.count, null)
  assert.equal(unavailable.payments.card.partial, true)
  const mixed = buildRevenueBreakdown([row('g', 'guru', 'Pix', 1000, 900)], [source('guru'), source('hotmart', { status: 'unavailable' })])
  assert.equal(mixed.payments.card.value, 900)
  assert.equal(mixed.payments.card.partial, true)
  const unknown = buildRevenueBreakdown([row('m', 'manual', null, 100, 90, { isManual: true, platform: 'Outra' })], [source('manual')])
  assert.equal(unknown.payments.card.value, null)
  assert.equal(unknown.payments.unknown.value, 90)
})
