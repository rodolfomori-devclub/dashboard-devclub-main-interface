import { prepareGoalData } from '../../utils/goalData.js'
import { brazilDate, calculateGoalPace, dateForRecord, monthBounds, PACE_METRICS } from '../../utils/goalPace.js'
import { goalScope, goalScopeName, isRankingParticipant } from '../../utils/goalScopes.js'
import { salesPaymentLabel } from '../../utils/platformCash.js'
import { buildRevenueBreakdown, revenuePaymentGroup } from '../../utils/revenueBreakdown.js'
import { amount, hourlySales, productFamily, sumAmount } from '../../utils/salesData.js'
import { sourceHasSales } from '../../utils/sourceAvailability.js'
import { buildTvCelebrations } from './tvCelebrations.js'

const PAYMENT_NAMES = { card: 'Cartão', boleto: 'Boleto', pix: 'Pix', other: 'Outros', unknown: 'Não informado' }
const STATUS_NAMES = { ready: 'Disponível', partial: 'Parcial', stale: 'Último dado disponível', unavailable: 'Indisponível', not_requested: 'Não consultado' }
const hasIdentity = value => typeof value === 'string' && Boolean(value.trim())
const isNewSale = row => row.kind === 'sale' && !row.isReceipt && !(row.isManual && (row.linkedExternalId || row.original?.linkedExternalId))
const tvPaymentGroup = row => revenuePaymentGroup(salesPaymentLabel(row))

/** Resolve the television calendar in Brasília, including unattended midnight rollover. */
export function resolveTvPeriod(selectedMonth = 'current', now = new Date()) {
  const today = brazilDate(now)
  const candidate = /^\d{4}-\d{2}$/.test(selectedMonth || '') ? selectedMonth : today.slice(0, 7)
  let bounds, year = Number(candidate.slice(0, 4)), month = Number(candidate.slice(5, 7))
  try { bounds = monthBounds(year, month) } catch { year = Number(today.slice(0, 4)); month = Number(today.slice(5, 7)); bounds = monthBounds(year, month) }
  return { ...bounds, year, month, key: bounds.start.slice(0, 7), today, future: today < bounds.start, observedEnd: today < bounds.start ? null : today < bounds.end ? today : bounds.end }
}

/** Calendar week to date, Monday through the current Brasília date. */
export function resolveTvWeek(today = brazilDate()) {
  const cursor = new Date(`${today}T12:00:00Z`)
  const elapsed = (cursor.getUTCDay() + 6) % 7
  cursor.setUTCDate(cursor.getUTCDate() - elapsed)
  const startDate = cursor.toISOString().slice(0, 10)
  const dates = Array.from({ length: elapsed + 1 }, (_, index) => new Date(cursor.getTime() + index * 86400000).toISOString().slice(0, 10))
  return { startDate, endDate: today, dates }
}

export function tvWeekNeedsSeparateSales(period) {
  const week = resolveTvWeek(period.today)
  return period.future || week.startDate < period.start || week.endDate > period.observedEnd
}

// A missing day must not turn into a confirmed zero; a failed snapshot outside
// the week must not make an otherwise complete weekly result unavailable.
function rangeSources(sources, dates, failed = false) {
  return sources.map(source => {
    let status = source.salesAvailable === false ? 'unavailable' : source.status
    let salesAvailable = source.salesAvailable
    if (Array.isArray(source.snapshots)) {
      const snapshots = source.snapshots.filter(snapshot => snapshot.startDate <= dates.at(-1) && snapshot.endDate >= dates[0])
      const usable = snapshot => ['ready', 'stale'].includes(snapshot.status) && snapshot.salesAvailable !== false
      salesAvailable = snapshots.some(usable)
      const complete = dates.every(date => snapshots.some(snapshot => usable(snapshot) && snapshot.status === 'ready'
        && snapshot.complete !== false && snapshot.startDate <= date && snapshot.endDate >= date))
      status = !salesAvailable ? 'unavailable' : complete ? 'ready' : 'partial'
    }
    if (status === 'stale' || (failed && status === 'ready')) status = 'partial'
    return { ...source, status, salesAvailable }
  })
}

function buildWeeklyData({ sales, today, metric, directory, directoryError, salesError }) {
  const week = resolveTvWeek(today)
  const inWeek = row => { const date = dateForRecord(row); return date && date >= week.startDate && date <= today }
  const candidates = (sales.records || []).filter(isNewSale)
  const unknownDates = candidates.some(row => !dateForRecord(row))
  const sources = rangeSources(sales.sources || [], week.dates, salesError)
  const data = prepareGoalData({ ...sales, sources, records: candidates.filter(inWeek)
    .map(row => ({ ...row, family: row.family || productFamily(row.product), sellerId: hasIdentity(row.sellerId) ? row.sellerId : null })) }, directory, !directoryError)
  const cashRecords = data.cashRecords.filter(row => inWeek({ date: row.cashDate }))
  const attributionAvailable = Array.isArray(sales.records) && sales.operationsStatus !== 'unavailable'
    && sales.ledger?.attributionMappingsStatus !== 'unavailable' && !salesError
  const summarize = (predicate = () => true, dates = week.dates, scopeAvailable = true) => {
    const selectedSources = rangeSources(data.sources, dates, salesError)
    const selectedCashSources = data.cashSources.map(source => ({ ...source,
      status: source.status === 'unavailable' ? 'unavailable' : selectedSources.find(item => item.id === source.id)?.status || source.status }))
    const inDates = row => dates.includes(dateForRecord(row))
    const datedRecords = data.records.filter(inDates)
    const datedCashRecords = cashRecords.filter(row => inDates({ date: row.cashDate }))
    const records = datedRecords.filter(predicate)
    const cashRows = datedCashRecords.filter(predicate)
    const total = (rows, field, sourceList, availableRows = datedRecords) => {
      const relevant = sourceList.filter(source => source.kind === 'sale')
      const available = scopeAvailable && relevant.some(source => sourceHasSales(source) && (source.id !== 'manual' || availableRows.some(row => row.isManual)))
      return subtotal(rows, field, available, unknownDates || !attributionAvailable || relevant.some(source => source.status !== 'ready'))
    }
    const gross = total(records, 'gross', selectedSources), cash = total(cashRows, 'received', selectedCashSources, datedCashRecords)
    const count = total(records, 'quantity', selectedSources)
    const selected = metric === 'cash' ? cash : metric === 'count' ? count : gross
    return { ...selected, count: count.value, gross: gross.value, cash: cash.value, grossPartial: gross.partial, cashPartial: cash.partial }
  }
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const ids = [...new Set(data.records.filter(isRankingParticipant).map(row => row.sellerId)
    .filter(value => hasIdentity(value) && value !== 'Não informado'))]
  const sellers = directoryError ? [] : ids.map(id => ({ id,
    name: people.get(id)?.name || data.records.find(row => row.sellerId === id && row.sellerName)?.sellerName || 'Vendedor identificado',
    ...summarize(row => row.sellerId === id && isRankingParticipant(row)),
  })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  const total = summarize()
  return { startDate: week.startDate, endDate: today, ...total, attributionAvailable,
    days: week.dates.map(date => ({ date, label: `${date.slice(8)}/${date.slice(5, 7)}`, ...summarize(() => true, [date]) })),
    payments: Object.entries(PAYMENT_NAMES).map(([id, name]) => ({ id, name, ...summarize(row => tvPaymentGroup(row) === id) })),
    sellers, unassignedSeller: summarize(row => isRankingParticipant(row) && (!hasIdentity(row.sellerId) || row.sellerId === 'Não informado'), week.dates, !directoryError) }
}

function subtotal(rows, field, available, partial = false) {
  const sum = sumAmount(rows, field)
  return { value: !available || (rows.length > 0 && sum.known === 0) ? null : sum.value,
    count: available ? rows.reduce((total, row) => total + (amount(row.quantity) ?? 0), 0) : null,
    partial: partial || !available || sum.missing > 0 }
}

/** One normalized sales ledger feeds every TV scene. Invoices never become sales. */
export function buildTvData({ sales = {}, weeklySales, weeklySalesError = false, plans = [], directory = {}, plansError = false, directoryError = false, salesError = false,
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
  const financialSummary = (grossPace, cashPace) => ({ gross: grossPace.actual, cash: cashPace.actual,
    grossPartial: !grossPace.definitive, cashPartial: !cashPace.definitive })
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
  const scopeFinancials = (scope, scopeId = '') => financialSummary(
    calculate(scope, scopeId, 'gross', null), calculate(scope, scopeId, 'cash', null))
  Object.assign(overview, financialSummary(gross, cash))
  Object.assign(pace, selectedScope === 'overall' ? financialSummary(gross, cash) : scopeFinancials(selectedScope, selectedScopeId))
  const revenue = buildRevenueBreakdown(goalData.records, sources)
  const attributionAvailable = sales.operationsStatus !== 'unavailable' && sales.ledger?.attributionMappingsStatus !== 'unavailable'
  const available = selectedSources.some(source => source.kind === 'sale' && sourceHasSales(source)
    && (source.id !== 'manual' || selectedRecords.some(row => row.isManual)))
  const sourcePartial = !overview.definitive || !attributionAvailable
  const metricAvailable = (rows, metricSources) => metricSources.some(source => source.kind === 'sale' && sourceHasSales(source)
    && (source.id !== 'manual' || rows.some(row => row.isManual)))
  const observedCashRecords = goalData.cashRecords.filter(row => {
    const date = dateForRecord({ date: row.cashDate })
    return observedEnd !== null && (!date || (date >= bounds.start && date <= observedEnd))
  })
  const grossAvailable = metricAvailable(goalData.records, goalData.sources)
  const cashAvailable = metricAvailable(observedCashRecords, goalData.cashSources)
  const financialSubtotal = (predicate, scopeAvailable = true) => {
    const grossTotal = subtotal(goalData.records.filter(predicate), 'gross', grossAvailable && scopeAvailable, !gross.definitive || !attributionAvailable)
    const cashTotal = subtotal(observedCashRecords.filter(predicate), 'received', cashAvailable && scopeAvailable, !cash.definitive || !attributionAvailable)
    return { gross: grossTotal.value, cash: cashTotal.value, grossPartial: grossTotal.partial, cashPartial: cashTotal.partial }
  }
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const teams = new Map((directory.teams || []).map(team => [team.id, team]))
  const paceName = selectedScope === 'overall' ? 'Meta geral'
    : (selectedScope === 'team' ? teams.get(selectedScopeId)?.name : selectedScope === 'individual' ? people.get(selectedScopeId)?.name : selectedScopeId)
      || pacePlan?.scopeName || 'Selecione um escopo'
  const scopeGoals = scope => usablePlans.filter(plan => goalScope(plan).scope === scope && (scope !== 'individual' || (!directoryError && isRankingParticipant(people.get(goalScope(plan).scopeId))))).map(plan => {
    const id = goalScope(plan).scopeId
    const catalogName = scope === 'team' ? teams.get(id)?.name : scope === 'individual' ? people.get(id)?.name : id
    return { id, name: catalogName || goalScopeName(plan), plan, pace: calculate(scope, id, selectedMetric, plan), ...scopeFinancials(scope, id) }
  }).sort((a, b) => (b.pace.attainment ?? -Infinity) - (a.pace.attainment ?? -Infinity) || a.name.localeCompare(b.name, 'pt-BR'))
  const ranking = (dimension, scope) => {
    if (scope === 'individual' && directoryError) return []
    const rankingRecords = scope === 'individual' ? selectedRecords.filter(isRankingParticipant) : selectedRecords
    // A missing cash ledger must not hide a known gross sale from the ranking.
    const identityRecords = scope === 'individual' ? goalData.records.filter(isRankingParticipant) : goalData.records
    const ids = [...new Set([...identityRecords, ...rankingRecords].map(row => row[dimension]).filter(value => hasIdentity(value) && value !== 'Não informado'))]
    return ids.map(id => {
      const rows = rankingRecords.filter(row => row[dimension] === id)
      const pace = calculate(scope, id)
      const summary = subtotal(rows, info.field, available, sourcePartial)
      const name = scope === 'individual' ? people.get(id)?.name || rows.find(row => row.sellerName)?.sellerName || planFor(scope, id)?.scopeName || 'Vendedor identificado' : id
      return { id, name, value: pace.actual, count: summary.count, partial: summary.partial || !pace.definitive,
        goal: planFor(scope, id), pace, ...scopeFinancials(scope, id) }
    }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  }
  const unassigned = Object.fromEntries([['seller', 'sellerId'], ['team', 'teamId'], ['product', 'family']].map(([name, dimension]) => {
    const predicate = row => (name === 'product' || isRankingParticipant(row)) && (!hasIdentity(row[dimension]) || row[dimension] === 'Não informado')
    const scopeAvailable = name === 'product' || !directoryError
    return [name, { ...subtotal(selectedRecords.filter(predicate), info.field, available && scopeAvailable, sourcePartial),
      ...financialSubtotal(predicate, scopeAvailable) }]
  }))
  const payments = Object.entries(PAYMENT_NAMES).map(([id, name]) => ({ id, name,
    ...subtotal(selectedRecords.filter(row => tvPaymentGroup(row) === id), info.field, available, sourcePartial),
    ...financialSubtotal(row => tvPaymentGroup(row) === id),
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
  const dailyPace = (key, scope = 'overall', scopeId = '') => calculateGoalPace({ ...dailyGoalData, year, month, today, plan: { scope, scopeId, metric: key } })
  const dayMetric = inSelectedMonth ? dailyPace(selectedMetric) : null
  const dailyGross = inSelectedMonth ? dailyPace('gross') : null
  const dailyCash = inSelectedMonth ? dailyPace('cash') : null
  const dailySelectedRecords = selectedMetric === 'cash' ? dailyCashRecords : dailyRecords
  const dailySubtotal = (predicate, scopeAvailable = true) => {
    const rows = dailySelectedRecords.filter(predicate)
    const summary = subtotal(rows, info.field, Boolean(dayMetric?.available && scopeAvailable), !dayMetric?.definitive || !attributionAvailable)
    const grossTotal = subtotal(dailyRecords.filter(predicate), 'gross', Boolean(dailyGross?.available && scopeAvailable), !dailyGross?.definitive || !attributionAvailable)
    const cashTotal = subtotal(dailyCashRecords.filter(predicate), 'received', Boolean(dailyCash?.available && scopeAvailable), !dailyCash?.definitive || !attributionAvailable)
    return { ...summary, gross: grossTotal.value, cash: cashTotal.value,
      grossPartial: grossTotal.partial, cashPartial: cashTotal.partial }
  }
  const dailyPayments = Object.entries(PAYMENT_NAMES).map(([id, name]) => ({ id, name,
    ...dailySubtotal(row => tvPaymentGroup(row) === id) }))
  const dailySellerIds = [...new Set([...dailyRecords, ...dailySelectedRecords].filter(isRankingParticipant)
    .map(row => row.sellerId).filter(value => hasIdentity(value) && value !== 'Não informado'))]
  const dailySellers = !inSelectedMonth || directoryError ? [] : dailySellerIds.map(id => {
    const rows = dailyRecords.filter(row => row.sellerId === id)
    const pace = dailyPace(selectedMetric, 'individual', id)
    return { id, name: people.get(id)?.name || rows.find(row => row.sellerName)?.sellerName || 'Vendedor identificado',
      ...dailySubtotal(row => row.sellerId === id && isRankingParticipant(row)), value: pace.actual,
      partial: !pace.definitive || !attributionAvailable }
  }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  const dailyUnassignedSeller = dailySubtotal(row => isRankingParticipant(row) && (!hasIdentity(row.sellerId) || row.sellerId === 'Não informado'), !directoryError)
  const grossHours = hourlySales(dailyRecords, { valueField: 'gross' })
  const cashHours = hourlySales(dailyCashRecords.map(row => ({ ...row, date: row.cashDateBasis === 'sale_date' ? row.date : row.cashDate || row.date })), { valueField: 'received' })
  const hourly = hourlySales(selectedMetric === 'cash' ? dailyCashRecords : dailyRecords, { valueField: info.field })
  for (const [index, hour] of hourly.hours.entries()) {
    if (!inSelectedMonth || !dayMetric?.available) { hour.value = null; hour.count = null }
    Object.assign(hour, { gross: dailyGross?.available ? grossHours.hours[index].value : null,
      cash: dailyCash?.available ? cashHours.hours[index].value : null,
      grossPartial: !dailyGross?.definitive || grossHours.hours[index].missingAmounts > 0,
      cashPartial: !dailyCash?.definitive || cashHours.hours[index].missingAmounts > 0 })
  }
  return { month: key, year: Number(year), monthNumber: Number(month), today, metric: selectedMetric, metricLabel: info.label, unit: info.unit,
    celebrations: buildTvCelebrations({ records: goalData.records, sourceRecords: sales.records || [], sources,
      directory, directoryError, salesError, operationsStatus: sales.operationsStatus, today, inSelectedMonth,
      observedAt: sales.cache?.generatedAt || sales.fetchedAt }),
    overview, pace, overallPlan, pacePlan, paceName,
    directory: { teams: [...teams.values()].map(({ id, name, active }) => ({ id, name, active })),
      individuals: [...people.values()].filter(isRankingParticipant).map(({ id, name, teamId, active }) => ({ id, name, teamId, active })) },
    teamGoals: scopeGoals('team'), productGoals: scopeGoals('product'), individualGoals: scopeGoals('individual'),
    sellers: ranking('sellerId', 'individual'), products: ranking('family', 'product'),
    totals: { ...financialSummary(gross, cash), count: count.actual, revenue: revenue.revenue.value, partial: !gross.definitive || !cash.definitive || !count.definitive },
    daily: { date: today, inSelectedMonth, value: dayMetric?.actual ?? null,
      gross: dailyGross?.actual ?? null, cash: dailyCash?.actual ?? null,
      grossPartial: !dailyGross?.definitive, cashPartial: !dailyCash?.definitive,
      count: inSelectedMonth ? dailyPace('count').actual : null, revenue: inSelectedMonth ? dailyRevenue.revenue.value : null,
      partial: !dayMetric?.definitive, hours: hourly.hours, unknownHourCount: Math.max(hourly.unknown, grossHours.unknown, cashHours.unknown),
      payments: dailyPayments, sellers: dailySellers, unassignedSeller: dailyUnassignedSeller },
    weekly: buildWeeklyData({ sales: weeklySales ?? (resolveTvWeek(today).startDate >= bounds.start && today <= bounds.end ? sales : {}), today, metric: selectedMetric, directory, directoryError,
      salesError: weeklySales === undefined ? salesError : weeklySalesError }),
    payments, coverage: selectedSources.filter(source => source.kind === 'sale').map(source => ({ id: source.id, name: source.label || source.id,
      status: source.salesAvailable === false ? 'unavailable' : source.status,
      label: STATUS_NAMES[source.salesAvailable === false ? 'unavailable' : source.status] || 'Indisponível' })),
    unassigned, plansError: Boolean(plansError), directoryError: Boolean(directoryError), salesError: Boolean(salesError), attributionAvailable, cache: sales.cache || null }
}
