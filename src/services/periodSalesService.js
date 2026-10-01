import { loadSalesRange } from '../components/daily/dailyData'
import { monthRanges, mergePeriodSources } from '../utils/periodData'

export async function loadPeriodSales(startDate, endDate, { annual = false, force = false, onProgress = () => {}, isCancelled = () => false } = {}) {
  const ranges = annual ? monthRanges(startDate, endDate) : [{ startDate, endDate }]
  const results = []
  // Two months at a time avoids the previous burst of every month's sources.
  for (let i = 0; i < ranges.length; i += 2) {
    if (isCancelled()) throw new Error('Consulta cancelada')
    const batch = await Promise.all(ranges.slice(i, i + 2).map(async range => ({
      ...range, result: await loadSalesRange(range.startDate, range.endDate, { force, includeAsaas: !annual }),
    })))
    results.push(...batch)
    onProgress({ current: results.length, total: ranges.length })
  }
  const sources = mergePeriodSources(results, annual)
  return { sources, records: sources.flatMap(source => source.rows), fetchedAt: Date.now() }
}
