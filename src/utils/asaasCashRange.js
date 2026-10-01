const DAY = 86_400_000
export function asaasCashRanges(startDate, endDate) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(startDate) || !valid(endDate) || startDate > endDate || Date.parse(endDate) - Date.parse(startDate) > 365 * DAY) throw new Error('Período inválido')
  const ranges = []
  for (let day = Date.parse(`${startDate}T12:00:00Z`), last = Date.parse(`${endDate}T12:00:00Z`); day <= last; day += 7 * DAY) ranges.push({ startDate: new Date(day).toISOString().slice(0, 10), endDate: new Date(Math.min(day + 6 * DAY, last)).toISOString().slice(0, 10) })
  return ranges
}

export function readAsaasCash(payload) {
  const data = payload?.data
  if (payload?.success === false || data?.availability?.cash !== 'ready') throw new Error('Caixa Asaas indisponível')
  return Object.fromEntries([['gross', 'totalGross'], ['net', 'totalNet'], ['fees', 'totalFees'], ['count', 'count']].map(([field, key]) => {
    const value = data[key]
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || (field === 'count' && (!Number.isInteger(Number(value)) || Number(value) < 0))) throw new Error('Caixa Asaas incompleto')
    return [field, Number(value)]
  }))
}

// Independent from sales queries. Both full-range and weekly requests deduplicate;
// the shared queue caps simultaneous upstream calls at two even across ranges.
export function createAsaasCashLoader(fetchRange, { now = Date.now, ttl = 60_000 } = {}) {
  const cache = new Map(), pending = new Map(), weeks = new Map(), pendingWeeks = new Map(), queue = []
  let generation = 0, active = 0
  const schedule = task => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject })
    function drain() {
      while (active < 2 && queue.length) {
        const next = queue.shift(); active++
        Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => { active--; drain() })
      }
    }
    drain()
  })
  const week = (range, force, requestGeneration, isCancelled) => {
    const key = `${range.startDate}:${range.endDate}`, saved = weeks.get(key)
    if (pendingWeeks.has(key)) return pendingWeeks.get(key)
    if (force) weeks.delete(key)
    if (!force && saved && now() - saved.at < ttl) return Promise.resolve(saved.cash)
    const request = schedule(async () => {
      if (requestGeneration !== generation || isCancelled()) throw new Error('Consulta cancelada')
      const cash = readAsaasCash(await fetchRange(range))
      if (requestGeneration === generation) weeks.set(key, { cash, at: now() })
      return cash
    }).finally(() => { if (pendingWeeks.get(key) === request) pendingWeeks.delete(key) })
    pendingWeeks.set(key, request)
    return request
  }
  function load(startDate, endDate, { force = false, onProgress = () => {}, isCancelled = () => false } = {}) {
    const ranges = asaasCashRanges(startDate, endDate), key = `${startDate}:${endDate}`
    const subscriber = { onProgress, isCancelled }, saved = cache.get(key)
    if (pending.has(key)) { const entry = pending.get(key); entry.subscribers.add(subscriber); onProgress(entry.progress); return entry.promise }
    if (force) cache.delete(key)
    if (!force && saved && now() - saved.fetchedAt < ttl) { onProgress({ current: ranges.length, total: ranges.length, failed: 0 }); return Promise.resolve(saved) }
    const requestGeneration = generation
    const entry = { subscribers: new Set([subscriber]), progress: { current: 0, total: ranges.length, failed: 0 } }
    const cancelled = () => requestGeneration !== generation || [...entry.subscribers].every(item => item.isCancelled())
    const notify = () => { for (const item of entry.subscribers) if (!item.isCancelled()) item.onProgress({ ...entry.progress }) }
    notify()
    entry.promise = Promise.all(ranges.map(async range => {
      try { return { ...range, cash: await week(range, force, requestGeneration, cancelled) } }
      catch { entry.progress.failed++; return { ...range, cash: null } }
      finally { entry.progress.current++; notify() }
    })).then(results => {
      if (cancelled()) throw new Error('Consulta cancelada')
      const available = results.filter(item => item.cash), failedPeriods = results.filter(item => !item.cash).map(({ startDate, endDate }) => ({ startDate, endDate }))
      // No intermediate financial total is published while intervals are pending.
      const cash = available.length ? { ...Object.fromEntries(['gross', 'net', 'fees', 'count'].map(field => [field, available.reduce((sum, item) => sum + item.cash[field], 0)])), availablePeriods: available.length, periods: ranges.length } : null
      const result = { startDate, endDate, status: !available.length ? 'unavailable' : failedPeriods.length ? 'partial' : 'ready', cash, failedPeriods, fetchedAt: now() }
      if (result.status === 'ready' && requestGeneration === generation) cache.set(key, result)
      return result
    }).finally(() => { if (pending.get(key) === entry) pending.delete(key) })
    pending.set(key, entry)
    return entry.promise
  }
  return { load, invalidate() { generation++; cache.clear(); pending.clear(); weeks.clear(); pendingWeeks.clear() } }
}
