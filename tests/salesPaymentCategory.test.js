import test from 'node:test'
import assert from 'node:assert/strict'
import { salesPaymentLabel } from '../src/utils/platformCash.js'
import { normalizeSource, filterSales, filterOptions, groupSales, summarizeSales, UNKNOWN } from '../src/utils/salesData.js'

test('75 vendas Guru, incluindo dez Pix, formam a mesma categoria no gráfico e no filtro Cartão', () => {
  const rows = normalizeSource('guru', { data: Array.from({ length: 75 }, (_, index) => ({
    hash: `guru-${index}`, payment: { method: index < 65 ? 'credit_card' : 'pix' },
    calculation_details: { net_amount: 100 + index },
  })) })
  const original = structuredClone(rows)
  const selected = filterSales(rows, { payment: 'Cartão' })
  const groups = groupSales(rows, 'payment')
  assert.equal(selected.length, 75)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, 'Cartão')
  assert.equal(groups[0].count, 75)
  assert.equal(groups[0].revenue.value, summarizeSales(rows).revenue.value)
  assert.deepEqual(filterOptions(rows, 'payment'), ['Cartão'])
  assert.deepEqual(filterSales(rows, { payment: 'Pix' }), [])
  assert.equal(rows.filter(row => row.payment === 'Pix').length, 10)
  assert.deepEqual(rows, original, 'a classificação não altera valores ou o meio original dos registros')
})

test('Hotmart inclui Apple Pay, boleto, Pix e meio ausente em Cartão sem mudar os dados originais', () => {
  const methods = ['CREDIT_CARD', 'APPLE_PAY', 'BILLET', 'PIX', null]
  const rows = normalizeSource('hotmart', { success: true, data: {
    financialSchemaVersion: 2, count: methods.length, totalNet: 500,
    transactions: methods.map((paymentMethod, index) => ({ transaction: `hotmart-${index}`, paymentMethod, netValue: 100, netCurrency: 'BRL' })),
  } })
  assert.deepEqual(rows.map(row => row.payment), ['Cartão', 'APPLE_PAY', 'Boleto', 'Pix', 'Não informado'])
  assert.deepEqual(rows.map(salesPaymentLabel), methods.map(() => 'Cartão'))
  assert.equal(groupSales(rows, 'payment')[0].count, methods.length)
  assert.equal(filterSales(rows, { payment: 'Cartão' }).length, methods.length)
  assert.deepEqual(filterSales(rows, { payment: UNKNOWN }), [])
})

test('lançamentos manuais Guru e Hotmart sem meio informado seguem a categoria da plataforma', () => {
  const rows = ['Guru', ' Hotmart ', 'Outra plataforma'].map((platform, index) => ({
    id: `manual-${index}`, sourceId: 'manual', platform, payment: 'Não informado', kind: 'sale', quantity: 1, net: 100,
  }))
  assert.deepEqual(filterSales(rows, { payment: 'Cartão' }).map(row => row.id), ['manual-0', 'manual-1'])
  assert.deepEqual(filterSales(rows, { payment: UNKNOWN }).map(row => row.id), ['manual-2'])
  assert.deepEqual(filterOptions(rows, 'payment'), ['Cartão', 'Não informado'])
  assert.ok(rows.every(row => row.payment === 'Não informado'))
})

test('reembolsos Guru e Hotmart usam a identidade da fonte para a mesma categoria', () => {
  const rows = [
    ...normalizeSource('guruRefunds', { data: [{ hash: 'refund-guru', payment: { method: 'pix' }, calculation_details: { net_amount: 100 } }] }),
    ...normalizeSource('hotmartRefunds', { success: true, data: { count: 1, transactions: [{ transaction: 'refund-hotmart', paymentMethod: 'APPLE_PAY', netValue: 200, netCurrency: 'BRL' }] } }),
  ]
  assert.ok(rows.every(row => row.kind === 'refund'))
  assert.deepEqual(rows.map(salesPaymentLabel), ['Cartão', 'Cartão'])
  assert.deepEqual(rows.map(row => row.payment), ['Pix', 'APPLE_PAY'])
  assert.equal(groupSales(rows, 'payment')[0].count, 2)
  assert.equal(filterSales(rows, { payment: 'Cartão' }).length, 2)
})

test('demais fontes conservam seu meio mesmo quando um rótulo incidental diz Guru ou Hotmart', () => {
  const rows = [
    { sourceId: 'tmb', platform: 'Guru', payment: 'Boleto' },
    { sourceId: 'asaas', platform: 'Hotmart', payment: 'Boleto parcelado' },
    { sourceId: 'boletex', platform: 'Boletex', payment: 'Boleto parcelado' },
    { sourceId: 'manual', platform: 'Outra plataforma', payment: 'Pix' },
    { sourceId: 'anotherProvider', source: 'guru', platform: 'Guru', payment: 'Não informado' },
  ].map((row, index) => ({ ...row, id: `other-${index}`, quantity: 1, revenue: 100 }))
  assert.deepEqual(rows.map(salesPaymentLabel), rows.map(row => row.payment))
  assert.deepEqual(filterSales(rows, { payment: 'Cartão' }), [])
  assert.deepEqual(filterSales(rows, { payment: 'Pix' }).map(row => row.id), ['other-3'])
  assert.deepEqual(filterSales(rows, { payment: UNKNOWN }).map(row => row.id), ['other-4'])
  assert.deepEqual(groupSales(rows, 'payment').map(group => [group.name, group.count]), [
    ['Boleto parcelado', 2], ['Boleto', 1], ['Pix', 1], ['Não informado', 1],
  ])
})

test('saldo agregado Hotmart permanece sem meio original mas participa integralmente de Cartão', () => {
  const rows = normalizeSource('hotmart', { success: true, data: { count: 3, totalNet: 900 } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].isAggregate, true)
  assert.equal(rows[0].payment, 'Não informado')
  assert.equal(groupSales(rows, 'payment')[0].count, 3)
  assert.equal(groupSales(rows, 'payment')[0].revenue.value, 900)
  assert.equal(summarizeSales(filterSales(rows, { payment: 'Cartão' })).count, 3)
})
