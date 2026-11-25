import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { buildComparisonReport, buildGoalPaceReport, buildGoalPlansReport, buildLegacyGoalsReport, buildRevenueGoalsReport } from '../src/utils/goalsComparisonExport.js'
import { buildReportWorkbook } from '../src/utils/reportExport.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'

const metric = (value, partial = false) => ({ value, partial })
const comparison = () => {
  const a = { metrics: { revenue: metric(120), count: metric(0), net: metric(null) }, sources: [{ id: 'guru', label: 'Guru', status: 'ready', count: metric(0), revenue: metric(120) }] }
  const b = { metrics: { revenue: metric(100), count: metric(0), net: metric(null) }, sources: [{ id: 'guru', label: 'Guru', status: 'ready', count: metric(0), revenue: metric(100) }] }
  return {
    snapshots: { a, b }, selection: { mode: 'days', a: { startDate: '2026-11-20', endDate: '2026-11-20' }, b: { startDate: '2026-11-19', endDate: '2026-11-19' } },
    filters: { product: 'MBA', platform: 'Guru' }, groupBy: 'product', groupSearch: 'MBA',
    groupRows: Array.from({ length: 31 }, (_, index) => ({ name: `MBA ${index + 1} · nome completo do produto`, a: a.metrics, b: b.metrics })),
    daily: { rows: [{ label: 'Dia 1', aDate: '2026-11-20', bDate: '2026-11-19', aRevenue: 120, bRevenue: 100, aCount: 0, bCount: 0 }], omittedA: 2, omittedB: 0 },
    hourly: { rows: [{ label: '12:00', aRevenue: 0, bRevenue: null, aCount: 0, bCount: null }], omittedA: 3, omittedB: 1 },
  }
}
const readWorkbook = report => XLSX.read(XLSX.write(buildReportWorkbook(report), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
const rows = (workbook, name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null })

test('comparison export retains all filtered groups beyond the visible page and uses the applied periods', () => {
  const input = comparison()
  const report = buildComparisonReport(input)
  const workbook = readWorkbook(report)
  assert.equal(rows(workbook, 'Distribuição').length, 62)
  assert.equal(rows(workbook, 'Distribuição').at(-1).Grupo, 'MBA 31 · nome completo do produto')
  assert.deepEqual(report.context.find(row => row[0] === 'Produto'), ['Produto', 'MBA'])
  assert.deepEqual(report.context.find(row => row[0] === 'Período A'), ['Período A', '20/11/2026'])
  assert.equal(rows(workbook, 'Indicadores').find(row => row.Indicador === 'Receita operacional')['Variação A − B'], 20)
  assert.equal(rows(workbook, 'Perfil por hora')[0]['Receita A (BRL)'], 0)
  assert.equal(rows(workbook, 'Perfil por hora')[0]['Receita B (BRL)'], null)
})

test('comparison export distinguishes zero, missing values and suspended partial differences', () => {
  const input = comparison()
  input.snapshots.a.metrics.revenue.partial = true
  input.snapshots.a.sources[0].status = 'partial'
  const report = buildComparisonReport(input)
  const workbook = readWorkbook(report)
  const indicators = rows(workbook, 'Indicadores')
  const revenue = indicators.find(row => row.Indicador === 'Receita operacional')
  assert.equal(revenue['Valor A'], 120)
  assert.equal(revenue['Cobertura A'], 'Parcial')
  assert.equal(revenue['Variação A − B'], null)
  assert.equal(revenue['Variação (%)'], null)
  assert.equal(revenue['Estado da comparação'], 'Dados parciais')
  assert.equal(indicators.find(row => row.Indicador === 'Vendas')['Valor A'], 0)
  assert.equal(indicators.find(row => row.Indicador === 'Líquido informado')['Valor A'], null)
  assert.match(report.context.find(row => row[0] === 'Cobertura')[1], /parciais/)
})

test('goal planning export restricts the selected scope and destination while keeping missing tiers and saved breakdowns', () => {
  const report = buildGoalPlansReport({ year: 2026, month: 11, scope: 'product', scopeId: 'MBA', targets: [{ id: 'MBA', name: 'MBA' }], plans: [
    { scope: 'product', scopeId: 'MBA', metric: 'gross', target: 0, superTarget: null, ultraTarget: 100, notes: 'Confirmada' },
    { scope: 'product', scopeId: 'DevClub', metric: 'gross', target: 999 },
    { scope: 'overall', metric: 'gross', target: 1000 },
  ] })
  const exported = rows(readWorkbook(report), 'Metas')
  assert.equal(exported.length, 1)
  assert.equal(exported[0].Destino, 'MBA')
  assert.equal(exported[0]['Meta base'], 0)
  assert.equal(exported[0].Supermeta, null)
  const divided = buildGoalPlansReport({ year: 2026, month: 11, scope: 'overall', scopeId: '', targets: [], plans: [
    { scope: 'overall', metric: 'cash', target: 300, breakdown: [{ key: 'marketing', target: 100 }, { key: 'sales', target: 200 }] },
  ] })
  assert.deepEqual(rows(readWorkbook(divided), 'Composição').map(row => row['Meta base']), [100, 200])
})

test('revenue goal export preserves unconfigured fields instead of showing zero', () => {
  const report = buildRevenueGoalsReport({ year: 2026, month: 11, data: { faturamentoCartao: { base: 0, super: 100 } } })
  const exported = rows(readWorkbook(report), 'Metas financeiras')
  assert.deepEqual(exported[0], { Indicador: 'Faturamento no cartão', 'Meta base': 0, Supermeta: 100, Ultrameta: null })
  assert.equal(exported[1]['Meta base'], null)
})

test('pace export uses the selected destination, keeps daily gaps and labels partial projections', () => {
  const plan = { scope: 'product', scopeId: 'MBA', metric: 'gross', target: 3000, paceBasis: 'calendar' }
  const pace = calculateGoalPace({ year: 2026, month: 11, plan, today: '2026-11-02', sources: [{ id: 'tmb', kind: 'sale', status: 'partial' }], records: [{ kind: 'sale', family: 'MBA', platform: 'TMB', gross: 100, date: '2026-11-01', sourceId: 'tmb' }] })
  const report = buildGoalPaceReport({ year: 2026, month: 11, selection: plan, metric: 'gross', pace, financialSummary: [{ metric: 'gross', pace }], current: {}, selectedPlan: plan })
  const workbook = readWorkbook(report)
  assert.equal(rows(workbook, 'Dia a dia').length, 30)
  assert.equal(rows(workbook, 'Dia a dia')[1]['Realizado no dia'], 0)
  assert.equal(rows(workbook, 'Dia a dia')[2]['Realizado no dia'], null)
  assert.equal(rows(workbook, 'Dia a dia')[2]['Diferença acumulada'], null)
  assert.equal(rows(workbook, 'Financeiro')[0].Cobertura, 'Parcial')
  assert.deepEqual(report.context.find(row => row[0] === 'Destino'), ['Destino', 'MBA'])
  assert.equal(rows(workbook, 'Resumo').find(row => row.Indicador === 'Realizado no mês').Valor, 100)
})

test('future pace and unavailable goals remain explicitly unavailable in the export', () => {
  const plan = { scope: 'overall', metric: 'cash' }
  const pace = calculateGoalPace({ year: 2027, month: 1, plan, today: '2026-11-23' })
  const report = buildGoalPaceReport({ year: 2027, month: 1, selection: plan, metric: 'cash', pace, financialSummary: [{ metric: 'cash', pace }], current: { plansError: true }, selectedPlan: null })
  assert.equal(report.context.find(row => row[0] === 'Metas')[1], 'Indisponíveis')
  assert.equal(report.context.find(row => row[0] === 'Cobertura')[1], 'Período não iniciado')
  assert.equal(rows(readWorkbook(report), 'Resumo').find(row => row.Indicador === 'Meta base').Valor, null)
  assert.ok(report.sheets.find(sheet => sheet.name === 'Dia a dia').rows.every(row => row[2] === null))
})

test('legacy exports use confirmed values and do not export commercial defaults as saved goals', () => {
  const fallback = buildLegacyGoalsReport({ kind: 'commercial', year: 2026, month: 11, goals: { isFallback: true, team_goal: 999 } })
  assert.equal(fallback.sheets[0].rows.length, 0)
  const team = buildLegacyGoalsReport({ kind: 'team', year: 2026, month: 11, targets: [{ id: 'one', name: 'Time 1' }, { id: 'two', name: 'Time 2' }], goals: [{ team_id: 'one', monthly_goal: 0, weekly_goal: 20 }] })
  assert.deepEqual(team.sheets[0].rows[0], ['Time 1', 0, null, 20, null, 'Configurada'])
  assert.deepEqual(team.sheets[0].rows[1], ['Time 2', null, null, null, null, 'Não configurada'])
  const sellers = buildLegacyGoalsReport({ kind: 'seller', search: 'Ana', goals: [{ name: 'Ana', individual_goal: 0, excluded_from_ranking: true }] })
  assert.deepEqual(sellers.sheets[0].rows, [['Ana', 0, 'Fora dos cálculos · histórico']])
  assert.deepEqual(sellers.context.find(row => row[0] === 'Busca de vendedor'), ['Busca de vendedor', 'Ana'])
})
