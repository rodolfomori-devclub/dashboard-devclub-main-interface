import test from 'node:test'
import assert from 'node:assert/strict'
import { netBasisLabel } from '../src/utils/netBasis.js'
import { normalizeSource } from '../src/utils/salesData.js'

const guru = calculation => normalizeSource('guru', { data: [{ id: 'g1', product: { name: 'DevClub' }, payment: { method: 'credit_card' }, dates: { created_at: 1795438800 }, calculation_details: calculation }] })[0]

test('Guru rows say whether the net comes from the fee table, the gateway report or the previous rule', () => {
  const priced = guru({ net_amount: 2104.26, legacy_net_amount: 2052.7, charged_amount: 2397.2, basis: 'estimated', gateway: 'pagarme', installments: 12, fee_rule: 'pagarme.card.12@2025-10-01#atual' })
  assert.deepEqual([priced.net, priced.legacyNet, priced.charged, priced.gateway, priced.installments, priced.feeRule], [2104.26, 2052.7, 2397.2, 'pagarme', 12, 'pagarme.card.12@2025-10-01#atual'])
  assert.equal(netBasisLabel(priced), 'Estimado pela tabela de taxas')
  assert.equal(netBasisLabel(guru({ net_amount: 2056.79, legacy_net_amount: 2052.7, basis: 'gateway_reported' })), 'Informado pela Guru (estimado)')
  assert.equal(netBasisLabel(guru({ net_amount: 2052.7, legacy_net_amount: 2052.7, basis: 'legacy' })), 'Estimado pela regra anterior')
})

test('an API without the fee table keeps the row as before and the commission base falls back to the net', () => {
  const old = guru({ net_amount: 2052.7 })
  assert.equal(Object.hasOwn(old, 'legacyNet'), false)
  assert.deepEqual([old.net, old.charged, old.netBasis], [2052.7, null, null])
  assert.equal(netBasisLabel(old), 'Estimado pela regra anterior')
})

test('platform nets and contracted values are labelled without inventing a fee estimate', () => {
  assert.equal(netBasisLabel({ sourceId: 'hotmart', platform: 'Hotmart' }), 'Informado pela plataforma')
  assert.equal(netBasisLabel({ sourceId: 'manual', platform: 'Hubla', isManual: true }), 'Informado no lançamento manual')
  assert.equal(netBasisLabel({ sourceId: 'tmb', platform: 'TMB' }), null)
})
