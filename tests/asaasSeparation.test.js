import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAsaasSeparation } from '../src/utils/asaasSeparation.js'
import { normalizeSource } from '../src/utils/salesData.js'
import { asaasCashView, sourceFinancialMetadata } from '../src/utils/sourceAvailability.js'
import { mergePeriodSources } from '../src/utils/periodData.js'
import { createAsaasCashLoader } from '../src/utils/asaasCashRange.js'
import { prepareGoalData } from '../src/utils/goalData.js'

const range = { startDate: '2026-10-01', endDate: '2026-10-31' }
const origins = rows => ({ schemaVersion: 1, basis: 'checkout_created_at', status: 'ready', rows })
const receipt = (saleDate, received, receiptDate = '2026-10-10', count = 1) => ({ saleDate, received, receiptDate, count })
const payload = (rows, values = {}) => ({ success: true, data: {
  totalGross: rows.reduce((sum, row) => sum + row.received, 0), totalNet: rows.reduce((sum, row) => sum + row.received, 0), totalFees: 0, count: rows.reduce((sum, row) => sum + row.count, 0),
  sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' }, cashReceiptOrigins: origins(rows), ...values,
} })
const source = data => ({ id: 'asaas', kind: 'sale', platform: 'Asaas', ...sourceFinancialMetadata('asaas', data.data) })
const model = (data, args = {}) => buildAsaasSeparation({ sources: [source(data)], records: normalizeSource('asaas', data), ...range, ...args })
const reconciles = result => {
  const groups = [result.receipts.currentPeriod, result.receipts.previousPeriods, result.receipts.unclassified]
  assert.ok(Math.abs(groups.reduce((sum, group) => sum + group.received, 0) - result.cash.gross) < 0.005)
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), result.cash.count)
}

test('Asaas separates current-sale cash, older invoices and unknown origins without inventing new sales', () => {
  const result = model(payload([receipt('2026-10-01', 200), receipt('2026-09-20', 300), receipt(null, 50)]))
  assert.deepEqual(result.sales, { gross: null, count: null, entry: null, available: false, partial: true })
  assert.deepEqual(result.receipts.currentPeriod, { received: 200, count: 1 })
  assert.deepEqual(result.receipts.previousPeriods, { received: 300, count: 1 })
  assert.deepEqual(result.receipts.unclassified, { received: 50, count: 1 })
  assert.equal(result.receipts.status, 'partial')
  reconciles(result)
})

test('checkout contracts and cash coexist; contract value, entry and statement are independent', () => {
  const data = payload([receipt('2026-10-01', 200), receipt('2026-09-20', 300)], {
    totalNet: 492, totalFees: 8, availability: { cash: 'ready', sales: 'ready' },
    sales: { count: 1, totalValue: 2000, entryValue: 200, entries: [{ id: 'new-contract', productDescription: 'DevClub', createdAt: '2026-10-01T12:00:00Z', totalValue: 2000, entryValue: 200 }] },
  })
  const result = model(data)
  assert.deepEqual(result.sales, { gross: 2000, count: 1, entry: 200, available: true, partial: false })
  assert.equal(result.cash.gross, 500)
  assert.equal(result.cash.net, 492)
  assert.equal(result.cash.fees, 8)
  assert.equal(asaasCashView([source(data)]).gross, 500)
  assert.equal(result.receipts.status, 'ready')
  reconciles(result)
})

test('legacy receipts stay unclassified and incomplete legacy contract fixtures cannot manufacture cash', () => {
  const old = payload([receipt('2026-09-20', 120)], { cashReceiptOrigins: undefined })
  const result = model(old)
  assert.equal(result.receipts.unclassified.received, 120)
  assert.equal(result.receipts.status, 'unavailable')
  assert.equal(result.sales.gross, null)
  assert.equal(sourceFinancialMetadata('asaas', { sales: { count: 0, totalValue: 0 }, totalGross: 999 }).cash, undefined)
  reconciles(result)
})

test('known empty cash and contracts show zero; failed sources keep unknown values', () => {
  const zero = model(payload([], { availability: { cash: 'ready', sales: 'ready' }, sales: { count: 0, totalValue: 0, entryValue: 0, entries: [] } }))
  assert.deepEqual(zero.sales, { gross: 0, count: 0, entry: 0, available: true, partial: false })
  assert.equal(zero.cash.gross, 0)
  assert.equal(zero.receipts.status, 'ready')
  reconciles(zero)
  const failed = buildAsaasSeparation({ ...range, sources: [{ id: 'asaas', status: 'unavailable', salesAvailable: false }] })
  assert.equal(failed.sales.count, null)
  assert.equal(failed.cash, null)
  assert.equal(failed.receipts.currentPeriod.received, null)
})

test('filters never allocate the unlinked statement to products, teams, people or payment methods', () => {
  const data = payload([receipt('2026-10-01', 200)])
  assert.equal(model(data, { filters: { platform: 'Guru' } }), null)
  assert.equal(buildAsaasSeparation({ ...range, sources: [{ id: 'guru', status: 'ready' }] }), null)
  for (const field of ['product', 'family', 'payment', 'source', 'offer', 'teamId', 'sellerId']) {
    const result = model(data, { filters: { [field]: 'selected' } })
    assert.equal(result.cash.allocationMissing, true)
    assert.equal(result.receipts.currentPeriod.received, null)
    assert.equal(result.receipts.previousPeriods.received, null)
    assert.equal(result.receipts.unclassified.received, null)
  }
})

test('a manual Asaas sale remains gross only and never duplicates the statement or linked contract', () => {
  const data = payload([receipt(null, 200)])
  const manual = { id: 'manual:1', sourceId: 'manual', isManual: true, kind: 'sale', quantity: 1, platform: 'Asaas', gross: 2000, received: 200, date: '2026-10-10', utm: {} }
  const linked = { ...manual, id: 'manual:linked', original: { linkedExternalId: 'existing-contract' } }
  const args = { sources: [source(data), { id: 'manual', kind: 'sale', status: 'ready' }], records: [manual, manual, linked] }
  const result = model(data, args)
  assert.equal(result.sales.gross, 2000)
  assert.equal(result.sales.count, 1)
  assert.equal(result.sales.entry, null)
  assert.equal(result.sales.partial, true)
  assert.equal(result.cash.gross, 200)
  assert.equal(prepareGoalData(args).cashRecords.some(row => row.isManual), false)
  reconciles(result)
})

test('the same receipt is an old sale for a day and a current sale for its full month/year', () => {
  const data = payload([receipt('2026-10-01', 100, '2026-10-10')])
  const day = model(data, { startDate: '2026-10-10', endDate: '2026-10-10' })
  assert.equal(day.receipts.previousPeriods.received, 100)
  assert.equal(model(data).receipts.currentPeriod.received, 100)
  assert.equal(model(data, { startDate: '2026-01-01', endDate: '2026-12-31' }).receipts.currentPeriod.received, 100)
})

test('sales keep distinct anonymous contracts across snapshots and exclude manual dates outside the final period', () => {
  const sale = { id: 'asaas:0', sourceId: 'asaas', kind: 'sale', platform: 'Asaas', quantity: 1, gross: 1000, received: 100, date: '2026-10-01', utm: {} }
  const sources = [{ id: 'asaas', kind: 'sale', status: 'ready' }]
  const result = buildAsaasSeparation({ ...range, sources, records: [sale, { ...sale, date: '2026-10-02' }, { ...sale, id: 'manual:outside', sourceId: 'manual', isManual: true, date: '2026-09-30' }] })
  assert.equal(result.sales.gross, 2000)
  assert.equal(result.sales.count, 2)
  const identified = buildAsaasSeparation({ ...range, sources, records: [{ ...sale, externalId: 'stable-contract' }, { ...sale, externalId: 'stable-contract' }] })
  assert.equal(identified.sales.count, 1)
})

test('native sales follow the backend query calendar despite UTC timestamps on the previous Brasília day', () => {
  const data = payload([receipt('2026-10-01', 100, '2026-10-01')], {
    availability: { cash: 'ready', sales: 'ready' },
    sales: { count: 1, totalValue: 2000, entryValue: 100, entries: [{ id: 'utc-boundary', createdAt: '2026-10-01T01:00:00.000Z', totalValue: 2000, entryValue: 100 }] },
  })
  const result = model(data, { startDate: '2026-10-01', endDate: '2026-10-01' })
  assert.equal(result.sales.gross, 2000)
  assert.equal(result.sales.count, 1)
  assert.equal(result.sales.entry, 100)
  assert.equal(result.sales.partial, false)
  assert.equal(result.receipts.currentPeriod.received, 100)
  assert.equal(result.receipts.status, 'ready')
  reconciles(result)
})

test('weekly loader preserves contract dates and classifies against final query rather than each week', async () => {
  const loader = createAsaasCashLoader(async ({ startDate }) => payload([receipt('2026-10-01', 100, startDate)]))
  const result = await loader.load('2026-10-01', '2026-10-21')
  assert.equal(result.cashReceiptOrigins.rows.length, 3)
  assert.equal(result.cashReceiptOrigins.status, 'ready')
  const separation = buildAsaasSeparation({ ...result, sources: [{ id: 'asaas', status: 'partial', salesAvailable: false, cash: result.cash, cashReceiptOrigins: result.cashReceiptOrigins }] })
  assert.equal(separation.receipts.currentPeriod.received, 300)
  assert.equal(separation.receipts.previousPeriods.received, 0)
  reconciles(separation)
})

test('monthly snapshots preserve cross-month sale facts for the annual range, including legacy segments', () => {
  const january = payload([receipt('2026-01-02', 100, '2026-01-03')])
  const february = payload([receipt('2026-01-02', 200, '2026-02-05'), receipt('2025-12-01', 50, '2026-02-05')])
  const legacy = payload([receipt(null, 25, '2026-03-01')], { cashReceiptOrigins: undefined })
  const sources = mergePeriodSources([january, february, legacy].map((data, index) => ({ startDate: `2026-0${index + 1}-01`, result: { sources: [source(data)], records: [] } })), true)
  const result = buildAsaasSeparation({ sources, startDate: '2026-01-01', endDate: '2026-12-31' })
  assert.equal(result.receipts.currentPeriod.received, 300)
  assert.equal(result.receipts.previousPeriods.received, 50)
  assert.equal(result.receipts.unclassified.received, 25)
  assert.equal(sources[0].cashReceiptOrigins.status, 'partial')
  reconciles(result)
})

test('missing, invalid, future or out-of-range receipt dates do not imply an old sale', () => {
  const result = model(payload([
    receipt('2026-01-01', 10, null), receipt('2026-01-01', 20, '2026-02-30'),
    receipt('2026-11-01', 30), receipt('2026-01-01', 40, '2026-09-30'), receipt('2026-10-01', 0),
  ]))
  assert.equal(result.receipts.previousPeriods.received, 0)
  assert.equal(result.receipts.unclassified.received, 100)
  assert.equal(result.receipts.currentPeriod.count, 1)
  reconciles(result)
})

test('duplicate or inconsistent origin coverage falls back to unclassified statement totals', () => {
  const result = model(payload([receipt('2026-10-01', 100)], { cashReceiptOrigins: origins([receipt('2026-10-01', 100), receipt('2026-10-01', 100)]) }))
  assert.equal(result.receipts.currentPeriod.received, 0)
  assert.equal(result.receipts.unclassified.received, 100)
  assert.equal(result.receipts.status, 'unavailable')
  reconciles(result)
})

test('partially failed weekly cash keeps its known subtotal and an explicit partial flag', async () => {
  const loader = createAsaasCashLoader(async ({ startDate }) => {
    if (startDate === '2026-10-08') throw new Error('offline')
    return payload([receipt('2026-10-01', 100, startDate)])
  })
  const result = await loader.load('2026-10-01', '2026-10-14')
  const separation = buildAsaasSeparation({ ...result, sources: [{ id: 'asaas', status: 'partial', salesAvailable: false, cash: result.cash, cashReceiptOrigins: result.cashReceiptOrigins }] })
  assert.equal(separation.cash.partial, true)
  assert.equal(separation.receipts.currentPeriod.received, 100)
  assert.equal(result.cashReceiptOrigins.status, 'partial')
  reconciles(separation)
})
