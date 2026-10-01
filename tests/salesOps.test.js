import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSalesOperations, saleSnapshot } from '../src/services/salesOpsService.js'

const source = { id: 'guru:tx-1', source: 'guru', externalId: 'tx-1', kind: 'sale', quantity: 1, gross: 1000, net: 890, revenue: 890, date: '2026-09-30T15:00:00Z', product: 'DevClub', platform: 'Guru', utm: {} }
const manual = { id: 'manual-1', date: '2026-09-30', product: 'DevClub', family: 'DevClub', gross: 1000, net: 900, cashCollected: 100, buyerName: 'Cliente', sellerName: 'Pessoa', platform: 'Pix', utm: {} }

test('a manual sale contributes its net and cash separately and merge is idempotent', () => {
  const ledger = { manualSales: [manual] }
  const merged = mergeSalesOperations([source], ledger)
  assert.equal(merged.length, 2)
  assert.equal(merged[1].revenue, 900)
  assert.equal(merged[1].received, 100)
  assert.equal(merged[1].canAttribute, false)
  assert.deepEqual(mergeSalesOperations(merged, ledger), merged)
});

test('a reconciled manual remains in the ledger but never duplicates platform totals', () => {
  const ledger = { manualSales: [{ ...manual, linkedSource: 'guru', linkedExternalId: 'tx-1' }], attributions: [{ id: 'a1', source: 'guru', externalId: 'tx-1', sellerName: 'Vendedor', status: 'reconciled' }] }
  const merged = mergeSalesOperations([source], ledger)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].net, 890)
  assert.equal(merged[0].sellerName, 'Vendedor')
  assert.equal(ledger.manualSales.length, 1)
});

test('source identities are platform-scoped and refunds never inherit sales attribution', () => {
  const ledger = { attributions: [{ source: 'guru', externalId: 'tx-1', sellerName: 'Vendedor' }] }
  const [guru, hotmart, refund] = mergeSalesOperations([source, { ...source, source: 'hotmart' }, { ...source, kind: 'refund' }], ledger)
  assert.equal(guru.sellerName, 'Vendedor')
  assert.equal(hotmart.sellerName, undefined)
  assert.equal(refund.sellerName, undefined)
});

test('snapshot preserves missing values and Sao Paulo business date', () => {
  const snapshot = saleSnapshot({ ...source, date: '2026-10-01T01:00:00Z', net: null, gross: 12.349 })
  assert.equal(snapshot.date, '2026-09-30')
  assert.equal(snapshot.gross, 12.35)
  assert.equal(snapshot.net, null)
  assert.equal(snapshot.cashCollected, null)
});
