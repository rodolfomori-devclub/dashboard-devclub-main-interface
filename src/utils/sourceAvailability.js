import { TMB_CASH_METADATA } from './tmbCash.js'

// A successful receipts query does not imply that new-sale contracts are known.
export function sourceHasSales(source) {
  return ['ready', 'partial'].includes(source.status) && source.salesAvailable !== false
}

export function asaasCashOnly(data) {
  return data?.availability?.reason === 'checkout_disabled' && data.availability.cash === 'ready' && data.availability.sales === 'unavailable' && data.sales === null
}

export function sourceFinancialMetadata(sourceId, data) {
  if (sourceId === 'tmb') return { status: 'ready', ...TMB_CASH_METADATA }
  if (sourceId === 'hotmart') {
    const incomplete = Object.values(data?.financialCoverage || {}).some(coverage => coverage?.complete === false)
      || (data?.financialSchemaVersion !== 2 && data?.transactions?.some(row => row.currency && row.currency !== 'BRL'))
    return { status: incomplete ? 'partial' : 'ready', ...(data?.financialCoverage ? { financialCoverage: data.financialCoverage } : {}) }
  }
  if (sourceId !== 'asaas') return { status: 'ready' }
  const receipts = Array.isArray(data?.cashReceipts) ? { cashReceipts: [
    ...data.cashReceipts,
    ...(data.cashReceiptsUndated?.count > 0 ? [{ date: null, received: data.cashReceiptsUndated.received, count: data.cashReceiptsUndated.count }] : []),
  ] } : {}
  const origins = data?.cashReceiptOrigins ? { cashReceiptOrigins: data.cashReceiptOrigins } : {}
  const read = key => {
    const value = data[key]
    if (value === null || value === undefined || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) || (key === 'count' && (!Number.isInteger(Number(value)) || Number(value) < 0))) throw new Error('Caixa Asaas indisponível')
    return Number(value)
  }
  let cash
  try {
    if (data?.availability?.cash !== 'unavailable') cash = { gross: read('totalGross'), net: read('totalNet'), fees: read('totalFees'), count: read('count'), availablePeriods: 1, periods: 1 }
  } catch (error) {
    // Legacy contract-only responses remain valid; they do not establish cash.
    if (asaasCashOnly(data)) throw error
  }
  if (!asaasCashOnly(data)) return { status: 'ready', ...receipts, ...origins, ...(cash ? { cash } : {}) }
  return {
    ...receipts, ...origins, status: 'partial', salesAvailable: false, reason: 'checkout_disabled', cash,
  }
}

export function asaasCashView(sources, filters = {}) {
  if (filters.platform && filters.platform !== 'Asaas') return null
  const source = sources.find(item => item.id === 'asaas' && item.cash)
  if (!source) return null
  // No product, payment, offer or UTM distribution was provided by this query.
  const allocationMissing = Object.entries(filters).some(([key, value]) => key !== 'platform' && Boolean(value))
  return { ...source.cash, allocationMissing, partial: source.cash.availablePeriods < source.cash.periods }
}
