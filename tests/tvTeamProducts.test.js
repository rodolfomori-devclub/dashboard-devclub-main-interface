import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData } from '../src/components/tv/tvData.js'

const source = (id, extra = {}) => ({ id, label: id, platform: id, kind: 'sale', status: 'ready', ...extra })
const sale = (id, extra = {}) => ({ id, sourceId: 'hotmart', platform: 'Hotmart', kind: 'sale', quantity: 1,
  date: '2026-11-04', family: 'DevClub', product: 'DevClub', gross: 300, net: 300, revenue: 300, payment: 'Cartão', ...extra })
const directory = { teams: [{ id: 'mba-team', name: 'Comércial · mBa' }, { id: 'dev-team', name: 'Time Dev Club' }], individuals: [
  { id: 'ana', name: 'Ana', teamId: 'mba-team' }, { id: 'carol', name: 'Carol', teamId: 'mba-team' },
  { id: 'bia', name: 'Bia', teamId: 'dev-team' }, { id: 'excluded', name: 'Excluído', teamId: 'mba-team', excludedFromRanking: true },
] }
const run = overrides => buildTvData({ year: 2026, month: 11, today: '2026-11-05', metric: 'gross', directory,
  sales: { records: [], sources: [source('hotmart')] }, ...overrides })
const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`)

test('daily and weekly product families use their own periods across a month boundary', () => {
  const records = [sale('previous-sunday', { date: '2026-10-25', net: 9000 }),
    sale('monday', { date: '2026-10-26', family: 'MBA', product: 'MBA', net: 200 }),
    sale('today', { date: '2026-11-01', net: 300 }), sale('future', { date: '2026-11-02', net: 8000 })]
  const model = run({ today: '2026-11-01', sales: { records, sources: [source('hotmart')] }, weeklySales: { records, sources: [source('hotmart')] } })
  assert.equal(model.totals.gross, 300)
  assert.deepEqual(model.daily.products.map(row => [row.id, row.gross, row.cash, row.count]), [['DevClub', 300, 300, 1]])
  assert.deepEqual(model.weekly.products.map(row => [row.id, row.gross, row.cash, row.count]), [['DevClub', 300, 300, 1], ['MBA', 200, 200, 1]])
  assert.equal(model.weekly.gross, 500)
  assert.equal(model.weekly.startDate, '2026-10-26')
  assert.deepEqual(run({ month: 9 }).daily.products, [])
})

test('commercial revenue follows the UTM classification while seller teams follow current membership and exclusions', () => {
  const model = run({ sales: { records: [
    sale('ana-product-other', { sellerId: 'ana', net: 200 }),
    sale('manual-attribution-only', { sellerId: 'ana', net: 100, attributionMethod: 'manual' }),
    sale('bia-product-other', { sellerId: 'bia', family: 'MBA', net: 300, attributionMethod: 'utm' }),
    sale('excluded-commercial', { sellerId: 'excluded', net: 500, utm: { source: 'comercial-mba' } }),
    sale('unassigned-commercial', { net: 50, utm: { source: 'comercial' } }),
    sale('aggregate', { net: 100, isAggregate: true, quantity: 2, utm: { source: 'comercial' } }),
  ], sources: [source('hotmart')] } })
  assert.equal(model.weekly.gross, 1250)
  assert.equal(model.weekly.commercial.gross, 850)
  assert.equal(model.weekly.commercial.cash, 850)
  almost(model.weekly.commercialSharePercent, 68)
  assert.deepEqual(model.weekly.sellerTeams.map(team => [team.id, team.name, team.available, team.gross]), [['mba', 'MBA', true, 300], ['devclub', 'DevClub', true, 300]])
  assert.deepEqual(model.weekly.sellerTeams[0].sellers.map(row => row.id), ['ana'])
  assert.deepEqual(model.weekly.sellerTeams[1].sellers.map(row => row.id), ['bia'])
  assert.ok(model.weekly.sellerTeams.every(team => team.sellers.every(row => !Object.hasOwn(row, 'sharePercent'))))
  assert.equal(model.weekly.sellers.reduce((sum, row) => sum + row.gross, 0), 600)
})

test('team seller ordering follows the selected metric while full team totals precede visible ranking limits', () => {
  const sales = { records: [
    sale('tmb', { sourceId: 'tmb', platform: 'TMB', sellerId: 'ana', family: 'MBA', gross: 1000, payment: 'Boleto' }),
    sale('card', { sellerId: 'carol', net: 600 }), sale('second', { sellerId: 'carol', net: 1 }),
  ], sources: [source('tmb'), source('hotmart')] }
  const gross = run({ sales }).weekly.sellerTeams[0]
  assert.equal(gross.gross, 1601)
  assert.equal(gross.cash, 1001)
  assert.deepEqual(gross.sellers.map(row => row.id), ['ana', 'carol'])
  assert.ok(gross.sellers.every(row => !Object.hasOwn(row, 'sharePercent')))
  assert.deepEqual(run({ sales, metric: 'cash' }).weekly.sellerTeams[0].sellers.map(row => row.id), ['carol', 'ana'])
  assert.deepEqual(run({ sales, metric: 'count' }).weekly.sellerTeams[0].sellers.map(row => row.id), ['carol', 'ana'])
  const individuals = Array.from({ length: 10 }, (_, index) => ({ id: `seller-${index}`, name: `Pessoa ${index}`, teamId: 'mba-team' }))
  const many = run({ directory: { ...directory, individuals }, sales: { records: individuals.map((person, index) => sale(person.id, { sellerId: person.id, net: index + 1 })), sources: [source('hotmart')] } }).weekly.sellerTeams[0]
  assert.equal(many.gross, 55)
  assert.equal(many.sellers.length, 10)
  assert.equal(many.sellers.slice(0, 8).reduce((sum, row) => sum + row.gross, 0), 52)
  assert.ok(many.sellers.every(row => !Object.hasOwn(row, 'sharePercent')))
})

test('zero, missing amounts and partial attribution suppress the commercial percentage without substituting unknown amounts', () => {
  const fixtures = [
    { records: [sale('zero', { sellerId: 'ana', net: 0, attributionMethod: 'utm' })], sources: [source('hotmart')] },
    { records: [sale('missing', { sellerId: 'ana', net: null, attributionMethod: 'utm' })], sources: [source('hotmart')] },
    { records: [sale('partial', { sellerId: 'ana', net: 100, attributionMethod: 'utm' })], sources: [source('hotmart', { status: 'partial' })] },
    { records: [sale('unknown-attribution', { sellerId: 'ana', net: 100, attributionMethod: 'utm' })], sources: [source('hotmart')], ledger: { attributionMappingsStatus: 'unavailable' } },
  ]
  for (const sales of fixtures) {
    const week = run({ sales }).weekly
    assert.equal(week.commercialSharePercent, null)
    assert.equal(Object.hasOwn(week.sellerTeams[0].sellers[0], 'sharePercent'), false)
  }
  assert.equal(run({ sales: fixtures[0] }).weekly.commercial.gross, 0)
  assert.equal(run({ sales: fixtures[1] }).weekly.commercial.gross, null)
  const missingCash = run({ metric: 'cash', sales: { records: [sale('asaas', { sourceId: 'asaas', platform: 'Asaas', sellerId: 'ana', gross: 1000, received: null, attributionMethod: 'utm' })], sources: [source('asaas')] } }).weekly
  assert.equal(missingCash.commercial.cash, null)
  assert.equal(missingCash.commercialSharePercent, 100)
  assert.equal(Object.hasOwn(missingCash.sellerTeams[0].sellers[0], 'sharePercent'), false)
})

test('missing, ambiguous or unavailable team membership never falls back to product families', () => {
  const sales = { records: [sale('one', { sellerId: 'ana', family: 'MBA' })], sources: [source('hotmart')] }
  const directories = [
    { ...directory, teams: [{ id: 'mba-team', name: 'AMBA' }, { id: 'dev-team', name: 'DevClubPlus' }] },
    { ...directory, teams: [...directory.teams, { id: 'duplicate', name: 'MBA' }, { id: 'duplicate-dev', name: 'DevClub' }] },
    { ...directory, teams: [{ id: 'mba-team', name: 'MBA e DevClub' }] },
  ]
  for (const currentDirectory of directories) {
    const teams = run({ sales, directory: currentDirectory }).weekly.sellerTeams
    assert.ok(teams.every(team => !team.available && team.gross === null && team.cash === null && team.sellers.length === 0))
  }
  const failed = run({ sales, directoryError: true }).weekly
  assert.ok(failed.sellerTeams.every(team => !team.available && team.gross === null && team.sellers.length === 0))
  assert.equal(failed.gross, 300)
  assert.equal(failed.commercial.gross, 0)
})

test('daily and weekly product breakdowns preserve unknown families without allocating them to a known product', () => {
  const model = run({ sales: { records: [sale('known', { date: '2026-11-05', net: 30 }),
    sale('unknown-today', { date: '2026-11-05', family: null, product: null, net: 50 }),
    sale('unknown-week', { date: '2026-11-03', family: null, product: null, net: 40 })], sources: [source('hotmart')] } })
  assert.equal(model.daily.products.find(row => row.name === 'Não informado').gross, 50)
  assert.equal(model.weekly.products.find(row => row.name === 'Não informado').gross, 90)
  assert.equal(model.weekly.products.find(row => row.name === 'DevClub').gross, 30)
  assert.equal(model.products.some(row => row.name === 'Não informado'), false)
  assert.equal(model.unassigned.product.gross, 90)
})

test('archived and inactive teams cannot match or make current MBA and DevClub teams ambiguous', () => {
  const retiredTeams = [{ id: 'old-mba', name: 'Time MBA', archived: true }, { id: 'old-dev', name: 'Time DevClub', active: false }]
  const people = [...directory.individuals, { id: 'old-seller', name: 'Pessoa antiga', teamId: 'old-mba' }]
  const sales = { records: [sale('mba', { sellerId: 'ana', net: 200 }), sale('dev', { sellerId: 'bia', net: 300 }),
    sale('retired', { sellerId: 'old-seller', net: 100 })], sources: [source('hotmart')] }
  const current = run({ sales, directory: { teams: [...directory.teams, ...retiredTeams], individuals: people } }).weekly
  assert.deepEqual(current.sellerTeams.map(team => [team.available, team.gross]), [[true, 200], [true, 300]])
  assert.equal(current.gross, 600)
  const retiredOnly = run({ sales, directory: { teams: retiredTeams, individuals: people } }).weekly
  assert.ok(retiredOnly.sellerTeams.every(team => !team.available && team.gross === null && team.sellers.length === 0))
  assert.equal(retiredOnly.gross, 600)
})
