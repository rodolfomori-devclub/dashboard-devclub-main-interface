import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGoalPace } from './goalPace.js'
import { prepareGoalData } from './goalData.js'
import { goalScope, goalScopeKey } from './goalScopes.js'
import { sourceFinancialMetadata } from './sourceAvailability.js'

const sources = [{ id: 'guru', kind: 'sale', label: 'Guru', status: 'ready' }]
const records = [
 { kind: 'sale', sourceId: 'guru', date: '2026-06-01', family: 'MBA', sellerId: 'ana', gross: 2000, net: 1900 },
 { kind: 'sale', sourceId: 'guru', date: '2026-06-02', family: 'DevClub', sellerId: 'bia', gross: 1000, net: 900 },
 { kind: 'sale', sourceId: 'guru', date: '2026-06-03', family: 'MBA', sellerId: 'caio', gross: 500, net: 450 },
]
const directory = { individuals: [{ id: 'ana', teamId: 'closers' }, { id: 'bia', teamId: 'closers' }, { id: 'caio', teamId: 'retention' }] }
const data = prepareGoalData({ records, sources }, directory)
const run = (scope, scopeId, overrides = {}) => calculateGoalPace({ year: 2026, month: 6, today: '2026-06-15', ...data, plan: { scope, scopeId, metric: 'gross', target: 10000 }, ...overrides })

test('four goal scopes are independent and aggregate only matching assigned transactions', () => {
 assert.equal(run('overall', '').actual, 3500)
 assert.equal(run('product', 'MBA').actual, 2500)
 assert.equal(run('team', 'closers').actual, 3000)
 assert.equal(run('individual', 'ana').actual, 2000)
 assert.equal(run('individual', 'ana').definitive, true)
 assert.equal(run('team', 'retention').actual, 500)
})
test('legacy general/product identities remain compatible and team does not alias general', () => {
 assert.deepEqual(goalScope({ product: 'all' }), { scope: 'overall', scopeId: '' })
 assert.equal(goalScopeKey({ product: 'MBA' }), goalScopeKey({ scope: 'product', scopeId: 'MBA' }))
 assert.notEqual(goalScopeKey({ scope: 'team', scopeId: 'x', product: 'all' }), goalScopeKey({ product: 'all' }))
})
test('unassigned amounts are excluded from each individual/team and prevent definitive pace', () => {
 const extra = { kind: 'sale', date: '2026-06-04', family: 'MBA', gross: 700 }
 const result = run('team', 'closers', { records: [...data.records, extra] })
 assert.equal(result.actual, 3000)
 assert.equal(result.unassignedRecords, 1)
 assert.equal(result.unassignedValue, 700)
 assert.equal(result.definitive, false)
 assert.equal(run('overall', '', { records: [...data.records, extra] }).actual, 4200)
})
test('cash includes full Guru net plus dated Asaas receipts, never lifetime Boletex cash', () => {
 const sales = { records: [...records, { kind: 'sale', sourceId: 'boletex', date: '2026-06-05', family: 'MBA', received: 9999 }], sources: [
  ...sources, { id: 'boletex', label: 'Boletex', kind: 'sale', status: 'ready' },
  { id: 'asaas', kind: 'sale', status: 'partial', cashReceipts: [{ date: '2026-06-01', received: 300 }] },
 ] }
 const prepared = prepareGoalData(sales, directory)
 const result = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 600 } })
 assert.equal(result.actual, 3550)
 assert.equal(result.rows[0].dailyActual, 2200)
 assert.equal(result.rows[1].actual, 3100)
 assert.equal(result.definitive, false)
 assert.deepEqual(prepared.cashUnavailableSources, ['Boletex'])
 const individual = run('individual', 'ana', { ...prepared, plan: { scope: 'individual', scopeId: 'ana', metric: 'cash', target: 600 } })
 assert.equal(individual.actual, 1900)
 assert.equal(individual.unassignedValue, 300)
 assert.equal(individual.definitive, false)
})
test('manual declared cash has its own amount and attributed person/team', () => {
 const prepared = prepareGoalData({ records: [{ kind: 'sale', sourceId: 'manual', isManual: true, sellerId: 'ana', date: '2026-06-02', gross: 1500, received: 200 }], sources: [{ id: 'manual', kind: 'sale', status: 'ready' }] }, directory)
 const cash = run('team', 'closers', { ...prepared, plan: { scope: 'team', scopeId: 'closers', metric: 'cash', target: 1000 } })
 assert.equal(cash.actual, 200)
 assert.equal(cash.rows[1].dailyActual, 200)
 assert.equal(run('individual', 'ana', prepared).actual, 1500)
})
test('unknown receipt date stays undated; invalid membership and outside-month sales cannot create definitive values', () => {
 const prepared = prepareGoalData({ sources: [{ id: 'asaas', kind: 'sale', cashReceipts: [{ date: null, received: 120 }] }] }, directory)
 const result = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 500 } })
 assert.equal(result.actual, 120)
 assert.equal(result.unallocated, 120)
 assert.equal(result.definitive, false)
 assert.equal(result.rows[14].actual, 0)
 assert.equal(run('team', 'closers', { directoryAvailable: false }).definitive, false)
 assert.equal(run('team', 'closers', { directoryAvailable: false }).actual, null)
 assert.equal(run('individual', '').actual, null)
 assert.equal(run('overall', '', { records: [...data.records, { kind: 'sale', date: '2026-05-31', gross: 9999 }] }).actual, 3500)
})
test('cash metadata preserves undated receipts without creating sales or changing existing cash totals', () => {
 const result = sourceFinancialMetadata('asaas', { sales: null, totalGross: 500, totalNet: 450, totalFees: 50, count: 2,
 availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' },
 cashReceipts: [{ date: '2026-06-01', received: 400, count: 1 }], cashReceiptsUndated: { received: 100, count: 1 } })
 assert.equal(result.salesAvailable, false)
 assert.equal(result.cash.gross, 500)
 assert.deepEqual(result.cashReceipts[1], { date: null, received: 100, count: 1 })
})

test('manual Asaas cash never duplicates or assigns the statement without a receipt link, even during an outage', () => {
 const manual = { kind: 'sale', sourceId: 'manual', isManual: true, sellerId: 'ana', platform: '  aSaAs - Boleto ', date: '2026-06-02', gross: 1500, received: 200 }
 for (const status of ['ready', 'unavailable']) {
  const prepared = prepareGoalData({ records: [manual], sources: [
   { id: 'manual', kind: 'sale', status: 'ready' },
   { id: 'asaas', kind: 'sale', status, ...(status === 'ready' ? { cashReceipts: [{ date: '2026-06-02', received: 200 }] } : {}) },
  ] }, directory)
  assert.equal(prepared.excludedCashManuals.length, 1)
  assert.equal(prepared.cashRecords.filter(row => row.isManual).length, 0)
  assert.equal(run('individual', 'ana', prepared).actual, 1500)
  const cash = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 1000 } })
  assert.equal(cash.actual, status === 'ready' ? 200 : null)
  assert.equal(cash.definitive, false)
 }
})
