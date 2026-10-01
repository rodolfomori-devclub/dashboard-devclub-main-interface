import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData, resolveTvPeriod } from '../src/components/tv/tvData.js'

const source = (id, extra = {}) => ({ id, label: id, platform: id, kind: 'sale', status: 'ready', ...extra })
const sale = (id, extra = {}) => ({ id, sourceId: 'hotmart', platform: 'Hotmart', kind: 'sale', quantity: 1,
  date: '2026-10-01T14:00:00Z', family: 'DevClub', gross: 300, net: 277.88, revenue: 277.88, payment: 'Cartão', ...extra })
const directory = { teams: [{ id: 'sales', name: 'Vendas' }, { id: 'marketing', name: 'Marketing' }],
  individuals: [{ id: 'ana', name: 'Ana', teamId: 'sales' }, { id: 'bia', name: 'Bia', teamId: 'marketing' }] }
const invoice = source('asaas', { status: 'partial', salesAvailable: false, cash: { gross: 1255.36, net: 1238.08, count: 6 },
  cashReceipts: [{ date: '2026-10-01', received: 1255.36, count: 6 }] })
const run = overrides => buildTvData({ year: 2026, month: 10, today: '2026-10-15', metric: 'cash', directory,
  sales: { records: [sale('1', { sellerId: 'ana' }), sale('2', { sellerId: 'ana' }), sale('3', { sellerId: 'bia' })], sources: [source('hotmart'), invoice] }, ...overrides })
const almost = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`)

test('TV uses new sales only: the reported 833.64 remains independent of Asaas invoices', () => {
  const model = run()
  almost(model.totals.cash, 833.64)
  almost(model.overview.actual, 833.64)
  almost(model.pace.rows[0].actual, 833.64)
  almost(model.products[0].value, 833.64)
  assert.equal(model.totals.gross, 900)
  assert.equal(model.totals.count, 3)
  assert.equal(model.coverage.find(item => item.id === 'asaas').status, 'unavailable')
  assert.equal(model.overview.definitive, false)
})

test('TMB contributes 40% once to cash, while preserving its full gross and payment method', () => {
  const model = run({ sales: { records: [sale('1'), sale('tmb1', { sourceId: 'tmb', platform: 'TMB', gross: 1000,
    revenue: 1000, received: 9999, family: 'MBA', payment: 'Boleto', sellerId: 'ana' })],
  sources: [source('hotmart'), source('tmb'), invoice] } })
  almost(model.totals.cash, 677.88)
  assert.equal(model.totals.gross, 1300)
  assert.equal(model.products.find(row => row.id === 'MBA').value, 400)
  assert.equal(model.sellers.find(row => row.id === 'ana').value, 400)
  assert.equal(model.payments.find(row => row.id === 'boleto').value, 400)
  assert.equal(model.payments.find(row => row.id === 'boleto').count, 1)
})

test('native Asaas new-contract entry contributes; its account statement and linked manuals never do', () => {
  const model = run({ sales: { records: [sale('native', { sourceId: 'asaas', gross: 2000, revenue: 2000, received: 200, payment: 'Boleto' }),
    sale('invoice', { sourceId: 'asaas', isReceipt: true, received: 1255.36 }),
    sale('linked', { sourceId: 'manual', isManual: true, received: 200, original: { linkedExternalId: 'native' } })],
  sources: [source('asaas', { cashReceipts: invoice.cashReceipts }), source('manual')] } })
  assert.equal(model.totals.gross, 2000)
  assert.equal(model.totals.cash, 200)
  assert.equal(model.totals.count, 1)
  assert.equal(model.products[0].value, 200)
})

test('manual cash and quantities are not combined with legacy Hub totals', () => {
  const model = run({ sales: { total: 999999, records: [sale('manual', { sourceId: 'manual', isManual: true,
    received: 80, sellerId: 'ana', date: '2026-10-15T12:00:00-03:00' })], sources: [source('manual')] } })
  assert.equal(model.totals.cash, 80)
  assert.equal(model.sellers[0].value, 80)
  assert.equal(model.daily.unknownHourCount, 1)
  assert.equal(model.daily.hours.reduce((total, row) => total + row.count, 0), 0)
})

test('missing monetary metadata stays unavailable instead of becoming a zero', () => {
  const model = run({ sales: { records: [sale('unknown', { gross: null, net: null, revenue: null })], sources: [source('hotmart')] } })
  assert.equal(model.totals.cash, null)
  assert.equal(model.totals.gross, null)
  assert.equal(model.products[0].value, null)
  assert.equal(model.payments.find(row => row.id === 'card').value, null)
  assert.equal(model.totals.count, 1)
  assert.equal(model.products[0].partial, true)
})

test('complete empty sources can show zero, while unavailable sources cannot', () => {
  const available = run({ sales: { records: [], sources: [source('hotmart')] } })
  const unavailable = run({ sales: { records: [], sources: [source('hotmart', { status: 'unavailable' })] } })
  assert.equal(available.totals.cash, 0)
  assert.equal(available.totals.count, 0)
  assert.equal(unavailable.totals.cash, null)
  assert.equal(unavailable.totals.count, null)
  assert.equal(unavailable.payments[0].value, null)
  const invoicesOnly = run({ sales: { records: [], sources: [invoice] } })
  assert.equal(invoicesOnly.totals.gross, null)
  assert.equal(invoicesOnly.totals.count, null)
  assert.equal(invoicesOnly.totals.cash, null)
})

test('ranking retains real identities and keeps unattributed revenue separate', () => {
  const model = run({ directory: { ...directory, individuals: directory.individuals.map(person => ({ ...person, name: 'Mesmo nome' })) },
    sales: { records: [sale('1', { sellerId: 'ana' }), sale('2', { sellerId: 'bia' }), sale('3', { sellerName: 'Ana' })], sources: [source('hotmart')] } })
  assert.deepEqual(model.sellers.map(row => row.id).sort(), ['ana', 'bia'])
  assert.equal(model.sellers.length, 2)
  assert.equal(model.unassigned.seller.count, 1)
  almost(model.unassigned.seller.value, 277.88)
  almost(model.sellers.reduce((total, row) => total + row.value, 0) + model.unassigned.seller.value, model.totals.cash)
})

test('independent scope plans share one ledger and support selected team pace', () => {
  const plans = [
    { scope: 'overall', metric: 'cash', target: 10000 },
    { scope: 'team', scopeId: 'sales', metric: 'cash', target: 4000 },
    { scope: 'team', scopeId: 'marketing', metric: 'cash', target: 6000 },
    { scope: 'product', scopeId: 'DevClub', metric: 'cash', target: 10000 },
    { scope: 'individual', scopeId: 'ana', metric: 'cash', target: 4000 },
  ]
  const model = run({ plans, paceScope: 'team', paceScopeId: 'sales' })
  almost(model.overview.actual, 833.64)
  almost(model.pace.actual, 555.76)
  assert.equal(model.paceName, 'Vendas')
  assert.equal(model.pace.target, 4000)
  assert.equal(model.teamGoals.length, 2)
  assert.equal(model.productGoals[0].pace.target, 10000)
  assert.equal(model.individualGoals[0].id, 'ana')
})

test('failed participant directory cannot manufacture people totals; financial attribution stays intact', () => {
  const model = run({ directoryError: true, paceScope: 'team', paceScopeId: 'sales',
    plans: [{ scope: 'team', scopeId: 'sales', metric: 'cash', target: 4000 }] })
  assert.equal(model.pace.actual, null)
  assert.equal(model.teamGoals[0].pace.actual, null)
  assert.equal(model.unassigned.team.value, null)
  assert.equal(model.sellers.length, 0)
  assert.equal(model.unassigned.seller.value, null)
  almost(model.totals.cash, 833.64)
})

test('missing target keeps actuals but never invents a goal or a pace percentage', () => {
  const model = run({ plansError: true, paceScope: 'individual', paceScopeId: 'ana' })
  assert.equal(model.pace.target, null)
  assert.equal(model.pace.pacePercent, null)
  assert.equal(model.pacePlan, null)
  almost(model.pace.actual, 555.76)
})

test('Brasília dates control daily totals, hours and month window without counting future sales', () => {
  const model = run({ today: '2026-10-01', sales: { records: [
    sale('previous', { date: '2026-10-01T02:59:59Z' }),
    sale('today', { date: '2026-10-02T02:59:59Z' }),
    sale('future', { date: '2026-10-02T03:00:00Z' }),
  ], sources: [source('hotmart')] } })
  almost(model.totals.cash, 277.88)
  almost(model.daily.cash, 277.88)
  almost(model.daily.hours[23].value, 277.88)
  assert.equal(model.daily.count, 1)
})

test('today is unavailable for an archived month and missing today snapshots are not zero', () => {
  const archive = run({ month: 9 })
  assert.equal(archive.daily.inSelectedMonth, false)
  assert.equal(archive.daily.cash, null)
  assert.ok(archive.daily.hours.every(row => row.value === null))
  const missingToday = run({ sales: { records: [sale('1')], sources: [source('hotmart', { snapshots: [
    { startDate: '2026-10-01', endDate: '2026-10-14', status: 'ready' },
    { startDate: '2026-10-15', endDate: '2026-10-15', status: 'unavailable' },
  ] })] } })
  almost(missingToday.totals.cash, 277.88)
  assert.equal(missingToday.daily.cash, null)
  assert.ok(missingToday.daily.hours.every(row => row.value === null))
})

test('current month advances at Brasília midnight and explicit archived month stays selected', () => {
  const before = resolveTvPeriod('current', new Date('2026-11-01T02:59:59Z'))
  const after = resolveTvPeriod('current', new Date('2026-11-01T03:00:00Z'))
  assert.equal(before.key, '2026-10')
  assert.equal(before.today, '2026-10-31')
  assert.equal(after.key, '2026-11')
  assert.equal(after.observedEnd, '2026-11-01')
  assert.equal(resolveTvPeriod('2026-09', new Date('2026-11-01T03:00:00Z')).observedEnd, '2026-09-30')
  assert.equal(resolveTvPeriod('2026-13', new Date('2026-11-01T03:00:00Z')).key, '2026-11')
})

test('refunds and unknown products cannot inflate rankings or invent product identity', () => {
  const model = run({ sales: { records: [sale('refund', { kind: 'refund', gross: 50000 }),
    sale('unknown', { family: null, product: null })], sources: [source('hotmart')] } })
  assert.equal(model.totals.count, 1)
  assert.equal(model.products.length, 0)
  almost(model.unassigned.product.value, 277.88)
})

test('retained values after a failed refresh remain visible without asserting a definitive pace', () => {
  const model = run({ salesError: true, sales: { records: [sale('1', { sellerId: 'ana' })], sources: [source('hotmart')] },
    plans: [{ scope: 'overall', metric: 'cash', target: 1000 }] })
  almost(model.overview.actual, 277.88)
  assert.equal(model.overview.definitive, false)
  assert.equal(model.totals.partial, true)
  assert.equal(model.sellers[0].partial, true)
  assert.equal(model.coverage[0].status, 'partial')
})
