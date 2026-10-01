import axios from 'axios'
import { loadSalesRange, mergeFreshSalesLedger, normalizeProviderSource, salesCacheGeneration, validateSalesRange } from '../components/daily/dailyData.js'
import { SOURCE_DEFINITIONS } from '../utils/salesData.js'
import { mergePeriodSources } from '../utils/periodData.js'
import { getSalesLedger } from './salesOpsService.js'
import { sourceHasSales } from '../utils/sourceAvailability.js'

const cancelledError = () => Object.assign(new Error('Consulta cancelada'), { name: 'AbortError' })
const waitForPoll = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(cancelledError()); return }
  const finish = () => { signal?.removeEventListener('abort', abort); resolve() }
  const timer = setTimeout(finish, milliseconds)
  const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(cancelledError()) }
  signal?.addEventListener('abort', abort, { once: true })
})

function assertSnapshot(snapshot, startDate, endDate) {
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.segments) || !snapshot.segments.length || snapshot.requested?.startDate !== startDate || snapshot.requested?.endDate !== endDate || !Number.isInteger(snapshot.pending) || snapshot.pending < 0 || !Number.isInteger(snapshot.total) || snapshot.total < 1 || !Number.isInteger(snapshot.completed) || snapshot.completed < 0 || snapshot.completed > snapshot.total || snapshot.pending > snapshot.total || typeof snapshot.complete !== 'boolean' || snapshot.complete !== (snapshot.pending === 0)) throw new Error('Cache do período indisponível')
  let nextDay = startDate
  for (const segment of snapshot.segments) {
    validateSalesRange(segment.startDate, segment.endDate)
    if (segment.startDate !== nextDay || segment.endDate > endDate || !['history', 'today'].includes(segment.kind) || !Array.isArray(segment.sources) || new Set(segment.sources.map(source => source.id)).size !== segment.sources.length) throw new Error('Cache do período incompleto')
    nextDay = new Date(Date.parse(`${segment.endDate}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  }
  if (snapshot.segments.at(-1).endDate !== endDate) throw new Error('Cache do período incompleto')
}

export function periodCacheStatus(snapshot) {
  const sources = snapshot.segments.flatMap(segment => segment.sources.map(source => ({ ...source, kind: segment.kind })))
  const datesFor = kind => sources.filter(source => source.kind === kind && source.payload && Number.isFinite(Date.parse(source.fetchedAt))).map(source => source.fetchedAt).sort((a, b) => Date.parse(a) - Date.parse(b))
  const historyDates = datesFor('history'), todayDates = datesFor('today')
  return {
    pending: snapshot.pending, current: snapshot.completed, total: snapshot.total,
    historySegments: snapshot.segments.filter(segment => segment.kind === 'history').length,
    hasToday: snapshot.segments.some(segment => segment.kind === 'today'),
    oldestSnapshotAt: historyDates[0] || null, newestSnapshotAt: historyDates.at(-1) || null,
    todaySnapshotAt: todayDates[0] || null, todayNewestSnapshotAt: todayDates.at(-1) || null,
    staleSources: sources.filter(source => source.status === 'stale').length,
    unavailableSources: sources.filter(source => !source.payload && source.status === 'unavailable').length,
    generatedAt: snapshot.generatedAt, schedule: snapshot.schedule,
  }
}

// Normalize each disjoint segment on its own: aggregate residuals belong to
// their original period, and may never be redistributed across products/days.
export function normalizePeriodSnapshot(snapshot, { annual = false } = {}) {
  const batches = snapshot.segments.map(segment => {
    const sources = SOURCE_DEFINITIONS.map(definition => {
      if (definition.id === 'asaas' && annual) return { ...definition, status: 'not_requested', salesAvailable: false, reason: 'annual_cash_on_demand', rows: [], cash: null }
      const cached = segment.sources.find(source => source.id === definition.id)
      if (!cached?.payload || !['ready', 'stale'].includes(cached.status)) return { ...definition, status: 'unavailable', rows: [], cacheStatus: cached?.status || 'unavailable' }
      try {
        const source = normalizeProviderSource(definition.id, cached.payload)
        return { ...source, status: cached.status === 'stale' ? 'partial' : source.status, cacheStatus: cached.status, snapshotAt: cached.fetchedAt, refreshing: cached.refreshing }
      } catch { return { ...definition, status: 'unavailable', rows: [], cacheStatus: 'unavailable' } }
    })
    return { ...segment, result: { sources, records: sources.flatMap(source => source.rows) } }
  })
  const sources = mergePeriodSources(batches, annual)
  for (const source of sources) source.snapshots = snapshot.segments.map(segment => {
    const cached = segment.sources.find(item => item.id === source.id)
    const normalized = batches.find(batch => batch.startDate === segment.startDate).result.sources.find(item => item.id === source.id)
    return { startDate: segment.startDate, endDate: segment.endDate, kind: segment.kind, status: cached?.status || 'not_requested', salesAvailable: sourceHasSales(normalized), fetchedAt: cached?.fetchedAt || null, lastAttemptAt: cached?.lastAttemptAt || null }
  })
  return { ...snapshot.requested, sources, records: sources.flatMap(source => source.rows), fetchedAt: Date.now(), cache: periodCacheStatus(snapshot) }
}

export function bucketHasSalesSource(sources, ids, startDate, endDate) {
  return sources.some(source => ids.includes(source.id) && sourceHasSales(source) && (!source.snapshots || source.snapshots.some(snapshot => snapshot.startDate <= endDate && snapshot.endDate >= startDate && snapshot.salesAvailable !== false && ['ready', 'stale'].includes(snapshot.status))))
}

export function createPeriodCacheLoader({ fetchSnapshot, fetchLedger = getSalesLedger, wait = waitForPoll, getGeneration = salesCacheGeneration, now = Date.now, maxWaitMs = 300_000 }) {
  return async function load(startDate, endDate, { annual = false, force = false, onProgress = () => {}, onSnapshot = () => {}, isCancelled = () => false, signal } = {}) {
    validateSalesRange(startDate, endDate)
    const generation = getGeneration()
    const startedAt = now()
    const assertActive = () => { if (signal?.aborted || isCancelled() || generation !== getGeneration()) throw cancelledError() }
    let first = true, snapshot, result, ledgerResult, fingerprint, pollTimedOut = false
    do {
      assertActive()
      if (snapshot && now() - startedAt >= maxWaitMs) { pollTimedOut = true; break }
      snapshot = await fetchSnapshot(startDate, endDate, { includeAsaas: !annual, force: first && force, signal })
      first = false
      assertActive()
      assertSnapshot(snapshot, startDate, endDate)
      onProgress(periodCacheStatus(snapshot))
      // Already collected history remains useful even when today's first
      // snapshot is pending. Keep one fresh ledger for this load only.
      if (snapshot.pending === 0 || snapshot.segments.some(segment => segment.sources.some(source => source.payload))) {
        const nextFingerprint = JSON.stringify(snapshot.segments.map(segment => segment.sources.map(source => [source.id, source.status, source.fetchedAt, source.refreshing])))
        if (nextFingerprint !== fingerprint) {
          const ledger = ledgerResult ? async () => {
            if (ledgerResult.operationsStatus !== 'ready') throw new Error(ledgerResult.operationsError)
            return ledgerResult.ledger
          } : fetchLedger
          result = await mergeFreshSalesLedger(normalizePeriodSnapshot(snapshot, { annual }), startDate, endDate, ledger)
          ledgerResult = result
          fingerprint = nextFingerprint
          assertActive()
          onSnapshot(result)
        }
      }
      if (snapshot.pending > 0) await wait(Math.max(0, Math.min(2000, maxWaitMs - (now() - startedAt))), signal)
    } while (snapshot.pending > 0)
    assertActive()
    if (!result) result = await mergeFreshSalesLedger(normalizePeriodSnapshot(snapshot, { annual }), startDate, endDate, fetchLedger)
    assertActive()
    const cache = { ...periodCacheStatus(snapshot), pollTimedOut }
    onProgress(cache)
    return { ...result, cache }
  }
}

const loadCachedPeriod = createPeriodCacheLoader({
  fetchSnapshot: async (startDate, endDate, { includeAsaas, force, signal }) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    const response = await axios.get(`${base}/period-cache`, { params: { startDate, endDate, includeAsaas, ...(force ? { force: 1 } : {}) }, timeout: 30_000, signal })
    return response.data
  },
})

export async function loadPeriodSales(startDate, endDate, options = {}) {
  if (options.annual || options.historical) return loadCachedPeriod(startDate, endDate, options)
  // The launch/global view keeps its existing direct-provider behavior.
  if (options.isCancelled?.()) throw cancelledError()
  const result = await loadSalesRange(startDate, endDate, { force: options.force })
  if (options.isCancelled?.()) throw cancelledError()
  options.onProgress?.({ current: 1, total: 1 })
  const sources = mergePeriodSources([{ startDate, endDate, result }])
  return { startDate, endDate, sources, records: sources.flatMap(source => source.rows), fetchedAt: result.fetchedAt }
}
