import { sourceHasSales } from './sourceAvailability.js'
import { filterSales, groupSales, hourlySales, summarizeSales, UNKNOWN, UTM_FIELDS } from './salesData.js'
import { enrichPeriodRecord, localDay, periodSeries, summarizePeriod } from './periodData.js'

const DAY = 86_400_000
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

export function comparisonRangeLength(range) {
  if (!range || !validDate(range.startDate) || !validDate(range.endDate) || range.startDate > range.endDate) throw new Error('Informe datas válidas, com o início anterior ou igual ao fim.')
  return Math.round((Date.parse(range.endDate) - Date.parse(range.startDate)) / DAY) + 1
}

export function validateComparisonRanges(a, b) {
  const lengthA = comparisonRangeLength(a)
  const lengthB = comparisonRangeLength(b)
  if (lengthA > 366 || lengthB > 366) throw new Error('Cada período pode ter até 366 dias.')
  if (lengthA !== lengthB) throw new Error(`Escolha períodos com a mesma duração. A tem ${lengthA} dias e B tem ${lengthB} dias.`)
  return lengthA
}

function sourceHealth(sources, allowEmptyManual = false) {
  return { available: sources.some(source => sourceHasSales(source) && (source.id !== 'manual' || allowEmptyManual || source.rows.length > 0)), complete: sources.length > 0 && sources.every(source => source.status === 'ready') }
}

export function comparisonMetric(value, health, missing = false) {
  const available = health.available && typeof value === 'number' && Number.isFinite(value)
  return { value: available ? value : null, partial: available && (!health.complete || missing) }
}

function moneyMetric(amount, health, allocationMissing = false) {
  return comparisonMetric(amount.known || !amount.missing ? amount.value : null, health, amount.missing > 0 || allocationMissing)
}

export function compareMetrics(a, b) {
  if (a?.value == null || b?.value == null) return { absolute: null, percent: null, reason: 'unavailable' }
  if (a.partial || b.partial) return { absolute: null, percent: null, reason: 'partial' }
  const absolute = a.value - b.value
  // An absolute change from zero is meaningful; its percentage is undefined.
  return { absolute, percent: b.value === 0 ? null : absolute / Math.abs(b.value) * 100, reason: b.value === 0 ? 'zero-base' : null }
}

export function buildComparisonSnapshot(result, filters, range) {
  const allRecords = (result.records || []).map(enrichPeriodRecord)
  const records = filterSales(allRecords, filters)
  const sources = (result.sources || []).filter(source => !filters.platform || source.platform === filters.platform || source.id === 'manual').map(source => ({ ...source, rows: records.filter(row => row.sourceId === source.id) }))
  const summary = summarizePeriod(records)
  const saleHealth = sourceHealth(sources.filter(source => source.kind === 'sale'))
  const refundHealth = sourceHealth(sources.filter(source => source.kind === 'refund'))
  const fineFilter = Object.entries(filters).some(([key, value]) => key !== 'platform' && value)
  const unclassifiedForFilter = row => Object.entries(filters).some(([key, selected]) => {
    if (!selected || selected === UNKNOWN || key === 'platform') return false
    const value = UTM_FIELDS.includes(key) ? row.utm[key] : row[key]
    return !value || value === 'Não informado'
  })
  const omittedAggregates = allRecords.filter(row => (row.isAggregate || unclassifiedForFilter(row)) && (!filters.platform || row.platform === filters.platform) && !records.includes(row))
  const allocationMissing = fineFilter && omittedAggregates.some(row => row.kind === 'sale')
  const refundAllocationMissing = fineFilter && omittedAggregates.some(row => row.kind === 'refund')
  const days = comparisonRangeLength(range)
  const total = summary.total
  const count = comparisonMetric(total.count, saleHealth, allocationMissing)
  const revenue = moneyMetric(total.revenue, saleHealth, allocationMissing)
  const subgroup = (platforms, group, key = 'revenue') => moneyMetric(group[key], sourceHealth(sources.filter(source => source.kind === 'sale' && (platforms.includes(source.platform) || source.id === 'manual'))), allocationMissing)
  const metrics = {
    count, revenue,
    ...Object.fromEntries(['gross', 'net', 'received', 'fees', 'affiliate', 'pending', 'listPrice'].map(key => [key, moneyMetric(total[key], saleHealth, allocationMissing)])),
    ticket: comparisonMetric(count.value > 0 && revenue.value !== null ? revenue.value / count.value : null, saleHealth, revenue.partial || count.partial),
    digital: subgroup(['Guru', 'Hotmart'], summary.digital),
    digitalCount: comparisonMetric(summary.digital.count, sourceHealth(sources.filter(source => source.kind === 'sale' && (['Guru', 'Hotmart'].includes(source.platform) || source.id === 'manual'))), allocationMissing),
    boleto: subgroup(['TMB', 'Asaas', 'Boletex'], summary.boleto),
    boletoCount: comparisonMetric(summary.boleto.count, sourceHealth(sources.filter(source => source.kind === 'sale' && (['TMB', 'Asaas', 'Boletex'].includes(source.platform) || source.id === 'manual'))), allocationMissing),
    commercial: subgroup(['Guru'], summary.commercial),
    commercialCount: comparisonMetric(summary.commercial.count, sourceHealth(sources.filter(source => source.kind === 'sale' && (source.platform === 'Guru' || source.id === 'manual'))), allocationMissing),
    refund: moneyMetric(summary.refund.revenue, refundHealth, refundAllocationMissing),
    refundCount: comparisonMetric(summary.refund.count, refundHealth, refundAllocationMissing),
    dailyRevenue: { ...revenue, value: revenue.value === null ? null : revenue.value / days },
    dailyCount: { ...count, value: count.value === null ? null : count.value / days },
  }
  metrics.dailyBoleto = { ...metrics.boleto, value: metrics.boleto.value === null ? null : metrics.boleto.value / days }
  metrics.dailyBoletoCount = { ...metrics.boletoCount, value: metrics.boletoCount.value === null ? null : metrics.boletoCount.value / days }
  const sourceRows = sources.map(source => {
    const sourceRecords = records.filter(row => row.sourceId === source.id)
    const sourceSummary = summarizeSales(sourceRecords)
    const health = sourceHealth([source], true)
    const omitted = fineFilter && omittedAggregates.some(row => row.sourceId === source.id)
    return { ...source, count: comparisonMetric(sourceSummary.count, health, omitted), revenue: moneyMetric(sourceSummary.revenue, health, omitted) }
  })
  return { records, sales: summary.sales, summary, sources: sourceRows, saleHealth, metrics, range, days, allocationMissing, omittedAggregates: omittedAggregates.length, fetchedAt: result.fetchedAt }
}

export function comparisonGroups(a, b, dimension = 'product') {
  const first = new Map(groupSales(a.sales, dimension).map(row => [row.name, row]))
  const second = new Map(groupSales(b.sales, dimension).map(row => [row.name, row]))
  const empty = summarizeSales([])
  const metric = (snapshot, group) => {
    const missingDistribution = snapshot.sales.some(row => row.isAggregate || !row[dimension] || row[dimension] === 'Não informado') || snapshot.allocationMissing
    return { count: comparisonMetric(group.count, snapshot.saleHealth, missingDistribution), revenue: moneyMetric(group.revenue, snapshot.saleHealth, missingDistribution) }
  }
  return [...new Set([...first.keys(), ...second.keys()])].map(name => {
    const aa = metric(a, first.get(name) || empty)
    const bb = metric(b, second.get(name) || empty)
    return { name, a: aa, b: bb, revenueDelta: compareMetrics(aa.revenue, bb.revenue), countDelta: compareMetrics(aa.count, bb.count) }
  }).sort((x, y) => Math.max(y.a.revenue.value || 0, y.b.revenue.value || 0) - Math.max(x.a.revenue.value || 0, x.b.revenue.value || 0))
}

function axisRows(snapshot, hourly) {
  if (hourly) {
    const chart = hourlySales(snapshot.sales)
    return { rows: chart.hours.map(row => ({ label: row.hour, revenue: row.value, count: row.count })), omitted: chart.unknownRecords }
  }
  const chart = periodSeries(snapshot.sales, snapshot.range.startDate, snapshot.range.endDate)
  const missingAmountDays = new Set(snapshot.sales.filter(row => row.revenue == null).map(row => localDay(row.date)))
  return {
    rows: chart.rows.map((row, index) => ({ ...row, label: `Dia ${index + 1}`, revenue: missingAmountDays.has(row.date) ? null : row.revenue })),
    omitted: snapshot.sales.filter(row => !localDay(row.date) || localDay(row.date) < snapshot.range.startDate || localDay(row.date) > snapshot.range.endDate).length,
  }
}

export function comparisonSeries(a, b, { hourly = false } = {}) {
  const first = axisRows(a, hourly)
  const second = axisRows(b, hourly)
  return {
    rows: first.rows.map((row, index) => ({
      label: row.label, aDate: row.date, bDate: second.rows[index]?.date,
      aRevenue: a.saleHealth.available ? row.revenue : null,
      bRevenue: b.saleHealth.available ? second.rows[index]?.revenue ?? null : null,
      aCount: a.saleHealth.available ? row.count : null,
      bCount: b.saleHealth.available ? second.rows[index]?.count ?? null : null,
    })),
    omittedA: first.omitted, omittedB: second.omitted,
  }
}
