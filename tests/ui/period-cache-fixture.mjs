import { monthRanges } from '../../src/utils/periodData.js'
import { SOURCE_DEFINITIONS } from '../../src/utils/salesData.js'

export const emptyProviderPayload = id => id === 'guru' || id === 'guruRefunds' || id === 'tmb' ? { success: true, data: [] }
  : id === 'asaas' ? { success: true, data: { count: 0, totalGross: 0, totalNet: 0, totalFees: 0, cashReceipts: [], sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } }
    : id === 'boletex' ? { success: true, data: { sales: { count: 0, totalValue: 0, confirmedValue: 0, pendingValue: 0, entries: [] } } }
      : { success: true, data: { count: 0, totalGross: 0, totalNet: 0, totalFees: 0, totalRefundAmount: 0, transactions: [] } }

// Mirror server segmentation without making requests to any platform.
export function periodCacheFixture(url, { today, payloadForSource, statusForSource = () => 'ready' }) {
  const startDate = url.searchParams.get('startDate'), requestedEnd = url.searchParams.get('endDate')
  const endDate = requestedEnd < today ? requestedEnd : today
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const historyEnd = endDate < today ? endDate : yesterday
  const segments = startDate <= historyEnd ? monthRanges(startDate, historyEnd).map(range => ({ ...range, kind: 'history' })) : []
  if (endDate === today && startDate <= today) segments.push({ startDate: today, endDate: today, kind: 'today' })
  const definitions = SOURCE_DEFINITIONS.filter(source => source.id !== 'asaas' || url.searchParams.get('includeAsaas') !== 'false')
  for (const segment of segments) segment.sources = definitions.map(({ id }) => {
    const status = statusForSource(id, segment)
    return { id, status, payload: ['ready', 'stale'].includes(status) ? payloadForSource(id, segment) : null, fetchedAt: ['ready', 'stale'].includes(status) ? `${today}T07:00:00.000Z` : null, lastAttemptAt: `${today}T07:00:00.000Z`, refreshing: status === 'loading', error: status === 'unavailable' ? 'provider_unavailable' : null }
  })
  const sources = segments.flatMap(segment => segment.sources), pending = sources.filter(source => source.refreshing).length
  return { schemaVersion: 1, requested: { startDate, endDate: requestedEnd }, segments, complete: pending === 0, pending, total: sources.length, completed: sources.length - pending, generatedAt: `${today}T18:00:00.000Z`, schedule: { timezone: 'America/Sao_Paulo', hour: 4 } }
}
