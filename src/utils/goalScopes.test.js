import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGoalPace } from './goalPace.js'
import { prepareGoalData } from './goalData.js'
import { goalScope, goalScopeKey } from './goalScopes.js'
import { sourceFinancialMetadata } from './sourceAvailability.js'
import { normalizeSource } from './salesData.js'
import { mergeSalesOperations } from '../services/salesOpsService.js'

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
test('cash includes full Guru net but never Asaas invoices or lifetime Boletex cash', () => {
 const sales = { records: [...records, { kind: 'sale', sourceId: 'boletex', date: '2026-06-05', family: 'MBA', received: 9999 }], sources: [
  ...sources, { id: 'boletex', label: 'Boletex', kind: 'sale', status: 'ready' },
  { id: 'asaas', label: 'Asaas', kind: 'sale', status: 'partial', salesAvailable: false, cashReceipts: [{ date: '2026-06-01', received: 300 }] },
 ] }
 const prepared = prepareGoalData(sales, directory)
 const result = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 600 } })
 assert.equal(result.actual, 3250)
 assert.equal(result.rows[0].dailyActual, 1900)
 assert.equal(result.rows[1].actual, 2800)
 assert.equal(result.definitive, false)
 assert.deepEqual(prepared.cashUnavailableSources, ['Boletex', 'Asaas'])
 const individual = run('individual', 'ana', { ...prepared, plan: { scope: 'individual', scopeId: 'ana', metric: 'cash', target: 600 } })
 assert.equal(individual.actual, 1900)
 assert.equal(individual.unassignedValue, 0)
 assert.equal(individual.definitive, false)
})
test('manual declared cash has its own amount and attributed person/team', () => {
 const prepared = prepareGoalData({ records: [{ kind: 'sale', sourceId: 'manual', isManual: true, sellerId: 'ana', date: '2026-06-02', gross: 1500, received: 200 }], sources: [{ id: 'manual', kind: 'sale', status: 'ready' }] }, directory)
 const cash = run('team', 'closers', { ...prepared, plan: { scope: 'team', scopeId: 'closers', metric: 'cash', target: 1000 } })
 assert.equal(cash.actual, 200)
 assert.equal(cash.rows[1].dailyActual, 200)
 assert.equal(run('individual', 'ana', prepared).actual, 1500)
})
test('unknown receipt dates cannot enter sales pace; invalid membership and outside-month sales remain excluded', () => {
 const prepared = prepareGoalData({ sources: [{ id: 'asaas', kind: 'sale', cashReceipts: [{ date: null, received: 120 }] }] }, directory)
 const result = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 500 } })
 assert.equal(result.actual, null)
 assert.equal(result.unallocated, 0)
 assert.equal(result.definitive, false)
 assert.equal(result.rows[14].actual, null)
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

test('manual Asaas new-sale cash is included while the same statement receipt remains separate, even during an outage', () => {
 const manual = { kind: 'sale', sourceId: 'manual', isManual: true, sellerId: 'ana', family: 'DevClub', platform: '  aSaAs - Boleto ', date: '2026-06-02', gross: 1500, received: 200 }
 for (const status of ['ready', 'unavailable']) {
  const prepared = prepareGoalData({ records: [manual], sources: [
   { id: 'manual', kind: 'sale', status: 'ready' },
   { id: 'asaas', kind: 'sale', status, ...(status === 'ready' ? { cashReceipts: [{ date: '2026-06-02', received: 200 }] } : {}) },
  ] }, directory)
  assert.equal(prepared.excludedCashManuals.length, 0)
  assert.equal(prepared.cashRecords.filter(row => row.isManual).length, 1)
  assert.equal(run('individual', 'ana', prepared).actual, 1500)
  const cash = run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 1000 } })
  assert.equal(cash.actual, 200)
  assert.equal(cash.definitive, status === 'ready')
  for (const [scope, scopeId] of [['product', 'DevClub'], ['team', 'closers'], ['individual', 'ana']]) {
   const goal = run(scope, scopeId, { ...prepared, plan: { scope, scopeId, metric: 'cash', target: 1000 } })
   assert.equal(goal.actual, 200)
  }
 }
})

test('the reported 833.64 in new Hotmart sales never gains 1255.36 of Asaas invoice receipts in any goal scope', () => {
 const receiptSource = { id: 'asaas', label: 'Asaas', kind: 'sale', status: 'partial', salesAvailable: false,
  cash: { gross: 1255.36 }, cashReceipts: [{ date: '2026-06-01', received: 1255.36 }],
  cashReceiptOrigins: { schemaVersion: 1, status: 'ready', rows: [
   { saleDate: '2026-05-01', receiptDate: '2026-06-01', received: 1000, count: 1 },
   { saleDate: '2026-06-01', receiptDate: '2026-06-01', received: 255.36, count: 1 },
  ] },
 }
 const prepared = prepareGoalData({ records: [{ kind: 'sale', sourceId: 'hotmart', date: '2026-06-01', family: 'DevClub', sellerId: 'ana', net: 833.64 }],
  sources: [{ id: 'hotmart', kind: 'sale', status: 'ready' }, receiptSource] }, directory)
 assert.equal(prepared.cashRecords.length, 1)
 assert.strictEqual(prepared.sources[1], receiptSource)
 assert.equal(prepared.sources[1].cashReceipts[0].received, 1255.36)
 for (const [scope, scopeId] of [['overall', ''], ['product', 'DevClub'], ['team', 'closers'], ['individual', 'ana']]) {
  const result = run(scope, scopeId, { ...prepared, plan: { scope, scopeId, metric: 'cash', target: 1000 } })
  assert.equal(result.actual, 833.64, scope)
  assert.equal(result.rows[0].dailyActual, 833.64, scope)
  assert.equal(result.unassignedValue, 0, scope)
  assert.equal(result.unallocated, 0, scope)
  assert.equal(result.definitive, false, scope)
 }
})

test('Asaas contributes a new contract entry once on its sale date, preserving seller, team and product', () => {
 const native = normalizeSource('asaas', { data: { sales: { count: 1, totalValue: 2000, entryValue: 200, entries: [
  { id: 'new-contract', productDescription: 'DevClub', createdAt: '2026-06-02T12:00:00Z', totalValue: 2000, entryValue: 200 },
 ] } } })
 const merged = mergeSalesOperations(native, { attributions: [{ source: 'asaas', externalId: 'new-contract', sellerId: 'ana' }],
  manualSales: [{ id: 'linked', platform: 'Asaas', cashCollected: 200, linkedSource: 'asaas', linkedExternalId: 'new-contract' }],
 })
 const prepared = prepareGoalData({ records: merged, sources: [{ id: 'asaas', kind: 'sale', status: 'ready',
  cashReceipts: [{ date: '2026-06-10', received: 200 }],
  cashReceiptOrigins: { schemaVersion: 1, status: 'ready', rows: [{ saleDate: '2026-06-02', receiptDate: '2026-06-10', received: 200, count: 1 }] },
 }, { id: 'manual', kind: 'sale', status: 'ready' }] }, directory)
 assert.equal(prepared.cashRecords.length, 1)
 assert.equal(prepared.cashRecords[0].cashDate, native[0].date)
 assert.equal(prepared.cashRecords[0].family, 'DevClub')
 for (const [scope, scopeId] of [['overall', ''], ['product', 'DevClub'], ['team', 'closers'], ['individual', 'ana']]) {
  const result = run(scope, scopeId, { ...prepared, plan: { scope, scopeId, metric: 'cash', target: 1000 } })
  assert.equal(result.actual, 200, scope)
  assert.equal(result.rows[1].dailyActual, 200, scope)
  assert.equal(result.rows[9].dailyActual, 0, scope)
  assert.equal(result.definitive, true, scope)
 }
})

test('Asaas invoice-only sources do not report zero new-sale cash; real contract zero and unknown entries stay distinct', () => {
 const native = { kind: 'sale', sourceId: 'asaas', date: '2026-06-01', received: 0 }
 const receipt = { ...native, isReceipt: true, received: 9999 }
 const prepare = (status, extra = {}, rows = [native, receipt]) => prepareGoalData({ records: rows, sources: [
  { id: 'asaas', kind: 'sale', status, cashReceipts: [{ date: '2026-06-01', received: 1255.36 }], ...extra },
 ] }, directory)
 const actual = prepared => run('overall', '', { ...prepared, plan: { scope: 'overall', metric: 'cash', target: 1000 } })
 assert.equal(actual(prepare('ready')).actual, 0)
 assert.equal(actual(prepare('ready')).definitive, true)
 assert.equal(actual(prepare('ready', {}, [{ ...native, received: null }])).actual, null)
 assert.equal(actual(prepare('ready', {}, [])).actual, 0)
 for (const status of ['partial', 'stale']) {
  const prepared = prepare(status)
  assert.equal(prepared.cashRecords.length, 1)
  assert.equal(actual(prepared).actual, 0)
  assert.equal(actual(prepared).definitive, false)
 }
 for (const [status, extra] of [['unavailable', {}], ['partial', { salesAvailable: false }], ['ready', { salesAvailable: false }]]) {
  const prepared = prepare(status, extra)
  assert.equal(prepared.cashRecords.length, 0)
  assert.equal(prepared.cashSources[0].status, 'unavailable')
  assert.equal(actual(prepared).actual, null)
 }
})

test('an older Asaas contract cannot become a new sale when an installment is paid this month', () => {
 const prepared = prepareGoalData({ records: [{ kind: 'sale', sourceId: 'asaas', date: '2026-05-15', cashDate: '2026-06-02',
  received: 300, gross: 3000, family: 'DevClub', sellerId: 'ana' }], sources: [{ id: 'asaas', kind: 'sale', status: 'ready',
  cashReceipts: [{ date: '2026-06-02', received: 300 }],
  cashReceiptOrigins: { schemaVersion: 1, status: 'ready', rows: [{ saleDate: '2026-05-15', receiptDate: '2026-06-02', received: 300, count: 1 }] },
 }] }, directory)
 assert.equal(prepared.cashRecords[0].cashDate, '2026-05-15')
 for (const [scope, scopeId] of [['overall', ''], ['product', 'DevClub'], ['team', 'closers'], ['individual', 'ana']]) {
  const result = run(scope, scopeId, { ...prepared, plan: { scope, scopeId, metric: 'cash', target: 1000 } })
  assert.equal(result.actual, 0, scope)
  assert.equal(result.rows[1].dailyActual, 0, scope)
  assert.equal(result.unallocated, 0, scope)
 }
})
