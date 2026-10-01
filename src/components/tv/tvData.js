import { prepareGoalData } from '../../utils/goalData.js'
import { brazilDate, calculateGoalPace, dateForRecord, monthBounds, PACE_METRICS } from '../../utils/goalPace.js'
import { goalScope, goalScopeName } from '../../utils/goalScopes.js'
import { buildRevenueBreakdown, revenuePaymentGroup } from '../../utils/revenueBreakdown.js'
import { amount, hourlySales, productFamily, sumAmount } from '../../utils/salesData.js'
import { sourceHasSales } from '../../utils/sourceAvailability.js'

const PAYMENT_NAMES = { card: 'Cartão', boleto: 'Boleto', pix: 'Pix', other: 'Outros', unknown: 'Não informado' }
const STATUS_NAMES = { ready: 'Disponível', partial: 'Parcial', stale: 'Último dado disponível', unavailable: 'Indisponível', not_requested: 'Não consultado' }
const hasIdentity = value => typeof value === 'string' && Boolean(value.trim())
const isNewSale = row => row.kind === 'sale' && !row.isReceipt && !(row.isManual && (row.linkedExternalId || row.original?.linkedExternalId))

/** Resolve the television calendar in Brasília, including unattended midnight rollover. */
export function resolveTvPeriod(selectedMonth = 'current', now = new Date()) {
  const today = brazilDate(now)
  const candidate = /^\d{4}-\d{2}$/.test(selectedMonth || '') ? selectedMonth : today.slice(0, 7)
  let bounds, year = Number(candidate.slice(0, 4)), month = Number(candidate.slice(5, 7))
  try { bounds = monthBounds(year, month) } catch { year = Number(today.slice(0, 4)); month = Number(today.slice(5, 7)); bounds = monthBounds(year, month) }
  return { ...bounds, year, month, key: bounds.start.slice(0, 7), today, future: today < bounds.start, observedEnd: today < bounds.start ? null : today < bounds.end ? today : bounds.end }
}

function subtotal(rows, field, available, partial = false) {
  const sum = sumAmount(rows, field)
  return { value: !available || (rows.length > 0 && sum.known === 0) ? null : sum.value,
    count: available ? rows.reduce((total, row) => total + (amount(row.quantity) ?? 0), 0) : null,
    partial: partial || !available || sum.missing > 0 }
}

/** One normalized sales ledger feeds every TV scene. Invoices never become sales. */
export function buildTvData({ sales = {}, plans = [], directory = {}, plansError = false, directoryError = false, salesError = false,
  year, month, today = brazilDate(), metric = 'gross', paceScope = 'overall', paceScopeId = '' } = {}) {
  const bounds = monthBounds(year, month)
  const key = bounds.start.slice(0, 7)
  const selectedMetric = Object.hasOwn(PACE_METRICS, metric) ? metric : 'gross'
  const info = PACE_METRICS[selectedMetric]
  const observedEnd = today < bounds.start ? null : today < bounds.end ? today : bounds.end
  const inPeriod = row => { const date = dateForRecord(row); return observedEnd !== null && (!date || (date >= bounds.start && date <= observedEnd)) }
  const normalized = (sales.records || []).filter(isNewSale).filter(inPeriod)
    .map(row => ({ ...row, family: row.family || productFamily(row.product), sellerId: hasIdentity(row.sellerId) ? row.sellerId : null }))
  // A successful Asaas account statement does not establish new-sale
  // availability, including for gross/count metrics in the pace helper.
  const sources = (sales.sources || []).map(source => source.salesAvailable === false ? { ...source, status: 'unavailable' }
    : source.status === 'stale' || (salesError && source.status === 'ready') ? { ...source, status: 'partial' } : source)
  const goalData = prepareGoalData({ ...sales, records: normalized, sources }, directory, !directoryError)
  const selectedRecords = selectedMetric === 'cash' ? goalData.cashRecords : goalData.records
  const selectedSources = selectedMetric === 'cash' ? goalData.cashSources : goalData.sources
  const usablePlans = (Array.isArray(plans) ? plans : []).filter(plan => plan.metric === selectedMetric)
  const planFor = (scope, scopeId = '') => usablePlans.find(plan => { const target = goalScope(plan); return target.scope === scope && target.scopeId === scopeId }) || null
  const calculate = (scope, scopeId = '', chosenMetric = selectedMetric, plan = planFor(scope, scopeId)) => calculateGoalPace({
    ...goalData, year, month, today, plan: plan && chosenMetric === selectedMetric ? plan : { scope, scopeId, metric: chosenMetric },
  })
  const overallPlan = planFor('overall')
  const overview = calculate('overall')
  const selectedScope = ['overall', 'team', 'product', 'individual'].includes(paceScope) ? paceScope : 'overall'
  const selectedScopeId = selectedScope === 'overall' ? '' : paceScopeId
  const pacePlan = planFor(selectedScope, selectedScopeId)
  const pace = calculate(selectedScope, selectedScopeId)
  const gross = calculate('overall', '', 'gross', null)
  const cash = calculate('overall', '', 'cash', null)
  const count = calculate('overall', '', 'count', null)
  const revenue = buildRevenueBreakdown(goalData.records, sources)
  const attributionAvailable = sales.operationsStatus !== 'unavailable'
  const available = selectedSources.some(source => source.kind === 'sale' && sourceHasSales(source)
    && (source.id !== 'manual' || selectedRecords.some(row => row.isManual)))
  const sourcePartial = !overview.definitive || !attributionAvailable
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const teams = new Map((directory.teams || []).map(team => [team.id, team]))
  const paceName = selectedScope === 'overall' ? 'Meta geral'
    : (selectedScope === 'team' ? teams.get(selectedScopeId)?.name : selectedScope === 'individual' ? people.get(selectedScopeId)?.name : selectedScopeId)
      || pacePlan?.scopeName || 'Selecione um escopo'
  const scopeGoals = scope => usablePlans.filter(plan => goalScope(plan).scope === scope).map(plan => {
    const id = goalScope(plan).scopeId
    const catalogName = scope === 'team' ? teams.get(id)?.name : scope === 'individual' ? people.get(id)?.name : id
    return { id, name: catalogName || goalScopeName(plan), plan, pace: calculate(scope, id, selectedMetric, plan) }
  }).sort((a, b) => (b.pace.attainment ?? -Infinity) - (a.pace.attainment ?? -Infinity) || a.name.localeCompare(b.name, 'pt-BR'))
  const ranking = (dimension, scope) => {
    const ids = [...new Set(selectedRecords.map(row => row[dimension]).filter(value => hasIdentity(value) && value !== 'Não informado'))]
    return ids.map(id => {
      const rows = selectedRecords.filter(row => row[dimension] === id)
      const pace = calculate(scope, id)
      const summary = subtotal(rows, info.field, available, sourcePartial)
      const name = scope === 'individual' ? people.get(id)?.name || rows.find(row => row.sellerName)?.sellerName || planFor(scope, id)?.scopeName || 'Vendedor identificado' : id
      return { id, name, value: pace.actual, count: summary.count, partial: summary.partial || !pace.definitive,
        goal: planFor(scope, id), pace }
    }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  }
  const unassigned = Object.fromEntries([['seller', 'sellerId'], ['team', 'teamId'], ['product', 'family']].map(([name, dimension]) => [name,
    subtotal(selectedRecords.filter(row => !hasIdentity(row[dimension]) || row[dimension] === 'Não informado'), info.field,
      available && (name !== 'team' || !directoryError), sourcePartial),
  ]))
  const payments = Object.entries(PAYMENT_NAMES).map(([id, name]) => ({ id, name,
    ...subtotal(selectedRecords.filter(row => revenuePaymentGroup(row.payment) === id), info.field, available, sourcePartial),
  }))
  const inSelectedMonth = today.slice(0, 7) === key
  const dailyRecords = goalData.records.filter(row => dateForRecord(row) === today)
  const dailyCashRecords = goalData.cashRecords.filter(row => dateForRecord({ date: row.cashDate }) === today)
  const dailySources = sources.map(source => {
    if (!Array.isArray(source.snapshots)) return source
    const snapshots = source.snapshots.filter(snapshot => snapshot.startDate <= today && snapshot.endDate >= today)
    const ready = snapshots.some(snapshot => ['ready', 'stale'].includes(snapshot.status) && snapshot.salesAvailable !== false)
    return { ...source, status: ready ? snapshots.every(snapshot => snapshot.status === 'ready') ? source.status : 'partial' : 'unavailable', salesAvailable: ready }
  })
  const dailyRevenue = buildRevenueBreakdown(dailyRecords, dailySources)
  const dailyGoalData = { ...goalData, records: dailyRecords, cashRecords: dailyCashRecords, sources: dailySources,
    cashSources: goalData.cashSources.map(source => ({ ...source, status: dailySources.find(item => item.id === source.id)?.status === 'unavailable' ? 'unavailable' : source.status })) }
  const dailyPace = key => calculateGoalPace({ ...dailyGoalData, year, month, today, plan: { scope: 'overall', metric: key } })
  const dayMetric = inSelectedMonth ? dailyPace(selectedMetric) : null
  const hourly = hourlySales((selectedMetric === 'cash' ? dailyCashRecords : dailyRecords).map(row => ({ ...row, revenue: row[info.field] })))
  if (!inSelectedMonth || !dayMetric?.available) for (const hour of hourly.hours) { hour.value = null; hour.count = null }
  return { month: key, year: Number(year), monthNumber: Number(month), today, metric: selectedMetric, metricLabel: info.label, unit: info.unit,
    overview, pace, overallPlan, pacePlan, paceName,
    directory: { teams: [...teams.values()].map(({ id, name, active }) => ({ id, name, active })),
      individuals: [...people.values()].map(({ id, name, teamId, active }) => ({ id, name, teamId, active })) },
    teamGoals: scopeGoals('team'), productGoals: scopeGoals('product'), individualGoals: scopeGoals('individual'),
    sellers: ranking('sellerId', 'individual'), products: ranking('family', 'product'),
    totals: { gross: gross.actual, cash: cash.actual, count: count.actual, revenue: revenue.revenue.value, partial: !gross.definitive || !cash.definitive || !count.definitive },
    daily: { date: today, inSelectedMonth, value: dayMetric?.actual ?? null,
      gross: inSelectedMonth ? dailyPace('gross').actual : null, cash: inSelectedMonth ? dailyPace('cash').actual : null,
      count: inSelectedMonth ? dailyPace('count').actual : null, revenue: inSelectedMonth ? dailyRevenue.revenue.value : null,
      partial: !dayMetric?.definitive, hours: hourly.hours, unknownHourCount: hourly.unknown },
    payments, coverage: selectedSources.filter(source => source.kind === 'sale').map(source => ({ id: source.id, name: source.label || source.id,
      status: source.salesAvailable === false ? 'unavailable' : source.status,
      label: STATUS_NAMES[source.salesAvailable === false ? 'unavailable' : source.status] || 'Indisponível' })),
    unassigned, plansError: Boolean(plansError), directoryError: Boolean(directoryError), salesError: Boolean(salesError), attributionAvailable, cache: sales.cache || null }
}
