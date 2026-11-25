import { DETAIL_METRICS, PRIMARY_METRICS, rangeLabel, sourceStatus } from '../components/charts/comparisonFormat.js'
import { GOAL_METRICS } from '../components/goals/goalConfig.js'
import { compareMetrics } from './comparisonData.js'
import { goalScope, goalScopeName, GOAL_SCOPES } from './goalScopes.js'
import { UNKNOWN } from './salesData.js'

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`
const metricState = metric => metric?.value == null ? 'Indisponível' : metric.partial ? 'Parcial' : 'Completo'
const variationState = delta => ({ partial: 'Dados parciais', unavailable: 'Sem dados comparáveis', 'zero-base': 'Base B igual a zero; percentual indisponível' })[delta.reason] || 'Comparável'
const unitLabel = unit => unit === 'currency' ? 'BRL' : 'Quantidade'
const dimensionLabel = key => ({ product: 'Produto', family: 'Família', payment: 'Pagamento' })[key] || key

function comparisonValues(a, b) {
  const delta = compareMetrics(a, b)
  return [a?.value ?? null, metricState(a), b?.value ?? null, metricState(b), delta.absolute, delta.percent, variationState(delta)]
}

export function buildComparisonReport({ snapshots, selection, filters, groupBy, groupSearch, groupRows, daily, hourly }) {
  const { a, b } = snapshots
  const sourceIds = [...new Set([...a.sources, ...b.sources].map(source => source.id))]
  const metrics = [...PRIMARY_METRICS, ...DETAIL_METRICS, ['refund', 'Valor das vendas reembolsadas', 'currency'], ['refundCount', 'Reembolsos confirmados', 'count']]
  const comparisonHeaders = ['Valor A', 'Cobertura A', 'Valor B', 'Cobertura B', 'Variação A − B', 'Variação (%)', 'Estado da comparação']
  const seriesSheet = (name, series) => ({ name, headers: ['Posição / horário', 'Data A', 'Data B', 'Receita A (BRL)', 'Receita B (BRL)', 'Vendas A', 'Vendas B'], rows: series.rows.map(row => [row.label, row.aDate ?? null, row.bDate ?? null, row.aRevenue, row.bRevenue, row.aCount, row.bCount]) })
  return {
    title: 'Comparativo de vendas', filename: `comparativo-${selection.a.startDate}-${selection.b.startDate}`,
    context: [
      ['Período A', rangeLabel(selection.a)], ['Período B · base', rangeLabel(selection.b)],
      ...[['family', 'Família'], ['product', 'Produto'], ['platform', 'Plataforma'], ['payment', 'Pagamento']].map(([key, label]) => [label, filters[key] === UNKNOWN ? 'Não informado' : filters[key] || 'Todos']),
      ['Agrupamento', dimensionLabel(groupBy)], ['Busca na distribuição', groupSearch || 'Sem busca'],
      ['Distribuição', `${groupRows.length} grupos; todas as páginas do recorte`],
      ['Cobertura', [a, b].some(side => side.sources.some(source => source.status !== 'ready')) ? 'Há fontes indisponíveis ou parciais. Consulte a cobertura de cada indicador.' : 'Fontes disponíveis'],
      ['Distribuição incompleta', a.allocationMissing || b.allocationMissing ? 'Há saldos sem identificação fora dos filtros.' : 'Não identificada'],
      ['Série diária sem data individual', `A: ${daily.omittedA}; B: ${daily.omittedB}`],
      ['Série horária sem horário exato', `A: ${hourly.omittedA}; B: ${hourly.omittedB}`],
      ['Critério', 'Dados dos períodos e filtros aplicados. A busca por grupo afeta a distribuição. Variações ficam vazias quando os dados são parciais ou indisponíveis. Valores ausentes não são zero. Datas e horas em Brasília.'],
    ],
    sheets: [
      { name: 'Indicadores', headers: ['Indicador', 'Unidade', ...comparisonHeaders], rows: metrics.map(([key, label, unit]) => [label, unitLabel(unit), ...comparisonValues(a.metrics[key], b.metrics[key])]) },
      { name: 'Distribuição', headers: ['Grupo', 'Indicador', 'Unidade', ...comparisonHeaders], rows: groupRows.flatMap(row => [['count', 'Vendas', 'count'], ['revenue', 'Receita operacional', 'currency']].map(([key, label, unit]) => [row.name, label, unitLabel(unit), ...comparisonValues(row.a[key], row.b[key])])) },
      seriesSheet('Dia a dia', daily), seriesSheet('Perfil por hora', hourly),
      { name: 'Fontes', headers: ['Fonte', 'Estado A', 'Estado B', 'Indicador', ...comparisonHeaders], rows: sourceIds.flatMap(id => {
        const first = a.sources.find(source => source.id === id), second = b.sources.find(source => source.id === id)
        const source = first || second
        const label = source.kind === 'refund' ? `Estornos / contestações · ${source.platform}` : source.label || source.id
        return [['count', 'Vendas / registros'], ['revenue', 'Valor (BRL)']].map(([key, metric]) => [label, sourceStatus(first?.status), sourceStatus(second?.status), metric, ...comparisonValues(first?.[key], second?.[key])])
      }) },
    ],
  }
}

export function buildGoalPlansReport({ year, month, scope, scopeId, plans, targets }) {
  const selected = plans.filter(plan => goalScope(plan).scope === scope && (!scopeId || goalScope(plan).scopeId === scopeId))
  const name = plan => targets.find(target => target.id === goalScope(plan).scopeId)?.name || goalScopeName(plan)
  const status = plan => {
    const destination = targets.find(target => target.id === goalScope(plan).scopeId)
    return destination?.excludedFromRanking ? 'Fora dos cálculos · histórico' : destination?.active === false ? 'Cadastro inativo' : 'Ativo'
  }
  return {
    title: 'Metas da operação', filename: `metas-${monthKey(year, month)}-${scope}`,
    context: [['Período', monthKey(year, month)], ['Escopo', GOAL_SCOPES[scope]], ['Destino', scope === 'overall' ? 'Meta geral' : targets.find(target => target.id === scopeId)?.name || scopeId || 'Todos'], ['Critério', 'Metas confirmadas pelo servidor para o período e destino selecionados. Edições ainda não salvas não são exportadas. Células vazias indicam valores não informados.']],
    sheets: [
      { name: 'Metas', headers: ['Destino', 'Indicador', 'Unidade', 'Meta base', 'Supermeta', 'Ultrameta', 'Ritmo', 'Participação', 'Notas'], rows: selected.map(plan => [name(plan), GOAL_METRICS[plan.metric]?.label || plan.metric, unitLabel(GOAL_METRICS[plan.metric]?.unit), plan.target ?? null, plan.superTarget ?? null, plan.ultraTarget ?? null, plan.paceBasis === 'business' ? 'Dias úteis' : 'Dias corridos', status(plan), plan.notes || '']) },
      { name: 'Composição', headers: ['Destino', 'Indicador', 'Área', 'Meta base', 'Supermeta', 'Ultrameta'], rows: selected.flatMap(plan => (plan.breakdown || []).map(part => [name(plan), GOAL_METRICS[plan.metric]?.label || plan.metric, part.key === 'marketing' ? 'Marketing' : 'Vendas', part.target ?? null, part.superTarget ?? null, part.ultraTarget ?? null])) },
    ],
  }
}

export function buildRevenueGoalsReport({ year, month, data }) {
  return {
    title: 'Receita por meio de pagamento', filename: `metas-receita-${monthKey(year, month)}`,
    context: [['Período', monthKey(year, month)], ['Unidade', 'BRL'], ['Critério', 'Valores salvos no servidor. Células vazias indicam valores não informados.']],
    sheets: [{ name: 'Metas financeiras', headers: ['Indicador', 'Meta base', 'Supermeta', 'Ultrameta'], rows: [['faturamentoCartao', 'Faturamento no cartão'], ['faturamentoBoleto', 'Faturamento no boleto'], ['investimentoTrafego', 'Orçamento de aquisição']].map(([key, label]) => [label, ...['base', 'super', 'ultra'].map(level => data[key]?.[level] ?? null)]) }],
  }
}

export function buildLegacyGoalsReport({ kind, year, month, goals, targets = [], search = '' }) {
  const period = kind === 'seller' ? 'Meta mensal vigente no cadastro' : monthKey(year, month)
  const title = { commercial: 'Metas comerciais', team: 'Metas por time', seller: 'Metas individuais dos vendedores' }[kind]
  const headers = kind === 'commercial' ? ['Indicador', 'Valor (BRL)'] : kind === 'team'
    ? ['Time', 'Meta mensal (BRL)', 'Hipermeta (BRL)', 'Meta semanal (BRL)', 'Meta diária (BRL)', 'Estado']
    : ['Vendedor', 'Meta mensal (BRL)', 'Participação']
  const rows = kind === 'commercial' ? goals.isFallback ? [] : [
    ['team_goal', 'Meta mensal'], ['monthly_hyper_goal', 'Hipermeta'], ['weekly_goal', 'Meta semanal'],
    ['daily_goal', 'Meta diária'], ['daily_special_bonus_threshold', 'Bônus especial diário'], ['cash_collected_target', 'Cash collected'],
  ].map(([key, label]) => [label, goals[key] ?? null]) : kind === 'team' ? targets.map(team => {
    const goal = goals.find(item => item.team_id === team.id)
    return [team.name, ...['monthly_goal', 'monthly_hyper_goal', 'weekly_goal', 'daily_goal'].map(key => goal?.[key] ?? null), goal ? 'Configurada' : 'Não configurada']
  }) : goals.map(seller => [seller.name, seller.individual_goal ?? null, seller.excluded_from_ranking || seller.excludedFromRanking ? 'Fora dos cálculos · histórico' : 'Incluído nos cálculos'])
  return {
    title, filename: `metas-comerciais-${kind}${kind === 'seller' ? '' : `-${period}`}`,
    context: [['Período', period], ['Busca de vendedor', search || 'Sem busca'], ['Critério', 'Valores salvos do módulo comercial anterior. Edições ainda não salvas e sugestões padrão não são exportadas. Células vazias indicam metas não informadas.']],
    sheets: [{ name: 'Metas comerciais', headers, rows }],
  }
}

const paceStatus = pace => pace.future ? 'Período não iniciado' : pace.actual === null ? 'Indisponível' : pace.definitive ? 'Completo' : 'Parcial'

export function buildGoalPaceReport({ year, month, selection, metric, pace, financialSummary, current, selectedPlan }) {
  const unit = unitLabel(pace.metric.unit)
  const metricRows = [
    ['Meta base', pace.target, unit], ['Supermeta', pace.superTarget, unit], ['Ultrameta', pace.ultraTarget, unit],
    ['Realizado no mês', pace.future ? null : pace.actual, unit], ['Esperado até hoje', pace.expected, unit],
    ['Ritmo da meta', pace.pacePercent, '%'], ['Atingimento', pace.attainment, '%'],
    [pace.ended ? 'Fechamento realizado' : 'Projeção do mês', pace.projection, unit],
    ['Falta para a meta', pace.remaining, unit], ['Necessário por dia restante', pace.requiredPerDay, unit],
    ['Dias considerados', pace.elapsedDays, 'Dias'], ['Dias no mês', pace.totalDays, 'Dias'], ['Dias restantes', pace.remainingDays, 'Dias'],
  ]
  return {
    title: 'Metas e ritmo de vendas', filename: `ritmo-metas-${monthKey(year, month)}-${selection.scope}-${metric}`,
    context: [
      ['Período', monthKey(year, month)], ['Escopo', GOAL_SCOPES[selection.scope]], ['Destino', goalScopeName(selection)],
      ['Base financeira', pace.metric.label], ['Distribuição', pace.basis === 'business' ? 'Dias úteis · segunda a sexta' : 'Dias corridos'],
      ['Observado até', pace.lastObservedDate || 'Período não iniciado'], ['Cobertura', paceStatus(pace)],
      ['Metas', current.plansError ? 'Indisponíveis' : selectedPlan ? 'Configuradas' : 'Não definidas'],
      ['Vendas', current.salesError ? 'Consulta indisponível' : pace.sourceIncomplete ? 'Cobertura incompleta' : 'Fontes disponíveis'],
      ['Cadastros', current.directoryError ? 'Indisponíveis' : 'Disponíveis'],
      ['Registros sem valor', pace.missingRecords], ['Registros sem atribuição ao destino', pace.unassignedRecords], ['Registros sem data individual', pace.unallocatedRecords],
      ['Participação', pace.scopeExcluded ? 'Fora dos cálculos de desempenho' : 'Incluído nos cálculos'],
      ['Notas', selectedPlan?.notes || ''],
      ['Critério', 'Valores calculados da consulta e do destino selecionados. Campos vazios são indisponíveis ou ainda não observados. Projeções parciais mantêm a cobertura informada. Datas em Brasília.'],
    ],
    sheets: [
      { name: 'Resumo', headers: ['Indicador', 'Valor', 'Unidade'], rows: metricRows },
      { name: 'Financeiro', headers: ['Indicador', 'Realizado (BRL)', 'Meta (BRL)', 'Ritmo (%)', 'Cobertura'], rows: financialSummary.map(({ metric: key, pace: item }) => [GOAL_METRICS[key].label, item.future ? null : item.actual, item.target, item.pacePercent, paceStatus(item)]) },
      { name: 'Dia a dia', headers: ['Data', 'Planejado no dia', 'Realizado no dia', 'Planejado acumulado', 'Realizado acumulado', 'Diferença acumulada', 'Observado'], rows: pace.rows.map(row => [row.date, row.dailyTarget, row.dailyActual, row.planned, row.actual, row.actual === null || row.planned === null ? null : row.actual - row.planned, row.observed ? 'Sim' : 'Não']) },
    ],
  }
}
