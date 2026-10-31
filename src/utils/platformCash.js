// Guru, Hotmart and Hubla use the platform's already calculated net amount everywhere.
// `gross` remains a compatibility key for stored goals/clients; for these
// providers it carries the sales value after fees, never the provider gross.
export const PLATFORM_NET_CASH_METADATA = Object.freeze({
  cashBasis: 'sales_rule', cashRule: 'platform_net_100_percent',
  cashRate: 1, cashDateBasis: 'sale_date',
})

const platformKey = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
export const isNetSalesPlatform = platform => ['guru', 'hotmart', 'hubla'].includes(platformKey(platform))
export function usesPlatformNet(row) {
  const source = platformKey(row?.sourceId || row?.source)
  // A native provider identity wins over an incidental display label.
  if (source && source !== 'manual') return isNetSalesPlatform(source)
  return isNetSalesPlatform(row?.platform)
}

// Commercial categories are shared by every dashboard. The checkout method
// stays on the record for details/exports and is never rewritten by grouping.
export function salesPaymentLabel(row) {
  if (row?.kind !== 'sale') return row?.payment
  const source = platformKey(row.sourceId || row.source)
  const platform = source && source !== 'manual' ? source : platformKey(row.platform)
  if (['guru', 'hotmart', 'hubla'].includes(platform)) return 'Cartão'
  if (['tmb', 'boletex'].includes(platform)) return 'Boleto'
  return row.payment
}

export function applyPlatformCashRule(row) {
  if (row?.kind !== 'sale' || !usesPlatformNet(row)) return row
  const value = row.net
  const net = ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  return { ...row, ...PLATFORM_NET_CASH_METADATA, valueBasis: 'platform_net',
    gross: net, net, revenue: net, received: net, listPrice: null, cashDate: row.date ?? null }
}
