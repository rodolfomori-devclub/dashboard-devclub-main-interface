import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTmbCashRule, tmbCashAmount, TMB_CASH_RULE, TMB_CASH_METADATA } from '../src/utils/tmbCash.js'
import { filterSales, normalizeSource, summarizeSales, hourlySales } from '../src/utils/salesData.js'
import { sourceFinancialMetadata } from '../src/utils/sourceAvailability.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace, dateForRecord } from '../src/utils/goalPace.js'
import { manualSaleRecord, mergeSalesOperations, saleSnapshot } from '../src/services/salesOpsService.js'

const source = { id: 'tmb', platform: 'TMB', label: 'TMB', kind: 'sale', status: 'ready' }
const manualSource = { id: 'manual', label: 'Vendas manuais', kind: 'sale', status: 'ready' }
const directory = { individuals: [{ id: 'ana', teamId: 'closers' }, { id: 'bia', teamId: 'outro' }] }
const pace = (data, scope = 'overall', scopeId = '') => calculateGoalPace({
  ...data, year: 2026, month: 9, today: '2026-09-30', plan: { scope, scopeId, metric: 'cash', target: 1000, paceBasis: 'calendar' },
})
const tmb = (value = 100.01, date = '2026-10-01T01:00:00Z', id = 42, product = 'DevClub') => normalizeSource('tmb', { success: true,
  data: [{ id: `tmb-${id}-0`, raw: { pedido_id: id, valor_total: value }, product, value, timestamp: date }],
})[0]

test('TMB rule rounds each sale once to cents, preserves known zero and refuses missing amounts', () => {
  for (const [value, expected] of [[100.01, 40], ['100.02', 40.01], [0.03, 0.01], [0.01, 0], [0, 0], [10.0125, 4.01], ['1e-2', 0], [-10.0125, -4.01]]) {
    assert.equal(tmbCashAmount(value), expected)
  }
  for (const value of [null, undefined, '', ' ', false, true, NaN, Infinity, 'invalid', {}, []]) assert.equal(tmbCashAmount(value), null)
  const original = tmb()
  assert.equal(original.received, 40)
  assert.equal(original.gross, 100.01)
  assert.equal(original.revenue, 100.01)
  assert.equal(original.net, null)
  assert.equal(original.cashRule, TMB_CASH_RULE)
  assert.equal(original.cashBasis, 'sales_rule')
  assert.deepEqual(applyTmbCashRule(applyTmbCashRule(original)), original)
  assert.equal(saleSnapshot(original).cashCollected, 40)
  assert.equal(saleSnapshot(original).gross, 100.01)
  assert.deepEqual(sourceFinancialMetadata('tmb', []), { status: 'ready', ...TMB_CASH_METADATA })
})

test('cash uses the real sale calendar in Sao Paulo, preserving undated records without inventing a time', () => {
  assert.equal(tmb().cashDate, '2026-09-30')
  const calendar = tmb(100, '2026-09-30')
  assert.equal(calendar.cashDate, '2026-09-30')
  assert.equal(dateForRecord(calendar), '2026-09-30')
  assert.equal(calendar.hasExactTime, false)
  assert.equal(hourlySales([calendar]).unknownRecords, 1)
  const originalCalendar = normalizeSource('tmb', { data: [{ value: 100, timestamp: '2026-09-30T00:00:00Z', date: { original: '2026-09-30' } }] })[0]
  assert.equal(originalCalendar.cashDate, '2026-09-30')
  assert.equal(dateForRecord(originalCalendar), '2026-09-30')
  assert.equal(originalCalendar.hasExactTime, false)
  const undated = prepareGoalData({ records: [tmb(100, null)], sources: [source] }, directory)
  assert.equal(undated.cashRecords[0].cashDate, null)
  assert.equal(pace(undated).actual, 40)
  assert.equal(pace(undated).unallocated, 40)
  assert.equal(pace(undated).definitive, false)
  assert.equal(pace(undated).rows.every(row => row.dailyActual === 0), true)
})

test('product, payment, platform, team and seller use the same cash rows without allocating them twice', () => {
  const manual = { id: 'm1', platform: 'TMB', gross: 25, net: 20, cashCollected: 999,
    date: '2026-09-30', family: 'DevClub', product: 'DevClub', sellerId: 'ana' }
  const ledger = { manualSales: [manual], attributions: [
    { id: 'a1', source: 'tmb', externalId: '42', sellerId: 'ana' },
    { id: 'a2', source: 'tmb', externalId: '43', sellerId: 'bia' },
  ] }
  const native = [tmb(), tmb(50, '2026-09-30T18:00:00-03:00', 43, 'MBA')]
  const records = mergeSalesOperations(native, ledger)
  assert.deepEqual(mergeSalesOperations(records, ledger), records)
  assert.equal(records[2].gross, 25)
  assert.equal(records[2].revenue, 20)
  assert.equal(records[2].received, 10)
  assert.equal(records[2].original.cashCollected, 999)
  const data = prepareGoalData({ records, sources: [source, manualSource] }, directory)
  assert.equal(data.cashRecords.length, 3)
  assert.equal(pace(data).actual, 70)
  assert.equal(pace(data, 'product', 'DevClub').actual, 50)
  assert.equal(pace(data, 'team', 'closers').actual, 50)
  assert.equal(pace(data, 'individual', 'ana').actual, 50)
  assert.equal(pace(data).rows[29].dailyActual, 70)
  assert.equal(pace(data).definitive, true)
  assert.equal(summarizeSales(filterSales(records, { platform: 'TMB', family: 'DevClub' })).received.value, 50)
  assert.equal(summarizeSales(filterSales(records, { payment: 'Boleto' })).received.value, 60)
  const reconciled = mergeSalesOperations(records, { ...ledger, manualSales: [{ ...manual, linkedExternalId: '42', linkedSource: 'tmb' }] })
  const final = prepareGoalData({ records: reconciled, sources: [source, manualSource] }, directory)
  assert.equal(final.cashRecords.length, 2)
  assert.equal(pace(final).actual, 60)
  assert.equal(pace(final, 'individual', 'ana').actual, 40)
})

test('missing TMB cash stays unknown, failed sources do not become zero, and stale payloads remain partial', () => {
  const unknown = prepareGoalData({ records: [tmb(null)], sources: [source] }, directory)
  assert.equal(unknown.cashRecords[0].received, null)
  assert.equal(pace(unknown).actual, null)
  assert.equal(pace(unknown).missingRecords, 1)
  const malformedRaw = normalizeSource('tmb', { data: [{ value: 0, raw: { valor_total: '' } }] })[0]
  assert.equal(malformedRaw.gross, 0) // Existing contract is not rewritten.
  assert.equal(malformedRaw.received, null)
  const manualUnknown = manualSaleRecord({ id: 'unknown', platform: 'TMB', gross: null, net: 100, cashCollected: 99, date: '2026-09-30' })
  assert.equal(manualUnknown.received, null)
  assert.equal(pace(prepareGoalData({ records: [], sources: [source] }, directory)).actual, 0)
  assert.equal(pace(prepareGoalData({ records: [tmb()], sources: [{ ...source, status: 'unavailable' }] }, directory)).actual, null)
  for (const status of ['partial', 'stale']) {
    const result = pace(prepareGoalData({ records: [tmb()], sources: [{ ...source, status }] }, directory))
    assert.equal(result.actual, 40)
    assert.equal(result.definitive, false)
  }
})

test('Asaas receipts and manual duplicate protection remain unchanged alongside the TMB rule', () => {
  const receipts = [{ date: '2026-09-30', received: 300, count: 1 }]
  const asaasManual = manualSaleRecord({ id: 'a1', platform: 'Asaas', gross: 1000, net: 900, cashCollected: 300, date: '2026-09-30' })
  assert.equal(asaasManual.received, 300)
  assert.equal(asaasManual.cashRule, undefined)
  const prepared = prepareGoalData({ records: [tmb(), asaasManual], sources: [source, manualSource,
    { id: 'asaas', kind: 'sale', status: 'partial', cashReceipts: receipts }],
  }, directory)
  assert.equal(prepared.excludedCashManuals.length, 1)
  assert.equal(prepared.cashRecords.filter(row => row.sourceId === 'asaas').length, 1)
  assert.equal(prepared.cashRecords.find(row => row.sourceId === 'asaas').received, 300)
  assert.equal(pace(prepared).actual, 340)
  assert.equal(pace(prepared).definitive, false)
  const asaasRow = normalizeSource('asaas', { data: { sales: { count: 1, totalValue: 1000, entryValue: 100,
    entries: [{ id: 'as1', productDescription: 'DevClub', totalValue: 1000, entryValue: 100, createdAt: '2026-09-30' }],
  } } })[0]
  assert.deepEqual([asaasRow.gross, asaasRow.revenue, asaasRow.received], [1000, 1000, 100])
  assert.strictEqual(applyTmbCashRule(asaasRow), asaasRow)
})
