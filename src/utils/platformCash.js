// Business definition: Guru and Hotmart contribute 100% of their sale's net
// amount. The backend has already deducted fees/commissions; never deduct again.
export const PLATFORM_NET_CASH_METADATA = Object.freeze({
  cashBasis: 'sales_rule', cashRule: 'platform_net_100_percent',
  cashRate: 1, cashDateBasis: 'sale_date',
})

export function applyPlatformCashRule(row) {
  if (row?.kind !== 'sale' || row.isManual || !['guru', 'hotmart'].includes(row.sourceId)) return row
  const value = row.net
  const net = ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  return { ...row, ...PLATFORM_NET_CASH_METADATA, received: net, cashDate: row.date ?? null }
}
