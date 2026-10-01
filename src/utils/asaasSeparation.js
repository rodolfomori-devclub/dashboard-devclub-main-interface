import { amount, filterSales, summarizeSales } from './salesData.js'
import { asaasCashView, sourceHasSales } from './sourceAvailability.js'

const dateKey = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
const money = value => Math.round((value + Number.EPSILON) * 100) / 100
const validOrigins = origins => origins?.schemaVersion === 1 && origins.basis === 'checkout_created_at' && Array.isArray(origins.rows)
const asaasManual = row => row.isManual && /\basaas\b/i.test(String(row.platform || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
const emptyBucket = value => ({ received: value, count: value })
const saleDay = value => {
  if (dateKey(value)) return value
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : null
}

// Keep immutable date facts across disjoint cache/month/week segments. A sale
// from the first week is still a sale of this month in the final monthly view.
export function mergeAsaasReceiptOrigins(parts = []) {
  const valid = parts.filter(validOrigins)
  return {
    schemaVersion: 1, basis: 'checkout_created_at', rows: valid.flatMap(part => part.rows),
    status: parts.length > 0 && valid.length === parts.length && valid.every(part => part.status === 'ready') ? 'ready'
      : valid.some(part => part.status !== 'unavailable' || part.rows.length) ? 'partial' : 'unavailable',
  }
}

function classifyReceipts(cash, origins, startDate, endDate) {
  const unknown = { currentPeriod: emptyBucket(null), previousPeriods: emptyBucket(null), unclassified: emptyBucket(null), status: 'unavailable' }
  if (!cash || cash.allocationMissing || amount(cash.gross) === null || amount(cash.count) === null) return unknown
  const total = money(cash.gross), count = cash.count
  const result = { currentPeriod: emptyBucket(0), previousPeriods: emptyBucket(0), unclassified: { received: total, count }, status: 'unavailable' }
  if (!dateKey(startDate) || !dateKey(endDate) || startDate > endDate || !validOrigins(origins)) return total === 0 && count === 0 ? { ...result, status: 'ready' } : result
  let matched = 0, matchedCount = 0
  for (const row of origins.rows) {
    const received = amount(row.received), quantity = amount(row.count)
    const receiptDate = dateKey(row.receiptDate), saleDate = dateKey(row.saleDate)
    // A missing/invalid link never makes a receipt an old sale. Nor does an
    // invoice issued this month prove that its contract was sold this month.
    if (received === null || received < 0 || !Number.isInteger(quantity) || quantity < 0 || !receiptDate || receiptDate < startDate || receiptDate > endDate || !saleDate || saleDate > receiptDate) continue
    const group = saleDate < startDate ? result.previousPeriods : saleDate <= endDate ? result.currentPeriod : null
    if (!group) continue
    group.received = money(group.received + received)
    group.count += quantity
    matched = money(matched + received)
    matchedCount += quantity
  }
  // Unexpected duplicates/overcoverage cannot create a negative unknown bucket.
  // Preserve the statement total as unclassified until its links are reliable.
  if (matched > total + 0.005 || matchedCount > count) return { ...result, currentPeriod: emptyBucket(0), previousPeriods: emptyBucket(0) }
  result.unclassified = { received: money(total - matched), count: count - matchedCount }
  result.status = result.unclassified.received === 0 && result.unclassified.count === 0 ? 'ready' : matchedCount || matched ? 'partial' : 'unavailable'
  return result
}

export function buildAsaasSeparation({ sources = [], records = [], startDate, endDate, filters = {} } = {}) {
  if (filters.platform && filters.platform !== 'Asaas') return null
  const source = sources.find(item => item.id === 'asaas')
  const candidates = records.filter(row => row.kind === 'sale' && !row.isReceipt && (row.sourceId === 'asaas' || asaasManual(row)))
  if (!source && !candidates.length) return null
  const seen = new Set(), seenRows = new WeakSet()
  const salesRows = filterSales(candidates, filters).filter(row => {
    // Reconciled manuals have already been removed by the shared ledger merge;
    // keep the guard when a caller supplies raw/duplicated normalized records.
    if (row.isManual && (row.original?.linkedExternalId || row.linkedExternalId)) return false
    // Native contracts already belong to the checkout query's calendar. Its
    // created_at::date may differ from a timestamp converted to Brasília;
    // re-filtering would contradict the source count and contract totals.
    const date = row.isManual ? saleDay(row.date) : null
    if (date && ((dateKey(startDate) && date < startDate) || (dateKey(endDate) && date > endDate))) return false
    if (seenRows.has(row)) return false
    seenRows.add(row)
    // Array-index IDs are display keys, not proof that two anonymous contracts
    // in different monthly snapshots are the same sale.
    const identity = row.isManual ? row.manualId || row.id : row.externalId ? `${row.sourceId}:${row.externalId}` : null
    if (!identity) return true
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
  const summary = summarizeSales(salesRows)
  const contractsAvailable = Boolean(source && sourceHasSales(source))
  const available = contractsAvailable || salesRows.length > 0
  const measure = field => !available || (!summary[field].known && summary[field].missing) ? null : summary[field].value
  const entries = salesRows.map(row => row.isManual ? null : amount(row.received))
  const knownEntries = entries.filter(value => value !== null)
  const sales = { gross: measure('gross'), count: available ? summary.count : null,
    entry: !available || (entries.length && !knownEntries.length) ? null : money(knownEntries.reduce((sum, value) => sum + value, 0)),
    available, partial: !contractsAvailable || source?.status !== 'ready' || summary.gross.missing > 0 || entries.some(value => value === null) }
  const cashView = asaasCashView(sources, filters)
  const stale = source?.cacheStatus === 'stale' || source?.snapshots?.some(snapshot => ['stale', 'loading', 'unavailable'].includes(snapshot.status))
  const cash = cashView ? { ...cashView, partial: cashView.partial || Boolean(stale) } : null
  return { sales, cash, receipts: classifyReceipts(cash, source?.cashReceiptOrigins, startDate, endDate) }
}
