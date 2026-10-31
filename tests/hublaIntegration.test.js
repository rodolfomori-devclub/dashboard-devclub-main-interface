import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { normalizeSource, filterSales, SOURCE_DEFINITIONS } from '../src/utils/salesData.js'
import { buildRevenueBreakdown } from '../src/utils/revenueBreakdown.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { summarizePeriod, periodSeries } from '../src/utils/periodData.js'
import { buildComparisonSnapshot } from '../src/utils/comparisonData.js'
import { buildRefundSummary } from '../src/utils/refundSummary.js'
import { sourceFinancialMetadata } from '../src/utils/sourceAvailability.js'
import { createProviderRangeLoader } from '../src/components/daily/dailyData.js'
import { mergeSalesOperations, saleSnapshot } from '../src/services/salesOpsService.js'
import { buildPeriodSalesWorkbook } from '../src/utils/periodSalesExport.js'
import { buildTvCelebrations } from '../src/components/tv/tvCelebrations.js'
import { emptyProviderPayload } from './ui/period-cache-fixture.mjs'

const day = '2026-10-28'
const sale = (overrides = {}) => ({ transaction: 'hubla-invoice-1', product: 'DevClub', buyer: 'Cliente',
  orderDate: `${day}T15:00:00Z`, paymentMethod: 'PIX', grossValue: 1000, netValue: 900, fee: 100,
  currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', utm_source: 'Comercial-Ana', ...overrides })
const payload = (rows = [sale()], extra = {}) => ({ success: true, data: { financialSchemaVersion: 2,
  count: rows.length, totalNet: rows.reduce((sum, row) => sum + (row.netValue ?? 0), 0),
  totalFees: rows.reduce((sum, row) => sum + (row.fee ?? 0), 0), transactions: rows, ...extra } })
const source = (id = 'hubla', extra = {}) => ({ ...SOURCE_DEFINITIONS.find(source => source.id === id), status: 'ready', ...extra })

test('Hubla uses producer net for sales, card category, cash, periods, comparisons and export without another fee deduction', () => {
  const records = normalizeSource('hubla', payload())
  const row = records[0]
  assert.deepEqual([row.sourceId, row.platform, row.externalId, row.payment], ['hubla', 'Hubla', 'hubla-invoice-1', 'Pix'])
  assert.deepEqual([row.gross, row.net, row.revenue, row.received], [900, 900, 900, 900])
  assert.equal(filterSales(records, { payment: 'Cartão', platform: 'Hubla' }).length, 1)
  assert.equal(filterSales(records, { payment: 'Pix' }).length, 0)
  const sources = [source()]
  const result = buildRevenueBreakdown(records, sources)
  assert.equal(result.payments.card.value, 900)
  assert.deepEqual(result.payments.card.providers.map(provider => provider.id), ['hubla'])
  assert.equal(result.cash.value, 900)
  assert.equal(prepareGoalData({ records, sources }).cashRecords[0].received, 900)
  assert.equal(summarizePeriod(records).digital.revenue.value, 900)
  assert.equal(periodSeries(records, day, day).rows[0].digital, 900)
  assert.equal(buildComparisonSnapshot({ records, sources }, {}, { startDate: day, endDate: day }).metrics.digital.value, 900)
  const workbook = buildPeriodSalesWorkbook(records, { startDate: day, endDate: day, sources, operationsStatus: 'ready' })
  const exported = XLSX.utils.sheet_to_json(workbook.Sheets.Vendas)[0]
  assert.deepEqual([exported.Fonte, exported['Categoria de pagamento'], exported['Pagamento original']], ['hubla', 'Cartão', 'Pix'])
  assert.equal(exported['Valor das vendas'], 900)
  assert.equal(exported.Recebido, 900)
})

test('Hubla unknown net stays missing and foreign net never enters BRL totals', () => {
  for (const raw of [sale({ netValue: null }), sale({ netValue: 50, netCurrency: 'USD' })]) {
    const rows = normalizeSource('hubla', payload([raw], { totalNet: 0, financialCoverage: { net: { complete: false } } }))
    assert.equal(rows[0].gross, null)
    assert.equal(rows[0].received, null)
    assert.equal(sourceFinancialMetadata('hubla', { financialCoverage: { net: { complete: false } } }).status, 'partial')
  }
  assert.equal(normalizeSource('hubla', payload([sale({ netValue: 0 })]))[0].received, 0)
})

test('Hubla refunds preserve the separate net purchase and actual returned amount, without contributing to cash', () => {
  const records = normalizeSource('hublaRefunds', payload([sale({ status: 'REFUNDED', refundAmount: 1000, refundCurrency: 'BRL' })]))
  const summary = buildRefundSummary(records, [source('hublaRefunds')], { platform: 'Hubla' })
  assert.equal(summary.confirmed, 1)
  assert.deepEqual(summary.purchase.values, [{ currency: 'BRL', value: 900 }])
  assert.deepEqual(summary.refunded.values, [{ currency: 'BRL', value: 1000 }])
  assert.equal(records[0].received, null)
  const disputed = buildRefundSummary(normalizeSource('hublaRefunds', payload([sale({ status: 'in_protest' })])), [source('hublaRefunds')], { platform: 'Hubla' })
  assert.equal(disputed.disputes, 1)
  assert.equal(disputed.confirmed, 0)
  assert.equal(sourceFinancialMetadata('hublaRefunds', { transactions: [sale({ netValue: null })] }).status, 'partial')
})

test('Hubla attribution and manual reconciliation preserve stable identities and the same net cash policy', () => {
  const records = mergeSalesOperations(normalizeSource('hubla', payload()), {
    utmMappings: [{ utmSource: 'Comercial-Ana', sellerId: 'ana', sellerName: 'Ana' }],
    manualSales: [{ id: 'linked', platform: 'Hubla', linkedSource: 'hubla', linkedExternalId: 'hubla-invoice-1' },
      { id: 'manual', date: day, platform: 'Hubla', net: 200, gross: 500, cashCollected: 50 }],
  })
  assert.equal(records.length, 2)
  assert.equal(records[0].sellerId, 'ana')
  assert.equal(records[0].attributionMethod, 'utm')
  assert.equal(records[1].received, 200)
  assert.equal(saleSnapshot(records[1]).gross, 200)
})

test('Hubla daily loading preserves valid data on provider failure or lost known net and keeps refunds independent', async () => {
  let current = payload()
  const requested = []
  const loader = createProviderRangeLoader({ fetchProvider: async id => {
    requested.push(id)
    if (id !== 'hubla') return emptyProviderPayload(id)
    if (current instanceof Error) throw current
    return current
  } })
  await loader.load(day, day)
  assert.ok(requested.includes('hubla') && requested.includes('hublaRefunds'))
  for (const value of [new Error('Provider unavailable'), payload([sale({ netValue: null, netCurrency: null })], { financialCoverage: { net: { complete: false } } })]) {
    current = value
    const result = await loader.load(day, day, { force: true })
    const hubla = result.sources.find(source => source.id === 'hubla')
    assert.equal(hubla.rows[0].net, 900)
    assert.equal(hubla.status, 'partial')
    assert.equal(hubla.cacheStatus, 'stale')
    assert.equal(result.sources.find(source => source.id === 'hublaRefunds').status, 'ready')
  }
})

test('Hubla TV celebrations use the invoice identity, net value, and exclude date-only observations', () => {
  const records = normalizeSource('hubla', payload([sale(), sale({ transaction: 'date-only' })]))
  records[1].original.orderDate = day
  const feed = buildTvCelebrations({ records, sources: [source('hubla', { snapshots: [
    { startDate: day, endDate: day, status: 'ready', complete: true },
  ] })], directory: { individuals: [], teams: [] }, operationsStatus: 'ready', today: day })
  const group = feed.groups.find(group => group.source === 'hubla')
  assert.equal(group.ready, true)
  assert.equal(group.events.find(event => event.id === '["hubla","hubla-invoice-1"]').amount, 900)
  assert.equal(group.events.find(event => event.id === '["hubla","date-only"]').occurredAt, null)
})
