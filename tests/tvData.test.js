import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData, resolveTvPeriod } from '../src/components/tv/tvData.js'
import { normalizeSource } from '../src/utils/salesData.js'

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
  assert.equal(model.totals.gross, 833.64)
  assert.equal(model.totals.count, 3)
  assert.equal(model.coverage.find(item => item.id === 'asaas').status, 'unavailable')
  assert.equal(model.overview.definitive, false)
})

test('TMB contributes 40% once to cash, while preserving its full gross and payment method', () => {
  const model = run({ sales: { records: [sale('1'), sale('tmb1', { sourceId: 'tmb', platform: 'TMB', gross: 1000,
    revenue: 1000, received: 9999, family: 'MBA', payment: 'Boleto', sellerId: 'ana' })],
  sources: [source('hotmart'), source('tmb'), invoice] } })
  almost(model.totals.cash, 677.88)
  assert.equal(model.totals.gross, 1277.88)
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
  const model = run({ sales: { total: 999999, records: [sale('manual', { sourceId: 'manual', platform: 'Pix direto', isManual: true,
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

test('every TV financial scene includes gross and cash without changing a cash goal or ranking basis', () => {
  const plans = [
    { scope: 'overall', metric: 'cash', target: 2000 },
    { scope: 'overall', metric: 'gross', target: 9000 },
    { scope: 'team', scopeId: 'sales', metric: 'cash', target: 1000 },
    { scope: 'product', scopeId: 'MBA', metric: 'cash', target: 1000 },
  ]
  const model = run({ today: '2026-10-01', plans, paceScope: 'team', paceScopeId: 'sales', sales: {
    records: [sale('tmb', { sourceId: 'tmb', platform: 'TMB', gross: 1000, family: 'MBA', payment: 'Boleto', sellerId: 'ana' }),
      sale('hotmart', { gross: 700, net: 650, sellerId: 'bia' })], sources: [source('tmb'), source('hotmart')],
  } })
  assert.equal(model.overview.gross, 1650)
  assert.equal(model.overview.cash, 1050)
  assert.equal(model.overview.actual, 1050)
  assert.equal(model.overview.target, 2000)
  assert.equal(model.overview.attainment, 52.5)
  assert.deepEqual(model.sellers.map(row => row.id), ['bia', 'ana'], 'explicit cash order remains cash order')
  assert.equal(model.sellers[1].gross, 1000)
  assert.equal(model.sellers[1].cash, 400)
  for (const scoped of [model.pace, model.teamGoals[0], model.productGoals[0], model.products.find(row => row.id === 'MBA'), model.payments.find(row => row.id === 'boleto')]) {
    assert.equal(scoped.gross, 1000)
    assert.equal(scoped.cash, 400)
    assert.equal(scoped.grossPartial, false)
    assert.equal(scoped.cashPartial, false)
  }
  assert.equal(model.pace.target, 1000)
  assert.equal(model.pace.actual, 400)
  assert.equal(model.pace.attainment, 40)
  assert.equal(model.daily.gross, 1650)
  assert.equal(model.daily.cash, 1050)
  assert.equal(model.daily.hours[11].gross, 1650)
  assert.equal(model.daily.hours[11].cash, 1050)
})

test('gross and cash availability stay independent across scopes, payment groups and hourly readings', () => {
  const model = run({ today: '2026-10-01', sales: {
    records: [sale('missing-entry', { sourceId: 'asaas', platform: 'Asaas', gross: 1000, received: null, sellerId: 'ana' })], sources: [source('asaas')],
  } })
  for (const row of [model.totals, model.overview, model.sellers[0], model.products[0], model.payments.find(row => row.id === 'card'), model.daily, model.daily.hours[11]]) {
    assert.equal(row.gross, 1000)
    assert.equal(row.cash, null)
    assert.equal(row.grossPartial, false)
    assert.equal(row.cashPartial, true)
  }
  const explicitZero = run({ sales: { records: [sale('free', { gross: 0, net: 0 })], sources: [source('hotmart')] } })
  assert.equal(explicitZero.totals.gross, 0)
  assert.equal(explicitZero.totals.cash, 0)
  assert.equal(explicitZero.totals.cashPartial, false)
})

test('a provider with gross sales and no current cash ledger remains visible in cash-selected rankings', () => {
  const model = run({ sales: { records: [sale('boletex-sale', { sourceId: 'boletex', sellerId: 'ana', gross: 1200, received: 100 })],
    sources: [source('boletex')] } })
  assert.equal(model.sellers.length, 1)
  assert.equal(model.products.length, 1)
  assert.equal(model.sellers[0].gross, 1200)
  assert.equal(model.sellers[0].cash, null)
  assert.equal(model.sellers[0].cashPartial, true)
  assert.equal(model.payments.find(row => row.id === 'boleto').gross, 1200)
  assert.equal(model.payments.find(row => row.id === 'boleto').cash, null)
})

test('unassigned totals show both metrics while excluded sellers stay out of people-based figures only', () => {
  const model = run({ directory: { ...directory, individuals: directory.individuals.map(person => ({ ...person, excludedFromRanking: person.id === 'ana' })) },
    sales: { records: [sale('excluded', { sellerId: 'ana', gross: 900, net: 800 }), sale('assigned', { sellerId: 'bia', gross: 500, net: 450 }),
      sale('unassigned', { gross: 300, net: 250 })], sources: [source('hotmart')] } })
  assert.deepEqual(model.sellers.map(row => row.id), ['bia'])
  assert.equal(model.sellers[0].gross, 450)
  assert.equal(model.sellers[0].cash, 450)
  assert.equal(model.unassigned.seller.gross, 250)
  assert.equal(model.unassigned.seller.cash, 250)
  assert.equal(model.totals.gross, 1500)
  assert.equal(model.totals.cash, 1500)
  assert.equal(model.products[0].gross, 1500)
  assert.equal(model.products[0].cash, 1500)
})

test('unavailable participant data cannot expose scoped gross/cash; archived daily hours never become zero', () => {
  const model = run({ directoryError: true, paceScope: 'team', paceScopeId: 'sales',
    plans: [{ scope: 'team', scopeId: 'sales', metric: 'cash', target: 4000 }] })
  for (const row of [model.pace, model.teamGoals[0], model.unassigned.seller, model.unassigned.team]) {
    assert.equal(row.gross, null)
    assert.equal(row.cash, null)
    assert.equal(row.grossPartial, true)
    assert.equal(row.cashPartial, true)
  }
  const archive = run({ month: 9 })
  assert.ok(archive.daily.hours.every(row => row.gross === null && row.cash === null && row.grossPartial && row.cashPartial))
})

test('TV model defaults and invalid metric fallback use gross with both amounts still available', () => {
  for (const metric of [undefined, 'unexpected']) {
    const model = run({ metric })
    assert.equal(model.metric, 'gross')
    assert.equal(model.overview.actual, 833.64)
    assert.equal(model.overview.gross, 833.64)
    almost(model.overview.cash, 833.64)
  }
})

test('daily programming uses only today for payment mix, cash and seller order, independently of monthly leaders', () => {
  const sales = { records: [
    sale('old-leader', { sellerId: 'bia', net: 9000 }),
    sale('today-card', { sellerId: 'bia', net: 600, date: '2026-10-15T14:00:00Z' }),
    sale('today-boleto', { sourceId: 'tmb', platform: 'TMB', gross: 1000, payment: 'Boleto', sellerId: 'ana', date: '2026-10-16T02:59:59Z' }),
    sale('today-unassigned', { net: 100, date: '2026-10-15T15:00:00Z' }),
    sale('tomorrow', { net: 5000, sellerId: 'bia', date: '2026-10-16T03:00:00Z' }),
  ], sources: [source('hotmart'), source('tmb')] }
  const model = run({ metric: 'gross', sales })
  assert.equal(model.sellers[0].id, 'bia')
  assert.deepEqual(model.daily.sellers.map(row => row.id), ['ana', 'bia'])
  assert.equal(model.daily.gross, 1700)
  assert.equal(model.daily.cash, 1100)
  assert.equal(model.daily.count, 3)
  const boleto = model.daily.payments.find(row => row.id === 'boleto')
  assert.equal(boleto.value, 1000)
  assert.equal(boleto.cash, 400)
  assert.equal(boleto.count, 1)
  assert.equal(model.daily.payments.find(row => row.id === 'card').gross, 700)
  assert.equal(model.daily.unassignedSeller.gross, 100)
  assert.equal(model.daily.unassignedSeller.count, 1)
  assert.equal(model.daily.sellers[0].gross, 1000)
  assert.equal(model.daily.sellers[0].cash, 400)
  assert.deepEqual(run({ metric: 'cash', sales }).daily.sellers.map(row => row.id), ['bia', 'ana'])
})

test('daily rankings respect exclusions and directory failures while company payments keep all sales', () => {
  const options = { sales: { records: [
    sale('excluded', { net: 800, sellerId: 'ana', date: '2026-10-15' }),
    sale('included', { net: 400, sellerId: 'bia', date: '2026-10-15' }),
    sale('unassigned', { net: 100, date: '2026-10-15' }),
  ], sources: [source('hotmart')] },
  directory: { ...directory, individuals: directory.individuals.map(person => ({ ...person, excludedFromRanking: person.id === 'ana' })) } }
  const model = run(options)
  assert.deepEqual(model.daily.sellers.map(row => row.id), ['bia'])
  assert.equal(model.daily.unassignedSeller.value, 100)
  assert.equal(model.daily.payments.find(row => row.id === 'card').gross, 1300)
  assert.equal(model.daily.gross, 1300)
  const unavailable = run({ ...options, directoryError: true })
  assert.deepEqual(unavailable.daily.sellers, [])
  assert.equal(unavailable.daily.unassignedSeller.gross, null)
  assert.equal(unavailable.daily.unassignedSeller.cash, null)
  assert.equal(unavailable.daily.gross, 1300)
})

test('daily payment and seller cash retain unknown metadata and unavailable day coverage', () => {
  const missingCash = run({ sales: { records: [sale('entry', { sourceId: 'asaas', sellerId: 'ana', gross: 1000,
    received: null, date: '2026-10-15', payment: 'Boleto' })], sources: [source('asaas')] } })
  for (const row of [missingCash.daily.sellers[0], missingCash.daily.payments.find(row => row.id === 'boleto')]) {
    assert.equal(row.gross, 1000)
    assert.equal(row.cash, null)
    assert.equal(row.cashPartial, true)
  }
  const unavailable = run({ sales: { records: [], sources: [source('hotmart', { snapshots: [
    { startDate: '2026-10-01', endDate: '2026-10-14', status: 'ready' },
    { startDate: '2026-10-15', endDate: '2026-10-15', status: 'unavailable' },
  ] })] } })
  const archive = run({ month: 9 })
  for (const model of [unavailable, archive]) {
    assert.ok(model.daily.payments.every(row => row.gross === null && row.cash === null && row.value === null))
    assert.equal(model.daily.unassignedSeller.value, null)
    assert.deepEqual(model.daily.sellers, [])
  }
  const empty = run({ sales: { records: [], sources: [source('hotmart')] } })
  assert.ok(empty.daily.payments.every(row => row.gross === 0 && row.cash === 0 && !row.partial))
  assert.equal(empty.daily.unassignedSeller.value, 0)
})

test('TV groups raw Hotmart Pix and Guru boleto as Cartão without changing ledger payments or counting twice', () => {
  const records = [
    ...normalizeSource('hotmart', { success: true, data: { count: 1, totalNet: 277.88, totalGross: 300, totalFees: 22.12,
      transactions: [{ transaction: 'hotmart-pix', product: 'DevClub', grossValue: 300, netValue: 277.88, fee: 22.12,
        paymentMethod: 'PIX', orderDate: '2026-10-15T15:00:00Z' }] } }),
    ...normalizeSource('guru', { success: true, data: [{ id: 'guru-boleto', product: { name: 'DevClub' }, payment: { method: 'boleto' },
      dates: { created_at: '2026-10-15T15:00:00Z' }, calculation_details: { net_amount: 200 } }] }),
    sale('tmb-boleto', { sourceId: 'tmb', platform: 'TMB', gross: 1000, payment: 'Boleto', date: '2026-10-15T15:00:00Z' }),
  ]
  const originalPayments = records.map(row => row.payment)
  assert.deepEqual(originalPayments, ['Pix', 'Boleto', 'Boleto'])
  for (const metric of ['gross', 'cash', 'count']) {
    const model = run({ metric, sales: { records, sources: [source('hotmart'), source('guru'), source('tmb')] } })
    for (const payments of [model.payments, model.daily.payments]) {
      const card = payments.find(row => row.id === 'card')
      almost(card.gross, 477.88)
      almost(card.cash, 477.88)
      almost(card.value, metric === 'count' ? 2 : 477.88)
      assert.equal(card.count, 2)
      assert.equal(payments.find(row => row.id === 'pix').count, 0)
      assert.equal(payments.find(row => row.id === 'boleto').count, 1)
      assert.equal(payments.find(row => row.id === 'boleto').gross, 1000)
      assert.equal(payments.reduce((count, row) => count + row.count, 0), 3)
    }
  }
  assert.deepEqual(records.map(row => row.payment), originalPayments)
})

test('week-to-date starts Monday in Brasília and spans the year without counting Sunday or future records', () => {
  const weeklySales = { records: [
    sale('sunday', { date: '2025-12-29T02:59:59Z', net: 9000 }),
    sale('monday', { date: '2025-12-29T03:00:00Z', net: 200, sellerId: 'ana' }),
    sale('wednesday', { date: '2025-12-31', net: 300, sellerId: 'ana' }),
    sale('today', { date: '2026-01-03T02:59:59Z', net: 400, sellerId: 'bia' }),
    sale('tomorrow', { date: '2026-01-03T03:00:00Z', net: 8000 }),
    sale('undated', { date: null, net: 7000 }),
  ], sources: [source('hotmart')] }
  const model = run({ year: 2026, month: 1, today: '2026-01-02', sales: weeklySales, weeklySales })
  assert.equal(model.weekly.startDate, '2025-12-29')
  assert.equal(model.weekly.endDate, '2026-01-02')
  assert.equal(model.weekly.gross, 900)
  assert.equal(model.weekly.cash, 900)
  assert.equal(model.weekly.count, 3)
  assert.deepEqual(model.weekly.days.map(day => day.date), ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
  assert.deepEqual(model.weekly.days.map(day => day.gross), [200, 0, 300, 0, 400])
  assert.equal(model.weekly.partial, true, 'undated sales cannot be allocated into this week')
  assert.deepEqual(model.weekly.sellers.map(row => row.id), ['ana', 'bia'])
})

test('weekly cash rules, rankings and payments remain independent of the monthly leader', () => {
  const sales = { records: [sale('old', { net: 10000, sellerId: 'bia' }),
    sale('tmb', { date: '2026-10-12', sourceId: 'tmb', platform: 'TMB', gross: 1000, sellerId: 'ana', payment: 'Boleto' }),
    sale('card', { date: '2026-10-15', net: 600, sellerId: 'bia', payment: 'Pix' }),
    sale('unassigned', { date: '2026-10-14', net: 100 }),
    sale('invoice', { date: '2026-10-15', kind: 'receipt', isReceipt: true, net: 9000 }),
    sale('linked', { date: '2026-10-15', isManual: true, linkedExternalId: 'card', net: 9000 }),
  ], sources: [source('hotmart'), source('tmb')] }
  const model = run({ sales, metric: 'gross' })
  assert.equal(model.weekly.gross, 1700)
  assert.equal(model.weekly.cash, 1100)
  assert.equal(model.weekly.count, 3)
  assert.deepEqual(model.weekly.sellers.map(row => row.id), ['ana', 'bia'])
  assert.equal(model.sellers[0].id, 'bia')
  assert.deepEqual(run({ sales, metric: 'cash' }).weekly.sellers.map(row => row.id), ['bia', 'ana'])
  assert.equal(model.weekly.payments.find(row => row.id === 'card').gross, 700)
  assert.equal(model.weekly.payments.find(row => row.id === 'boleto').cash, 400)
  assert.equal(model.weekly.unassignedSeller.gross, 100)
})

test('weekly unavailable days remain null while ready days and empty complete weeks can be zero', () => {
  const sales = { records: [sale('today', { date: '2026-10-15', net: 100 })], sources: [source('hotmart', { status: 'partial', snapshots: [
    { startDate: '2026-10-01', endDate: '2026-10-14', status: 'unavailable' },
    { startDate: '2026-10-15', endDate: '2026-10-15', status: 'ready' },
  ] })] }
  const weekly = run({ sales }).weekly
  assert.equal(weekly.gross, 100)
  assert.equal(weekly.partial, true)
  assert.deepEqual(weekly.days.map(day => day.gross), [null, null, null, 100])
  assert.deepEqual(weekly.days.map(day => day.cash), [null, null, null, 100])
  assert.equal(weekly.days.at(-1).grossPartial, false)
  const empty = run({ sales: { records: [], sources: [source('hotmart')] } }).weekly
  assert.equal(empty.gross, 0)
  assert.equal(empty.cash, 0)
  assert.equal(empty.partial, false)
})

test('weekly unknown cash, directory failure and attribution status do not borrow monthly availability', () => {
  const weeklySales = { records: [sale('entry', { date: '2026-10-15', sourceId: 'asaas', gross: 1000,
    received: null, sellerId: 'ana' })], sources: [source('asaas')], operationsStatus: 'unavailable' }
  const model = run({ weeklySales, directoryError: true })
  assert.equal(model.weekly.gross, 1000)
  assert.equal(model.weekly.cash, null)
  assert.equal(model.weekly.cashPartial, true)
  assert.equal(model.weekly.attributionAvailable, false)
  assert.equal(model.attributionAvailable, true)
  assert.deepEqual(model.weekly.sellers, [])
  assert.equal(model.weekly.unassignedSeller.gross, null)
  const excluded = run({ weeklySales: { ...weeklySales, operationsStatus: 'ready' },
    directory: { ...directory, individuals: directory.individuals.map(person => ({ ...person, excludedFromRanking: true })) } })
  assert.deepEqual(excluded.weekly.sellers, [])
  assert.equal(excluded.weekly.gross, 1000)
  const missingMappings = { ...weeklySales, operationsStatus: 'ready', ledger: { attributionMappingsStatus: 'unavailable' } }
  const independent = run({ weeklySales: missingMappings })
  assert.equal(independent.attributionAvailable, true)
  assert.equal(independent.weekly.attributionAvailable, false)
  assert.equal(independent.weekly.partial, true)
  assert.equal(independent.weekly.sellers[0].partial, true)
  const shared = run({ sales: missingMappings })
  assert.equal(shared.attributionAvailable, false)
  assert.equal(shared.weekly.attributionAvailable, false)
  assert.equal(shared.sellers[0].partial, true)
  assert.equal(shared.daily.sellers[0].partial, true)
  assert.equal(shared.weekly.sellers[0].partial, true)
  assert.equal(shared.weekly.gross, 1000, 'missing attribution mappings do not discard known financial values')
})

test('archived months and a week crossing the month require their own current-week ledger', () => {
  const archive = run({ month: 9 })
  assert.equal(archive.weekly.gross, null)
  const missingPreviousMonth = run({ today: '2026-10-01' })
  assert.equal(missingPreviousMonth.weekly.gross, null)
  const current = run({ month: 9, weeklySales: { records: [sale('week', { date: '2026-10-15', net: 120 })], sources: [source('hotmart')] } })
  assert.equal(current.weekly.gross, 120)
  assert.equal(current.totals.gross, 0)
})

test('weekly quantities describe all new sales even when their cash ledger is unavailable', () => {
  const model = run({ metric: 'cash', sales: { records: [
    sale('contract', { sourceId: 'boletex', date: '2026-10-15', gross: 1200, received: 100, sellerId: 'ana' }),
  ], sources: [source('boletex')] } })
  assert.equal(model.weekly.count, 1)
  assert.equal(model.weekly.sellers[0].count, 1)
  assert.equal(model.weekly.days.at(-1).count, 1)
  assert.equal(model.weekly.payments.find(row => row.id === 'boleto').count, 1)
  assert.equal(model.weekly.cash, null)
  assert.equal(model.weekly.sellers[0].cash, null)
})

test('weekly missing-identity sentinel is counted only as unassigned and never creates a seller', () => {
  const weekly = run({ sales: { records: [sale('unassigned', { date: '2026-10-15', sellerId: 'Não informado', net: 100 })],
    sources: [source('hotmart')] } }).weekly
  assert.deepEqual(weekly.sellers, [])
  assert.equal(weekly.unassignedSeller.count, 1)
  assert.equal(weekly.unassignedSeller.gross, 100)
  assert.equal(weekly.gross, 100)
})
