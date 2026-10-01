import { amount, parseSaleDate } from './salesData.js'
import { goalScope, recordMatchesGoal, recordUnallocatedForGoal } from './goalScopes.js'

export const PACE_METRICS = {
  gross: { label: 'Bruto', field: 'gross', unit: 'currency' },
  net: { label: 'Líquido', field: 'net', unit: 'currency' },
  cash: { label: 'Cash collected · caixa recebido', field: 'received', unit: 'currency' },
  operational: { label: 'Valor operacional', field: 'revenue', unit: 'currency' },
  count: { label: 'Quantidade de vendas', field: 'quantity', unit: 'count' },
}

export function brazilDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function monthBounds(year, month) {
  const y = Number(year), m = Number(month)
  if (!Number.isInteger(y) || y < 2000 || y > 2200 || !Number.isInteger(m) || m < 1 || m > 12) throw new Error('Mês inválido')
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${y}-${String(m).padStart(2, '0')}-01`, end: `${y}-${String(m).padStart(2, '0')}-${days}`, days }
}

export function dateForRecord(row) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')) return row.date
  const value = parseSaleDate(row.date)
  return value ? brazilDate(new Date(value)) : null
}

/**
 * Linear pace using the API's own monetary fields. Business days mean Monday–
 * Friday; no holiday calendar is assumed. Current day counts as elapsed.
 */
export function calculateGoalPace({ year, month, plan, records = [], sources = [], cashRecords, cashSources, directoryAvailable = true, today = brazilDate() }) {
  const bounds = monthBounds(year, month)
  const metric = PACE_METRICS[plan?.metric] || PACE_METRICS.operational
  const basis = plan?.paceBasis === 'business' ? 'business' : 'calendar'
  const target = amount(plan?.target)
  const validTarget = target !== null && target > 0
  const future = today < bounds.start
  const ended = today > bounds.end
  const lastObservedDate = future ? null : today > bounds.end ? bounds.end : today
  const isCash = plan?.metric === 'cash'
  const selectedRecords = isCash && cashRecords ? cashRecords : records
  const selectedSources = isCash && cashSources ? cashSources : sources
  const metricDate = row => dateForRecord(isCash ? { date: row.cashDate || null } : row)
  const inWindow = row => { const date = metricDate(row); return !future && (!date || (date >= bounds.start && date <= lastObservedDate)) }
  const periodRows = selectedRecords.filter((row) => row.kind === 'sale' && recordMatchesGoal(row, plan))
  const unassigned = selectedRecords.filter(row => row.kind === 'sale' && inWindow(row) && recordUnallocatedForGoal(row, plan))
  const unassignedValue = unassigned.reduce((sum, row) => sum + (amount(row[metric.field]) ?? 0), 0)
  const targetScope = goalScope(plan)
  const selectionMissing = targetScope.scope !== 'overall' && !targetScope.scopeId
  const membershipUnavailable = targetScope.scope === 'team' && !directoryAvailable
  const observedRows = periodRows.filter((row) => {
    const date = metricDate(row)
    // Preserve the requested source totals for undated records, but never
    // count a transaction dated after the current observation window.
    return !future && (!date || (date >= bounds.start && date <= lastObservedDate))
  })
  const saleSources = selectedSources.filter((source) => source.kind === 'sale')
  const available = saleSources.some((source) => ['ready', 'partial'].includes(source.status) && (source.id !== 'manual' || observedRows.some((row) => row.sourceId === 'manual')))
  const sourceIncomplete = saleSources.some((source) => source.status !== 'ready' || source.excludedReceipts > 0) || !available || membershipUnavailable || selectionMissing
  const missing = observedRows.filter((row) => amount(row[metric.field]) === null)
  const known = observedRows.filter((row) => amount(row[metric.field]) !== null)
  const actual = !available || membershipUnavailable || selectionMissing || (observedRows.length > 0 && !known.length) ? null : known.reduce((sum, row) => sum + amount(row[metric.field]), 0)
  const dailyValues = new Map()
  let unallocated = 0
  let unallocatedRecords = 0
  for (const row of known) {
    const date = metricDate(row)
    if (!date || date < bounds.start || date > bounds.end) { unallocated += amount(row[metric.field]); unallocatedRecords++; continue }
    dailyValues.set(date, (dailyValues.get(date) || 0) + amount(row[metric.field]))
  }
  const calendar = Array.from({ length: bounds.days }, (_, index) => {
    const date = `${bounds.start.slice(0, 8)}${String(index + 1).padStart(2, '0')}`
    const weekDay = new Date(`${date}T12:00:00Z`).getUTCDay()
    return { date, eligible: basis === 'calendar' || (weekDay !== 0 && weekDay !== 6) }
  })
  const totalDays = calendar.filter((day) => day.eligible).length
  const elapsedDays = calendar.filter((day) => day.eligible && lastObservedDate && day.date <= lastObservedDate).length
  const remainingDays = totalDays - elapsedDays
  let daysSoFar = 0, cumulative = 0
  const rows = calendar.map((day) => {
    if (day.eligible) daysSoFar++
    const observed = lastObservedDate !== null && day.date <= lastObservedDate
    const dailyActual = observed && actual !== null ? dailyValues.get(day.date) || 0 : null
    if (dailyActual !== null) cumulative += dailyActual
    return {
      ...day, observed, label: day.date.slice(8), dailyActual,
      dailyTarget: validTarget ? day.eligible ? target / totalDays : 0 : null,
      planned: validTarget ? target * daysSoFar / totalDays : null,
      actual: observed && actual !== null ? cumulative : null,
    }
  })
  const expected = validTarget ? target * elapsedDays / totalDays : null
  const delta = actual !== null && expected !== null && !future ? actual - expected : null
  const pacePercent = actual !== null && expected > 0 ? actual / expected * 100 : null
  const projection = actual !== null && elapsedDays > 0 ? ended ? actual : actual / elapsedDays * totalDays : null
  const remaining = actual !== null && validTarget ? Math.max(0, target - actual) : null
  const requiredPerDay = remaining !== null && remainingDays > 0 ? remaining / remainingDays : null
  const definitive = !sourceIncomplete && missing.length === 0 && actual !== null && unassigned.length === 0 && unallocatedRecords === 0
  return { ...bounds, metric, basis, target, validTarget, future, ended, lastObservedDate, totalDays, elapsedDays, remainingDays, available, sourceIncomplete, missingRecords: missing.length, unassignedRecords: unassigned.length, unassignedValue, membershipUnavailable, actual, expected, delta, pacePercent, projection, remaining, requiredPerDay, definitive, unallocated, unallocatedRecords, rows,
    attainment: validTarget && actual !== null ? actual / target * 100 : null,
    superTarget: amount(plan?.superTarget), ultraTarget: amount(plan?.ultraTarget),
  }
}
