// Guru and Hotmart use the platform's already calculated net amount everywhere.
// `gross` remains a compatibility key for stored goals/clients; for these two
// providers it carries the sales value after fees, never the provider gross.
export const PLATFORM_NET_CASH_METADATA = Object.freeze({
  cashBasis: 'sales_rule', cashRule: 'platform_net_100_percent',
  cashRate: 1, cashDateBasis: 'sale_date',
})

const platformKey = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
export const isNetSalesPlatform = platform => ['guru', 'hotmart'].includes(platformKey(platform))
export function usesPlatformNet(row) {
  const source = platformKey(row?.sourceId || row?.source)
  // A native provider identity wins over an incidental display label.
  if (source && source !== 'manual') return isNetSalesPlatform(source)
  return isNetSalesPlatform(row?.platform)
}

export function applyPlatformCashRule(row) {
  if (row?.kind !== 'sale' || !usesPlatformNet(row)) return row
  const value = row.net
  const net = ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  return { ...row, ...PLATFORM_NET_CASH_METADATA, valueBasis: 'platform_net',
    gross: net, net, revenue: net, received: net, listPrice: null, cashDate: row.date ?? null }
}
