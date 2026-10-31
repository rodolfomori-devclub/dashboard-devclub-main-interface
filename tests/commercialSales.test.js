import test from 'node:test'
import assert from 'node:assert/strict'
import { isCommercialSale, commercialSellerLabel, summarizeCommercialSales } from '../src/utils/commercialSales.js'
import { enrichPeriodRecord, summarizePeriod, periodSeries } from '../src/utils/periodData.js'
import { mergeSalesOperations } from '../src/services/salesOpsService.js'

const sale = (overrides = {}) => ({
  id: 'guru:one', source: 'guru', sourceId: 'guru', externalId: 'one',
  platform: 'Guru', kind: 'sale', quantity: 1, date: '2026-10-01T15:00:00Z',
  gross: 1200, net: 1000, revenue: 1200, received: 1200,
  utm: { source: 'Comercial-Emanuel' }, ...overrides,
})
const ledger = (overrides = {}) => ({
  utmMappings: [{ utmSource: 'Comercial-Emanuel', sellerId: 'seller-1', sellerName: 'Emanuel', enabled: true }],
  attributionMappingsStatus: 'ready', ...overrides,
})

test('commercial source accepts seller UTMs on every platform without guessing their identity', () => {
  for (const source of ['comercial', ' COMERCIAL-Emanuel ', 'Comercial_Rebeca', 'Comercial Lucca', 'Comercial- Bruna']) {
    for (const platform of ['Guru', 'Hotmart', 'TMB', 'Boletex', 'Asaas', 'Pix direto']) {
      const row = sale({ platform, utm: { source } })
      assert.equal(isCommercialSale(row), true, `${platform}: ${source}`)
      assert.equal(commercialSellerLabel(row), 'Sem vendedor vinculado')
    }
  }
  for (const source of ['pre-comercial', 'comercialidade', 'comercializado', 'comercial-', 'comercial_', '', null]) {
    assert.equal(isCommercialSale(sale({ utm: { source } })), false, String(source))
  }
  assert.equal(isCommercialSale(sale({ utm: { source: 'campanha-whatsapp' }, attributionMethod: 'utm', sellerId: 'seller-1' })), true)
})

test('commercial selection excludes refunds, receipts, aggregates and manual sales without commercial evidence', () => {
  for (const row of [sale({ kind: 'refund' }), sale({ kind: 'receipt' }), sale({ isAggregate: true }),
    sale({ isManual: true, attributionMethod: 'manual', sellerId: 'seller-1', utm: {} })]) {
    assert.equal(isCommercialSale(row), false)
  }
  assert.equal(isCommercialSale(null), false)
  assert.equal(isCommercialSale(sale({ isManual: true, attributionMethod: 'manual' })), true)
})

test('seller plus normalized UTM groups preserve approved names and do not merge different sellers', () => {
  const records = mergeSalesOperations([
    sale(), sale({ id: 'guru:two', externalId: 'two', utm: { source: ' COMERCIAL-EMANUEL ' } }),
    sale({ id: 'guru:three', externalId: 'three' }),
    sale({ id: 'guru:four', externalId: 'four', utm: { source: 'Comercial-Rebeca' } }),
  ], ledger({ attributions: [{ source: 'guru', externalId: 'three', sellerId: 'seller-2', sellerName: 'Rebeca' }] }))
  const before = structuredClone(records)
  const result = summarizeCommercialSales(records)
  assert.equal(result.total.count, 4)
  assert.equal(result.total.revenue.value, 4000, 'Guru uses net amounts instead of the original gross')
  assert.equal(result.groups.length, 3)
  const emanuel = result.groups.find(group => group.sellerId === 'seller-1')
  assert.equal(emanuel.count, 2)
  assert.equal(emanuel.sellerName, 'Emanuel')
  assert.equal(emanuel.utmSource, 'Comercial-Emanuel')
  const corrected = result.groups.find(group => group.sellerId === 'seller-2')
  assert.equal(corrected.sellerName, 'Rebeca')
  assert.equal(corrected.utmSource, 'Comercial-Emanuel', 'the original UTM is unchanged by a manual seller correction')
  const unresolved = result.groups.find(group => group.sellerId === null)
  assert.equal(unresolved.sellerName, 'Sem vendedor vinculado')
  assert.equal(unresolved.utmSource, 'Comercial-Rebeca')
  assert.equal(result.groups.reduce((sum, group) => sum + group.revenue.value, 0), result.total.revenue.value)
  assert.deepEqual(records, before)
})

test('commercial subtotals keep unknown money explicit and never count the reconciled manual twice', () => {
  const records = mergeSalesOperations([sale({ net: null })], ledger({ manualSales: [{
    id: 'manual-1', linkedExternalId: 'one', linkedSource: 'guru', sellerId: 'seller-1',
    date: '2026-10-01', platform: 'Guru', net: 1000, utm: { source: 'Comercial-Emanuel' },
  }] }))
  const result = summarizeCommercialSales(records)
  assert.equal(result.records.length, 1)
  assert.equal(result.total.count, 1)
  assert.deepEqual(result.total.revenue, { value: 0, known: 0, missing: 1 })
  assert.deepEqual(result.groups[0].received, { value: 0, known: 0, missing: 1 })
})

test('fresh ledger attribution updates cached period summaries and series, including sources without a commercial prefix', () => {
  const cached = enrichPeriodRecord(sale({ utm: { source: 'whatsapp-outubro' } }))
  assert.equal(cached.commercial, false)
  const currentLedger = ledger({ utmMappings: [{ utmSource: 'whatsapp-outubro', sellerId: 'seller-1', sellerName: 'Emanuel' }] })
  const rows = mergeSalesOperations([cached], currentLedger)
  assert.equal(summarizePeriod(rows).commercial.revenue.value, 1000)
  assert.equal(periodSeries(rows, '2026-10-01', '2026-10-01').rows[0].commercial, 1000)
  const revoked = mergeSalesOperations(rows, ledger({ utmMappings: [] }))
  assert.equal(summarizePeriod(revoked).commercial.count, 0)
  assert.equal(periodSeries(revoked, '2026-10-01', '2026-10-01').rows[0].commercial, 0)
})

test('unavailable mappings keep observed commercial sales, clear stale identities and preserve manual overrides', () => {
  const initial = mergeSalesOperations([sale(), sale({ externalId: 'two' })], ledger())
  const records = mergeSalesOperations(initial, ledger({ attributionMappingsStatus: 'unavailable',
    attributions: [{ source: 'guru', externalId: 'two', sellerId: 'seller-2', sellerName: 'Rebeca' }],
  }))
  const result = summarizeCommercialSales(records)
  assert.equal(result.total.count, 2)
  assert.equal(commercialSellerLabel(records[0]), 'Sem vendedor vinculado')
  assert.equal(commercialSellerLabel(records[1]), 'Rebeca')
})

test('manual seller overrides retain approved commercial UTM evidence only while the mapping remains available', () => {
  const original = sale({ utm: { source: ' WhatsApp-Outubro ' } })
  const mapping = { utmSource: 'whatsapp-outubro', sellerId: 'seller-1', sellerName: 'Emanuel', enabled: true }
  const attributions = [{ source: 'guru', externalId: 'one', sellerId: 'seller-2', sellerName: 'Rebeca' }]
  const approvedLedger = ledger({ utmMappings: [mapping], attributions })
  const records = mergeSalesOperations([original], approvedLedger)
  assert.equal(records[0].attributionMethod, 'manual')
  assert.equal(records[0].attributionUtmSource, 'whatsapp-outubro')
  assert.equal(commercialSellerLabel(records[0]), 'Rebeca')
  assert.equal(isCommercialSale(records[0]), true)
  assert.equal(summarizeCommercialSales(records).groups[0].sellerName, 'Rebeca')
  assert.equal(summarizePeriod(records).commercial.count, 1)
  assert.equal(periodSeries(records, '2026-10-01', '2026-10-01').rows[0].commercial, 1000)
  assert.equal(original.attributionUtmSource, undefined)
  assert.deepEqual(mergeSalesOperations(records, approvedLedger), records)

  for (const changes of [
    { utmMappings: [] },
    { utmMappings: [{ ...mapping, enabled: false }] },
    { attributionMappingsStatus: 'unavailable' },
    { utmMappings: [mapping, { ...mapping, sellerId: 'conflicting-seller' }] },
  ]) {
    const updated = mergeSalesOperations(records, { ...approvedLedger, ...changes })
    assert.equal(commercialSellerLabel(updated[0]), 'Rebeca', 'manual seller corrections remain authoritative')
    assert.equal(updated[0].attributionMethod, 'manual')
    assert.equal(updated[0].attributionUtmSource, undefined)
    assert.equal(isCommercialSale(updated[0]), false)
    assert.equal(summarizePeriod(updated).commercial.count, 0)
    assert.equal(periodSeries(updated, '2026-10-01', '2026-10-01').rows[0].commercial, 0)
  }
})

test('unreconciled manual sales keep their seller and money while using current approved UTM evidence', () => {
  const manual = {
    id: 'manual-linked-source', sellerId: 'seller-2', sellerName: 'Rebeca',
    date: '2026-10-01', platform: 'Pix direto', gross: 1000, net: 900, cashCollected: 100,
    utm: { source: ' WhatsApp-Outubro ', medium: 'whatsapp' },
  }
  const mapping = { utmSource: 'whatsapp-outubro', sellerId: 'seller-1', sellerName: 'Emanuel', enabled: true }
  const currentLedger = ledger({ utmMappings: [mapping], manualSales: [manual] })
  const records = mergeSalesOperations([], currentLedger)
  assert.equal(records[0].attributionMethod, 'manual')
  assert.equal(records[0].attributionUtmSource, 'whatsapp-outubro')
  assert.equal(commercialSellerLabel(records[0]), 'Rebeca')
  assert.equal(isCommercialSale(records[0]), true)
  assert.deepEqual(records[0].utm, manual.utm)
  assert.deepEqual([records[0].gross, records[0].net, records[0].revenue, records[0].received], [1000, 900, 900, 100])
  assert.equal(summarizeCommercialSales(records).total.count, 1)
  assert.deepEqual(mergeSalesOperations(records, currentLedger), records)

  for (const changes of [
    { utmMappings: [] },
    { utmMappings: [{ ...mapping, enabled: false }] },
    { attributionMappingsStatus: 'unavailable' },
  ]) {
    const updated = mergeSalesOperations(records, { ...currentLedger, ...changes })
    assert.equal(updated.length, 1)
    assert.equal(updated[0].attributionUtmSource, undefined)
    assert.equal(commercialSellerLabel(updated[0]), 'Rebeca')
    assert.equal(isCommercialSale(updated[0]), false)
  }

  const reconciled = mergeSalesOperations([sale({ utm: manual.utm }), ...records], {
    ...currentLedger,
    manualSales: [{ ...manual, linkedExternalId: 'one', linkedSource: 'guru' }],
    attributions: [{ source: 'guru', externalId: 'one', sellerId: manual.sellerId, sellerName: manual.sellerName }],
  })
  assert.equal(reconciled.length, 1)
  assert.equal(reconciled[0].isManual, undefined)
  assert.equal(commercialSellerLabel(reconciled[0]), 'Rebeca')
  assert.equal(summarizeCommercialSales(reconciled).total.count, 1)
})
