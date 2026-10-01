import test from 'node:test'
import assert from 'node:assert/strict'
import { amount, normalizeSource, productFamily, filterSales, summarizeSales, groupSales, hourlySales, saleHour, UNKNOWN } from './salesData.js'

const guru = { data: [{ hash: 'g-1', product: { name: 'DevClub Vitalício' }, dates: { created_at: 1780322400 }, payment: { method: 'pix', total: 1000 }, calculation_details: { total_amount: 1000, net_amount: 890, discounts: { pix_fee: 10, processing_fee: 2 }, net_affiliate_value: 98 }, trackings: { utm_source: 'comercial', utm_campaign: 'turma-junho' } }] }
const hotmart = { success: true, data: { count: 1, totalGross: 400, totalNet: 355, totalFees: 45, transactions: [{ transaction: 'h-1', product: 'Seu Segundo Salário com IA', grossValue: 400, netValue: 355, fee: 45, paymentMethod: 'CREDIT_CARD', orderDate: '2026-06-01T15:00:00Z' }] } }
const asaas = { success: true, data: { sales: { count: 1, totalValue: 2000, entryValue: 200, entries: [{ productDescription: 'MBA em IA', totalValue: 2000, entryValue: 200, createdAt: '2026-06-01T16:00:00Z' }] } } }
const boletex = { success: true, data: { sales: { count: 1, totalValue: 3000, confirmedValue: 500, listPriceValue: 2500, pendingValue: 2500, entries: [{ id: 'b-1', productDescription: 'IA Club', totalValue: 3000, listPrice: 2500, entryValue: 500, pendingValue: 2500, createdAt: '2026-06-01T17:00:00Z' }] }, emitted: { count: 9, expectedEntryValue: 1800, details: [] } } }

test('classifica famílias por nomes explícitos, sem jogar produto desconhecido em DevClub', () => {
  assert.equal(productFamily('SEU SEGUNDO SALÁRIO COM IA'), 'Seu segundo salário com IA')
  assert.equal(productFamily('MBA - Inteligência Artificial'), 'MBA')
  assert.equal(productFamily('Dev Club Full Stack'), 'DevClub')
  assert.equal(productFamily('Formação Gestor de IA'), 'IAClub')
  assert.equal(productFamily('Curso ainda sem classificação'), 'Outros')
  assert.equal(productFamily(null), 'Não informado')
})

test('mantém bruto, líquido, taxas e afiliado Guru sem dupla dedução', () => {
  const [row] = normalizeSource('guru', guru)
  assert.deepEqual([row.gross, row.net, row.fees, row.affiliate, row.revenue], [1000, 890, 12, 98, 890])
  assert.equal(row.product, 'DevClub Vitalício')
  assert.equal(row.payment, 'Pix')
  assert.equal(row.externalId, 'g-1')
})

test('total operacional conserva fórmula dos cinco provedores e ignora Boletex apenas emitido', () => {
  const rows = [...normalizeSource('guru', guru), ...normalizeSource('hotmart', hotmart), ...normalizeSource('asaas', asaas), ...normalizeSource('boletex', boletex), ...normalizeSource('tmb', { data: [{ value: 700, product: 'DevClub', raw: { pedido_id: 42 } }] })]
  const summary = summarizeSales(rows)
  assert.equal(summary.count, 5)
  assert.equal(summary.revenue.value, 890 + 355 + 2000 + 3000 + 700)
  assert.equal(summary.net.value, 1245)
  assert.equal(summary.net.missing, 3)
  assert.equal(summary.received.value, 700)
})

test('filtros família, original, plataforma, pagamento e UTMs operam sobre a mesma lista', () => {
  const records = [...normalizeSource('guru', guru), ...normalizeSource('hotmart', hotmart)]
  const filtered = filterSales(records, { family: 'DevClub', product: 'DevClub Vitalício', payment: 'Pix', platform: 'Guru', source: 'comercial', campaign: 'turma-junho' })
  assert.equal(filtered.length, 1)
  assert.equal(summarizeSales(filtered).revenue.value, groupSales(filtered, 'product')[0].revenue.value)
  assert.equal(hourlySales(filtered).hours.reduce((sum, row) => sum + row.value, 0), 890)
  assert.equal(filterSales(records, { payment: 'Cartão' })[0].platform, 'Hotmart')
})

test('UTM ausente permanece desconhecida e pode ser filtrada, nunca vira orgânico', () => {
  const records = normalizeSource('hotmart', hotmart)
  assert.equal(records[0].utm.source, null)
  assert.equal(filterSales(records, { source: UNKNOWN }).length, 1)
  assert.equal(filterSales(records, { source: 'organico' }).length, 0)
  assert.equal(groupSales(records, 'source')[0].name, 'Não informado')
})

test('falha declarada ou resposta inválida não se transforma em dia com zero vendas', () => {
  assert.throws(() => normalizeSource('guru', { success: false, data: [] }))
  assert.throws(() => normalizeSource('hotmart', { success: true, data: {} }))
  assert.throws(() => normalizeSource('asaas', { success: true, data: {} }))
  assert.deepEqual(normalizeSource('guru', { data: [] }), [])
})

test('consolidado sem detalhamento preserva valor e contagem sem inventar produto ou horário', () => {
  const rows = normalizeSource('hotmart', { success: true, data: { count: 3, totalNet: 900, totalGross: 1000, totalFees: 100 } })
  assert.equal(summarizeSales(rows).revenue.value, 900)
  assert.equal(summarizeSales(rows).count, 3)
  assert.equal(rows[0].product, null)
  assert.equal(rows[0].date, null)
  assert.equal(rows[0].canAttribute, false)
  assert.equal(filterSales(rows, { family: 'DevClub' }).length, 0)
  assert.equal(hourlySales(rows).unknown, 3)
})

test('detalhes Hotmart completos não duplicam o consolidado e timestamps usam Brasília', () => {
  const rows = normalizeSource('hotmart', hotmart)
  assert.equal(rows.length, 1)
  assert.equal(saleHour(rows[0].date), 12)
  assert.equal(hourlySales(rows).hours[12].count, 1)
  assert.equal(saleHour('data inválida'), null)
})

test('TMB usa pedido_id real; Sheets e Asaas sem ID não recebem identidade inventada', () => {
  assert.equal(normalizeSource('tmb', { data: [{ id: 'tmb-42-9', raw: { pedido_id: 42 }, value: 9 }] })[0].externalId, '42')
  assert.equal(normalizeSource('tmb', { data: [{ id: 'sheets-19', value: 9 }] })[0].externalId, null)
  assert.equal(normalizeSource('asaas', asaas)[0].externalId, null)
  const checkout = structuredClone(asaas)
  checkout.data.sales.entries[0].id = 'checkout-42'
  checkout.data.sales.entries[0].customerEmail = 'fixture@example.test'
  assert.equal(normalizeSource('asaas', checkout)[0].externalId, 'checkout-42')
  assert.equal(normalizeSource('asaas', checkout)[0].canAttribute, true)
  assert.equal(normalizeSource('asaas', checkout)[0].buyerEmail, 'fixture@example.test')
})

test('reembolso usa valor próprio do provedor, sem diminuir vendas na normalização', () => {
  const rows = normalizeSource('hotmartRefunds', { success: true, data: { count: 1, totalRefundAmount: 400, transactions: [{ transaction: 'h-ref', value: 400, product: 'MBA', paymentMethod: 'PIX' }] } })
  assert.equal(rows[0].kind, 'refund')
  assert.equal(rows[0].net, null)
  assert.equal(summarizeSales(rows).revenue.value, 400)
})

test('valores ausentes diferem de zero real', () => {
  assert.equal(amount(null), null)
  assert.equal(amount(''), null)
  assert.equal(amount(false), null)
  assert.equal(amount('0'), 0)
  const [row] = normalizeSource('guru', { data: [{ product: { name: 'MBA' } }] })
  assert.equal(row.revenue, null)
  assert.equal(summarizeSales([row]).revenue.missing, 1)
})

test('venda com horário mas sem valor cria lacuna financeira no gráfico, nunca zero falso', () => {
  const [row] = normalizeSource('guru', { data: [{ product: { name: 'MBA' }, dates: { created_at: 1780322400 } }] })
  const result = hourlySales([row])
  const hour = result.hours[saleHour(row.date)]
  assert.equal(hour.count, 1)
  assert.equal(hour.value, null)
})
