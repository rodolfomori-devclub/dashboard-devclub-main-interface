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
  if (!asaasCashOnly(data)) return { status: 'ready', ...receipts }
  const read = key => {
    const value = data[key]
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) throw new Error('Caixa Asaas indisponível')
    return Number(value)
  }
  return {
    ...receipts, status: 'partial', salesAvailable: false, reason: 'checkout_disabled',
    cash: { gross: read('totalGross'), net: read('totalNet'), fees: read('totalFees'), count: read('count'), availablePeriods: 1, periods: 1 },
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
