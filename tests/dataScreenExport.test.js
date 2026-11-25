import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAttributionReport, buildBuyerIntelligenceReport, buildRefundsReport } from '../src/utils/dataScreenExport.js'

const period = { startDate: '2026-11-01', endDate: '2026-11-23' }
const rowObject = (sheet, index = 0) => Object.fromEntries(sheet.headers.map((header, column) => [header, sheet.rows[index][column]]))

test('refund export includes the entire filtered collection, separate returned amounts and source limitations', () => {
  const records = Array.from({ length: 43 }, (_, index) => ({ id: `refund-${index}`, name: `Cliente ${index}`, status: index ? 'refunded' : 'requested', sources: ['guru'], platform: 'guru', saleAmount: index ? 0 : 150, refundAmount: null, currency: 'BRL', refundCurrency: 'USD', referenceDate: '2026-11-01', dateBasis: 'request', contact: '+5511999990000' }))
  const report = buildRefundsReport(records, { period, filters: [['Produto', 'MBA']], result: { incomplete: true, sources: [{ id: 'guru', status: 'partial', recordCount: 43, message: 'Somente registros recebidos.' }], excludedUndated: 3, deduplication: { removed: 2 } } })
  const sheet = report.sheets.find(sheet => sheet.name === 'Registros')
  assert.equal(sheet.rows.length, 43)
  assert.equal(rowObject(sheet)['Valor da venda'], 150)
  assert.equal(rowObject(sheet)['Valor efetivamente devolvido'], null)
  assert.equal(rowObject(sheet, 1)['Valor da venda'], 0)
  assert.equal(rowObject(sheet)['Contato'], '+5511999990000')
  assert.equal(rowObject(sheet)['Moeda da venda'], 'BRL')
  assert.equal(rowObject(sheet)['Moeda do valor devolvido'], 'USD')
  assert.equal(rowObject(sheet)['Data de referência (Brasília)'], '01/11/2026')
  assert.equal(rowObject(sheet)['Status'], 'Reembolso solicitado')
  assert.ok(report.context.some(row => row[0] === 'Produto' && row[1] === 'MBA'))
  assert.match(JSON.stringify(report.context), /parciais|Parcial/)
  assert.match(JSON.stringify(report.sheets), /Somente registros recebidos/)
  assert.equal(rowObject(sheet, 42)['ID do registro'], 'refund-42')
})

test('attribution export preserves reconciled manual rows without folding them into financial totals', () => {
  const rows = Array.from({ length: 52 }, (_, index) => ({ id: `sale-${index}`, date: '2026-11-02T02:30:00Z', buyerName: '=CLIENTE()', platform: 'Hotmart', gross: 200, net: 200, received: null, utm: { source: 'comercial-ana' }, isLinkedManual: index === 51, syncPending: index === 51 }))
  const report = buildAttributionReport(rows, { period: { from: period.startDate, to: period.endDate }, filters: [['Vendedor', 'Ana']], sources: [{ id: 'hotmart', label: 'Hotmart', status: 'ready' }], warning: 'Vínculos de UTM indisponíveis.' })
  const sheet = report.sheets.find(sheet => sheet.name === 'Vendas para atribuição')
  assert.equal(sheet.rows.length, 52)
  assert.equal(rowObject(sheet)['Caixa recebido'], null)
  assert.equal(rowObject(sheet)['Data (Brasília)'], '01/11/2026, 23:30')
  assert.equal(rowObject(sheet)['Cliente'], '=CLIENTE()')
  assert.equal(rowObject(sheet)['UTM Source'], 'comercial-ana')
  assert.equal(rowObject(sheet, 51)['Conferência'], 'Vinculada à plataforma')
  assert.equal(rowObject(sheet, 51)['Fora dos totais manuais'], 'Sim')
  assert.match(JSON.stringify(report.context), /Vínculos de UTM indisponíveis/)
  assert.equal(report.sheets.length, 2, 'No commercial aggregation can double-count linked manual copies')
})

test('buyer intelligence exports the applied period, denominators and historical scope separately', () => {
  const data = {
    period: { dateFrom: '2026-10-01', dateTo: '2026-10-31' }, coverage: { totalPurchases: 8, withLeadProfiles: 2 },
    linkedPurchases: 4, approvedPurchases: 6, approvedLinkedPurchases: 4, profiles: 3, repeatBuyerProfiles: 1,
    denominators: { repeatBuyerProfiles: 3, launchDistribution: 4, priorSourceDistribution: 2 },
    launchCountBeforePurchaseDistribution: [{ launches: '0', purchases: 2 }], priorSourceDistribution: [{ source: '(sem utm_source)', purchases: 1 }],
    historicalCoverage: { records: 20, linked: 10, undated: 5, surveys: 7, engagements: 0, sources: [{ source: 'Histórico', records: 20, linked: 10, undated: 5 }] },
    productCatalog: { approvedMapped: 4 }, productDistribution: [{ classification: 'MAPPED', name: 'MBA', purchases: 4, profiles: 3 }], notice: 'Perfis não são pessoas únicas confirmadas.',
  }
  const report = buildBuyerIntelligenceReport(data, { dateFrom: '2026-11-01', dateTo: '2026-11-23' })
  assert.match(report.filename, /2026-10-01-2026-10-31/)
  assert.ok(report.context.some(row => row[0] === 'Histórico recuperado' && /toda a base importada/i.test(row[1])))
  const indicators = report.sheets.find(sheet => sheet.name === 'Indicadores')
  assert.equal(indicators.rows.find(row => row[0] === 'Indício de recompra')[2], 3)
  assert.equal(indicators.rows.find(row => row[0] === 'Indício de recompra')[3], '33,3%')
  const products = report.sheets.find(sheet => sheet.name === 'Produtos')
  assert.equal(rowObject(products)['Base de pedidos aprovados'], 6)
  const history = report.sheets.find(sheet => sheet.name === 'Histórico completo')
  assert.equal(history.rows.find(row => row[0] === 'Engajamentos registrados')[1], 0)
  assert.match(JSON.stringify(report.context), /Perfis não são pessoas únicas/)
})

test('buyer intelligence does not turn missing or invalid counts into zeros or percentages', () => {
  const report = buildBuyerIntelligenceReport({ coverage: { totalPurchases: null }, profiles: -1, linkedPurchases: null, repeatBuyerProfiles: 0, denominators: { repeatBuyerProfiles: 0 } }, { dateFrom: '2026-11-01', dateTo: '2026-11-23' })
  const indicators = report.sheets.find(sheet => sheet.name === 'Indicadores')
  assert.equal(indicators.rows.find(row => row[0] === 'Pedidos ligados a um perfil')[1], null)
  assert.equal(indicators.rows.find(row => row[0] === 'Perfis com pedidos aprovados')[1], null)
  assert.equal(indicators.rows.find(row => row[0] === 'Indício de recompra')[1], 0)
  assert.equal(indicators.rows.find(row => row[0] === 'Indício de recompra')[3], '—')
  assert.match(JSON.stringify(report.context), /Histórico recuperado.*Indisponível/)
  assert.match(JSON.stringify(report.context), /Catálogo de produtos.*Indisponível/)
})
