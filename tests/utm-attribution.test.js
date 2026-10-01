import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSalesOperations, normalizeUtmSource } from '../src/services/salesOpsService.js'

const sellerA = '11111111-1111-4111-8111-111111111111'
const sellerB = '22222222-2222-4222-8222-222222222222'
const record = (overrides = {}) => ({ id: 'guru:one', source: 'guru', sourceId: 'guru', externalId: 'one',
  kind: 'sale', canAttribute: true, quantity: 1, gross: 1997, net: 1800, received: 1800,
  date: '2026-10-01T12:00:00-03:00', utm: { source: 'Comercial-Emanuel', medium: 'whatsapp', campaign: 'outubro', content: 'oferta', term: 'devclub' }, ...overrides })
const mapping = (overrides = {}) => ({ utmSource: 'Comercial-Emanuel', sellerId: sellerA, sellerName: 'Emanuel', enabled: true, revision: 1, ...overrides })
const ledger = (overrides = {}) => ({ attributions: [], manualSales: [], utmMappings: [mapping()], attributionMappingsStatus: 'ready', ...overrides })

test('approved exact source identifies a seller without changing source fields or monetary values', () => {
  const sale = record()
  const snapshot = structuredClone(sale)
  const [result] = mergeSalesOperations([sale], ledger())
  assert.equal(result.sellerId, sellerA)
  assert.equal(result.attributionMethod, 'utm')
  assert.deepEqual(result.utm, snapshot.utm)
  assert.equal(result.gross, 1997)
  assert.equal(result.received, 1800)
  assert.deepEqual(sale, snapshot)
  assert.equal(result.status, undefined, 'identification does not silently reconcile a transaction')
})

test('source matching ignores surrounding whitespace/case but never guesses seller names or partial aliases', () => {
  assert.equal(normalizeUtmSource(' Comercial-EMANUEL '), 'comercial-emanuel')
  assert.equal(mergeSalesOperations([record({ utm: { source: ' Comercial-EMANUEL ' } })], ledger())[0].sellerId, sellerA)
  for (const source of ['Emanuel', 'comercial', 'Comercial-Emanuel-outro', 'Comercial-Emmanuel', 'Comercial-Emanuél']) {
    assert.equal(mergeSalesOperations([record({ utm: { source } })], ledger())[0].sellerId, undefined)
  }
})

test('manual attribution overrides UTM and survives unavailable UTM registry', () => {
  const current = ledger({ attributions: [{ id: 'assignment', source: 'guru', externalId: 'one', sellerId: sellerB,
    sellerName: 'Rebeca', status: 'reconciled', note: 'Conferido', syncPending: true }] })
  for (const attributionMappingsStatus of ['ready', 'unavailable']) {
    const [result] = mergeSalesOperations([record()], { ...current, attributionMappingsStatus })
    assert.equal(result.sellerId, sellerB)
    assert.equal(result.attributionMethod, 'manual')
    assert.equal(result.note, 'Conferido')
    assert.equal(result.syncPending, true)
    assert.equal(result.utm.source, 'Comercial-Emanuel')
  }
})

test('fresh mappings replace old overlays and revoked/unavailable mappings never retain stale seller identities', () => {
  const first = mergeSalesOperations([record()], ledger())
  const second = mergeSalesOperations(first, ledger({ utmMappings: [mapping({ sellerId: sellerB, sellerName: 'Rebeca' })] }))
  assert.equal(second[0].sellerId, sellerB)
  assert.deepEqual(mergeSalesOperations(second, ledger({ utmMappings: [mapping({ sellerId: sellerB, sellerName: 'Rebeca' })] })), second)
  for (const latest of [ledger({ utmMappings: [] }), ledger({ utmMappings: [mapping({ enabled: false })] }), ledger({ attributionMappingsStatus: 'unavailable' })]) {
    const [result] = mergeSalesOperations(first, latest)
    assert.equal(result.sellerId, undefined)
    assert.equal(result.sellerName, undefined)
    assert.equal(result.attributionMethod, 'unassigned')
  }
})

test('conflicting approved aliases stay unresolved regardless of order or a third duplicate', () => {
  const aliases = [mapping(), mapping({ utmSource: ' COMERCIAL-EMANUEL ', sellerId: sellerB }), mapping()]
  for (const utmMappings of [aliases, [...aliases].reverse()]) {
    const [result] = mergeSalesOperations([record()], ledger({ utmMappings }))
    assert.equal(result.sellerId, undefined)
    assert.equal(result.attributionMethod, 'unassigned')
  }
})

test('refunds, aggregates, invoice receipts and transactions without a stable ID are never auto-assigned', () => {
  const records = [record({ kind: 'refund' }), record({ kind: 'receipt' }), record({ isAggregate: true }), record({ canAttribute: false }), record({ externalId: null })]
  for (const row of mergeSalesOperations(records, ledger())) assert.equal(row.sellerId, undefined)
})

test('unlinked manual sales preserve their seller and UTMs, while reconciled manuals never duplicate the source sale', () => {
  const manual = { id: 'manual-one', sellerId: sellerB, sellerName: 'Rebeca', date: '2026-10-01', product: 'DevClub', family: 'DevClub', platform: 'Pix direto', gross: 1000, net: 1000, cashCollected: 1000, utm: { source: 'Comercial-Emanuel' } }
  const rows = mergeSalesOperations([record()], ledger({ manualSales: [manual, { ...manual, id: 'linked', linkedExternalId: 'one', linkedSource: 'guru' }] }))
  assert.equal(rows.length, 2)
  assert.equal(rows[1].sellerId, sellerB)
  assert.equal(rows[1].attributionMethod, 'manual')
  assert.equal(rows[1].utm.source, 'Comercial-Emanuel')
  assert.equal(rows[1].received, 1000)
})
