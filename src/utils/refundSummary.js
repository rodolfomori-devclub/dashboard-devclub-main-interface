import { isNetSalesPlatform } from './platformCash.js'
import { localDay } from './periodData.js'
import { parseSaleDate } from './salesData.js'
// Refund status and purchase price are distinct from the amount actually returned.
const PROVIDERS = [{ id: 'guru', label: 'Guru' }, { id: 'hotmart', label: 'Hotmart' }, { id: 'hubla', label: 'Hubla' }, { id: 'tmb', label: 'TMB' }, { id: 'asaas', label: 'Asaas' }]
const value = number => number !== null && number !== undefined && number !== '' && Number.isFinite(Number(number)) && Number(number) >= 0 ? Number(number) : null
const currency = input => typeof input === 'string' && /^[A-Z]{3}$/.test(input.toUpperCase()) ? input.toUpperCase() : null
const statusKey = input => String(input || '').toLowerCase().trim()

export function refundKind(status) {
  if (statusKey(status) === 'requested') return 'request'
  if (statusKey(status) === 'reported_refunded') return 'reported'
  if (['refunded', 'partially_refunded'].includes(statusKey(status))) return 'confirmed'
  if (['chargeback', 'dispute', 'in_protest'].includes(statusKey(status))) return 'dispute'
  if (['rejected', 'cancelled', 'canceled', 'cancelado'].includes(statusKey(status))) return 'cancelled'
  return 'unknown'
}

export function refundStatusLabel(status) {
  return ({ requested: 'Reembolso solicitado', reported_refunded: 'Reembolso informado no atendimento',
    refunded: 'Reembolso confirmado', partially_refunded: 'Reembolso parcial', chargeback: 'Chargeback',
    dispute: 'Em contestação', in_protest: 'Em contestação', retained: 'Revertido no atendimento',
    rejected: 'Venda rejeitada', cancelled: 'Cancelado', canceled: 'Cancelado' })[statusKey(status)] || 'Status não informado'
}

// Requests have no transaction ID: email alone must never remove another purchase.
// Financial events use the provider identity; requests require a unique purchase.
export function reconcileGlobalRefunds(records, requests, { startDate, endDate }) {
  const normalize = input => String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  const identity = row => row.externalId ? JSON.stringify([normalize(row.platform), String(row.externalId)]) : null
  const status = row => row.refundExclusion?.status || statusKey(row.original?.status)
  const sales = records.filter(row => row.kind === 'sale' && !row.isAggregate)
  const financial = new Map()
  for (const row of records.filter(row => row.kind === 'refund')) {
    const key = identity(row)
    if (!key || !['confirmed', 'dispute'].includes(refundKind(status(row)))) continue
    const previous = financial.get(key)
    if (!previous || status(row) === 'refunded') financial.set(key, row)
  }
  const purchaseKey = (email, product, day) => normalize(email) && normalize(product) && day ? JSON.stringify([normalize(email), normalize(product), day]) : null
  const purchases = new Map(), refundedPurchases = new Map()
  for (const row of [...sales, ...financial.values()]) {
    const raw = row.original || {}
    const purchase = raw.dates?.ordered_at ?? (row.kind === 'sale' ? row.date : raw.dates?.created_at ?? raw.orderDate ?? row.date)
    const key = purchaseKey(row.buyerEmail, row.product, localDay(parseSaleDate(purchase)))
    if (!key) continue
    const index = row.kind === 'sale' ? purchases : refundedPurchases
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(row)
  }
  const emails = new Set(records.map(row => normalize(row.buyerEmail)).filter(Boolean))
  const linked = new Map(), pendingRequests = []
  for (const request of requests) {
    if (!['requested', 'reported_refunded', 'retained'].includes(request.status)) continue
    const key = purchaseKey(request.email, request.product, request.purchasedAt)
    const matchesPlatform = row => !request.platform || normalize(row.platform) === normalize(request.platform)
    const matches = (purchases.get(key) || []).filter(matchesPlatform)
    if (matches.length === 1) {
      const row = matches[0], previous = linked.get(row)
      const day = request.requestedAt || (request.status === 'retained' ? '9999-12-31' : '')
      const previousDay = previous?.requestedAt || (previous?.status === 'retained' ? '9999-12-31' : '')
      if (!previous || day > previousDay || (day === previousDay && request.status === 'retained')) linked.set(row, request)
    } else if (request.status !== 'retained') {
      const alreadyRefunded = (refundedPurchases.get(key) || []).some(matchesPlatform)
      const relevant = (request.purchasedAt >= startDate && request.purchasedAt <= endDate)
        || emails.has(normalize(request.email))
      if (!alreadyRefunded && relevant) pendingRequests.push(request)
    }
  }
  const replaced = new Set()
  let excludedCount = 0
  const reconciled = records.filter(row => row.kind !== 'refund' || !financial.has(identity(row)) || financial.get(identity(row)) === row).map(row => {
    if (row.kind !== 'sale' || row.isAggregate) return row
    const event = financial.get(identity(row)), request = linked.get(row)
    if (!event && (!request || request.status === 'retained')) return row
    if (event) replaced.add(event)
    excludedCount++
    return { ...row, kind: 'refund', canAttribute: false, ...(event ? { original: event.original, refundAmount: event.refundAmount, refundCurrency: event.refundCurrency } : {}),
      refundExclusion: { status: event ? status(event) : request.status, requestedAt: request?.requestedAt || null,
        sources: request?.sources || (event ? [event.sourceId] : []), requestId: request?.id || null } }
  }).filter(row => !replaced.has(row))
  return { records: reconciled, pendingRequests, excludedCount }
}

function normalizedRecord(row, overview) {
  const raw = row.original || {}
  const status = overview ? row.status : row.refundExclusion?.status || raw.status
  const digital = isNetSalesPlatform(row.platform)
  const invoiceProvider = ['hotmart', 'hubla'].includes(String(row.platform || '').toLowerCase())
  const netPurchase = overview ? value(row.saleNetAmount) : row.refundExclusion ? value(row.net) : invoiceProvider ? value(raw.netValue) : value(row.net)
  return {
    platform: String(row.platform || '').toLowerCase(),
    kind: overview ? row.kind : refundKind(status), status: statusKey(status),
    quantity: overview ? 1 : value(row.quantity) ?? 1,
    purchase: digital ? netPurchase : value(overview ? row.saleAmount : row.refundExclusion ? row.gross : raw.payment?.total ?? row.gross),
    refunded: overview ? value(row.refundAmount) : value(row.refundAmount ?? raw.refundAmount),
    currency: currency(overview ? row.currency : row.refundExclusion ? row.netCurrency || row.currency || raw.payment?.currency || raw.currency : invoiceProvider ? raw.netCurrency : raw.payment?.currency || raw.currency),
    refundCurrency: currency(overview ? row.refundCurrency || row.currency : row.refundCurrency || raw.refundCurrency || raw.payment?.currency || raw.currency),
  }
}

function amounts(records, key, available) {
  const byCurrency = {}
  let unknown = 0
  for (const row of records) {
    const unit = key === 'refunded' ? row.refundCurrency : row.currency
    if (row[key] === null || !unit) { unknown += row.quantity; continue }
    byCurrency[unit] = (byCurrency[unit] || 0) + Math.round(row[key] * 100)
  }
  // Zero is meaningful only for an available refund source with no records.
  if (!records.length && available) byCurrency.BRL = 0
  return { values: Object.entries(byCurrency).map(([code, cents]) => ({ currency: code, value: cents / 100 })), unknown }
}

export function buildRefundSummary(records = [], sources = [], { overview = false, platform = '' } = {}) {
  const items = records.filter(row => overview || row.kind === 'refund').map(row => normalizedRecord(row, overview))
  const selected = String(platform || '').toLowerCase()
  const providers = PROVIDERS.filter(provider => !selected || provider.id === selected).map(provider => {
    const source = sources.find(item => item.id === (overview ? provider.id : `${provider.id}Refunds`))
    const rows = items.filter(row => row.platform === provider.id)
    const available = ['ready', 'partial', 'available', 'limited'].includes(source?.status) || rows.some(row => ['confirmed', 'dispute', 'cancelled'].includes(row.kind))
    // TMB order cancellation is not a refund ledger, even when its query succeeds.
    const refundsAvailable = available && !['tmb', 'asaas'].includes(provider.id)
    const confirmed = rows.filter(row => row.kind === 'confirmed')
    const count = kind => rows.filter(row => row.kind === kind).reduce((sum, row) => sum + row.quantity, 0)
    const unknown = count('unknown')
    return {
      ...provider, rows, available, refundsAvailable,
      partial: !source || !['ready', 'available'].includes(source.status) || rows.some(row => row.kind === 'unknown'),
      confirmed: confirmed.length ? count('confirmed') : refundsAvailable && !unknown ? 0 : null,
      partialRefunds: confirmed.filter(row => row.status === 'partially_refunded').reduce((sum, row) => sum + row.quantity, 0),
      disputes: available && (provider.id === 'guru' || rows.some(row => row.kind === 'dispute')) ? count('dispute') : null,
      cancelled: available && (['guru', 'tmb'].includes(provider.id) || rows.some(row => row.kind === 'cancelled')) ? count('cancelled') : null,
      unknown,
      purchase: amounts(confirmed, 'purchase', refundsAvailable && !unknown),
      refunded: amounts(confirmed, 'refunded', refundsAvailable && !unknown),
    }
  })
  const available = providers.some(provider => provider.refundsAvailable)
  const confirmed = providers.flatMap(provider => provider.rows.filter(row => row.kind === 'confirmed'))
  const unknown = providers.reduce((sum, provider) => sum + provider.unknown, 0)
  const count = key => available || providers.some(provider => provider[key] !== null) ? providers.reduce((sum, provider) => sum + (provider[key] || 0), 0) : null
  const requests = items.filter(row => ['request', 'reported'].includes(row.kind) && row.status !== 'retained')
  const requestsAvailable = sources.some(source => source.id === 'refundRequests' && source.status === 'ready')
  return {
    providers, available,
    confirmed: unknown && !confirmed.length ? null : count('confirmed'), disputes: count('disputes'), cancelled: count('cancelled'),
    partialRefunds: providers.reduce((sum, provider) => sum + provider.partialRefunds, 0),
    unknown,
    purchase: amounts(confirmed, 'purchase', available && !unknown),
    refunded: amounts(confirmed, 'refunded', available && !unknown),
    requests: requests.length ? requests.reduce((sum, row) => sum + row.quantity, 0) : requestsAvailable ? 0 : null,
    affectedPurchase: amounts(items.filter(row => ['confirmed', 'dispute', 'request', 'reported'].includes(row.kind) && row.status !== 'retained'), 'purchase', available && requestsAvailable && !unknown),
    partial: providers.some(provider => provider.partial),
  }
}

export function refundPeriodLink(startDate, endDate) {
  return `/reembolsos?${new URLSearchParams({ startDate, endDate })}`
}
