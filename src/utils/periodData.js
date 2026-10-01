import { sourceHasSales } from './sourceAvailability.js'
import { summarizeSales } from './salesData.js'
import { mergeAsaasReceiptOrigins } from './asaasSeparation.js'

export function enrichPeriodRecord(row) {
  const raw = row.original || {}
  const offer = raw.offer?.name || raw.product?.offer?.name || raw.offerName || raw.trackings?.utm_campaign || raw.trackings?.utm_content || raw.trackings?.offer_code || raw.order?.offer_code || null
  return { ...row, offer, commercial: row.platform === 'Guru' && raw.trackings?.utm_source === 'comercial' }
}

export function summarizePeriod(records) {
  const sales = records.filter(row => row.kind === 'sale')
  const refunds = records.filter(row => row.kind === 'refund')
  const digital = sales.filter(row => ['Guru', 'Hotmart'].includes(row.platform))
  const boleto = sales.filter(row => ['TMB', 'Asaas', 'Boletex'].includes(row.platform))
  const commercial = sales.filter(row => row.commercial)
  const base = summarizeSales(sales)
  return { sales, refunds, total: base, digital: summarizeSales(digital), boleto: summarizeSales(boleto), commercial: summarizeSales(commercial), refund: summarizeSales(refunds), ticket: base.count && base.revenue.known ? base.revenue.value / base.count : null }
}

export function localDay(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed)
}

export function periodSeries(records, startDate, endDate, monthly = false) {
  const add = (bucket, key, value) => {
    if (value === null || value === undefined) bucket[key] = null
    else if (bucket[key] !== null) bucket[key] += value
  }
  const buckets = new Map()
  const cursor = new Date(`${startDate}T12:00:00Z`)
  const end = new Date(`${endDate}T12:00:00Z`)
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10)
    const key = monthly ? day.slice(0, 7) : day
    buckets.set(key, { date: monthly ? `${key}-01` : key, label: monthly ? cursor.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }) : `${day.slice(8)}/${day.slice(5, 7)}`, revenue: 0, count: 0, digital: 0, boleto: 0, refund: 0, affiliate: 0, commercial: 0 })
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1)
    else cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  let undated = 0
  for (const row of records) {
    const day = localDay(row.date)
    const key = monthly ? row.cohortMonth || day?.slice(0, 7) : day
    const bucket = buckets.get(key)
    if (!bucket) { undated += Math.max(0, row.quantity); continue }
    if (row.kind === 'refund') { add(bucket, 'refund', row.revenue); continue }
    add(bucket, 'revenue', row.revenue)
    bucket.count += row.quantity
    // Affiliate value is supplied by Guru; unsupported fields on other
    // platforms do not invalidate this explicitly Guru-based series.
    if ((row.platform === 'Guru' && !row.isManual) || row.affiliate != null) add(bucket, 'affiliate', row.affiliate)
    if (row.commercial) add(bucket, 'commercial', row.revenue)
    if (['Guru', 'Hotmart'].includes(row.platform)) add(bucket, 'digital', row.revenue)
    else if (['TMB', 'Asaas', 'Boletex'].includes(row.platform)) add(bucket, 'boleto', row.revenue)
  }
  return { rows: [...buckets.values()], undated }
}

export function monthRanges(startDate, endDate) {
  const ranges = []
  let cursor = startDate
  while (cursor <= endDate) {
    const [year, month] = cursor.split('-').map(Number)
    const last = new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10)
    const end = last < endDate ? last : endDate
    ranges.push({ startDate: cursor, endDate: end })
    cursor = new Date(Date.parse(`${end}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  }
  return ranges
}

export function goalProgress(value, goal, startDate, endDate, today) {
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1
  const elapsed = Math.max(0, Math.min(days, Math.round((Date.parse(today) - Date.parse(startDate)) / 86400000) + 1))
  return { actual: goal > 0 ? value / goal * 100 : null, expected: elapsed / days * 100, projected: elapsed ? value / elapsed * days : null }
}

// Each monthly query retains its own availability. A cash-only month is partial,
// not a failed request, and its receipts never become a synthetic sales record.
export function mergePeriodSources(results, annual = false) {
  const bySource = new Map()
  for (const batch of results) {
    for (const source of batch.result.sources) {
      const group = bySource.get(source.id) || { ...source, rows: [], cashReceipts: undefined, cashOriginParts: [], failures: 0, incomplete: 0, notRequested: 0, periods: 0, salesAvailable: false, cash: null }
      group.periods++
      if (source.status === 'not_requested') group.notRequested++
      if (source.status === 'unavailable') group.failures++
      if (source.status !== 'ready') group.incomplete++
      if (sourceHasSales(source)) group.salesAvailable = true
      if (source.reason) group.reason = source.reason
      if (source.id === 'asaas') group.cashOriginParts.push(source.cashReceiptOrigins)
      if (Array.isArray(source.cashReceipts)) {
        group.cashReceipts ||= []
        group.cashReceipts.push(...source.cashReceipts)
      }
      if (source.cash) {
        if (!group.cash) group.cash = { gross: 0, net: 0, fees: 0, count: 0, availablePeriods: 0, periods: 0 }
        for (const key of ['gross', 'net', 'fees', 'count']) group.cash[key] += source.cash[key]
        group.cash.availablePeriods++
      }
      const rows = batch.result.records.filter(row => row.sourceId === source.id)
      group.rows.push(...rows.map(row => enrichPeriodRecord({ ...row, cohortMonth: annual ? batch.startDate.slice(0, 7) : null, id: row.isAggregate ? `${batch.startDate}:${row.id}` : row.id })))
      bySource.set(source.id, group)
    }
  }
  return [...bySource.values()].map(({ cashOriginParts, ...source }) => ({
    ...source,
    ...(source.id === 'asaas' ? { cashReceiptOrigins: mergeAsaasReceiptOrigins(cashOriginParts) } : {}),
    cash: source.cash ? { ...source.cash, periods: source.periods } : null,
    status: source.notRequested === source.periods ? 'not_requested' : source.failures === source.periods ? 'unavailable' : source.incomplete ? 'partial' : 'ready',
  }))
}
