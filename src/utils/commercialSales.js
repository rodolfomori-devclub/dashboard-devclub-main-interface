import { normalizeUtmSource } from '../services/salesOpsService.js'
import { summarizeSales } from './salesData.js'

// The source identifies a commercial channel, not a person's identity. Seller
// names come only from the approved ledger, including manual corrections.
export function isCommercialSale(row) {
  if (row?.kind !== 'sale' || row.isAggregate) return false
  const source = normalizeUtmSource(row.utm?.source)
  return /^comercial(?:$|[-_ ]\s*\S.*)/.test(source) || row.attributionMethod === 'utm'
    || Boolean(normalizeUtmSource(row.attributionUtmSource))
}

export function commercialSellerLabel(row) {
  return row?.sellerId && typeof row.sellerName === 'string' && row.sellerName.trim()
    ? row.sellerName.trim() : 'Sem vendedor vinculado'
}

export function summarizeCommercialSales(records = []) {
  const commercial = records.filter(isCommercialSale)
  const grouped = new Map()
  for (const row of commercial) {
    const sellerId = row.sellerId || null
    const utmSource = typeof row.utm?.source === 'string' ? row.utm.source.trim() : ''
    const key = JSON.stringify([sellerId, normalizeUtmSource(utmSource)])
    if (!grouped.has(key)) grouped.set(key, {
      key, sellerId, sellerName: commercialSellerLabel(row), utmSource, records: [],
    })
    grouped.get(key).records.push(row)
  }
  const groups = [...grouped.values()].map(({ records: rows, ...group }) => ({
    ...group, ...summarizeSales(rows),
  })).sort((a, b) => b.revenue.value - a.revenue.value
    || a.sellerName.localeCompare(b.sellerName, 'pt-BR')
    || a.utmSource.localeCompare(b.utmSource, 'pt-BR'))
  return { records: commercial, total: summarizeSales(commercial), groups }
}
