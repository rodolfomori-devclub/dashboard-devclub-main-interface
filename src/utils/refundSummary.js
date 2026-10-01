// Refund status and purchase price are distinct from the amount actually returned.
const PROVIDERS = [{ id: 'guru', label: 'Guru' }, { id: 'hotmart', label: 'Hotmart' }, { id: 'tmb', label: 'TMB' }, { id: 'asaas', label: 'Asaas' }]
const value = number => number !== null && number !== undefined && number !== '' && Number.isFinite(Number(number)) && Number(number) >= 0 ? Number(number) : null
const currency = input => typeof input === 'string' && /^[A-Z]{3}$/.test(input.toUpperCase()) ? input.toUpperCase() : null
const statusKey = input => String(input || '').toLowerCase().trim()

export function refundKind(status) {
  if (['refunded', 'partially_refunded'].includes(statusKey(status))) return 'confirmed'
  if (['chargeback', 'dispute'].includes(statusKey(status))) return 'dispute'
  if (['rejected', 'cancelled', 'canceled', 'cancelado'].includes(statusKey(status))) return 'cancelled'
  return 'unknown'
}

function normalizedRecord(row, overview) {
  const raw = row.original || {}
  const status = overview ? row.status : raw.status
  return {
    platform: String(row.platform || '').toLowerCase(),
    kind: overview ? row.kind : refundKind(status), status: statusKey(status),
    quantity: overview ? 1 : value(row.quantity) ?? 1,
    purchase: value(overview ? row.saleAmount : raw.payment?.total ?? row.gross),
    refunded: overview ? value(row.refundAmount) : null,
    currency: currency(overview ? row.currency : raw.payment?.currency || raw.currency),
  }
}

function amounts(records, key, available) {
  const byCurrency = {}
  let unknown = 0
  for (const row of records) {
    if (row[key] === null || !row.currency) { unknown += row.quantity; continue }
    byCurrency[row.currency] = (byCurrency[row.currency] || 0) + Math.round(row[key] * 100)
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
  return {
    providers, available,
    confirmed: unknown && !confirmed.length ? null : count('confirmed'), disputes: count('disputes'), cancelled: count('cancelled'),
    partialRefunds: providers.reduce((sum, provider) => sum + provider.partialRefunds, 0),
    unknown,
    purchase: amounts(confirmed, 'purchase', available && !unknown),
    refunded: amounts(confirmed, 'refunded', available && !unknown),
    partial: providers.some(provider => provider.partial),
  }
}

export function refundPeriodLink(startDate, endDate) {
  return `/reembolsos?${new URLSearchParams({ startDate, endDate })}`
}
