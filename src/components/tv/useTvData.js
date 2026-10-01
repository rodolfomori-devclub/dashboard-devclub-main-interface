import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { API_URL } from '../../lib/api.js'
import { loadPeriodSales } from '../../services/periodSalesService.js'
import { brazilDate } from '../../utils/goalPace.js'
import { sourceHasSales } from '../../utils/sourceAvailability.js'
import { buildTvData, resolveTvPeriod } from './tvData.js'

const EMPTY = { plans: [], directory: {}, plansError: true, directoryError: true }
const wasCancelled = error => error?.name === 'AbortError' || axios.isCancel(error)
const validSales = sales => Array.isArray(sales?.records) && Array.isArray(sales?.sources)
const usableSales = sales => validSales(sales) && sales.sources.some(source => source.kind === 'sale' && sourceHasSales(source)
  && (source.id !== 'manual' || sales.records.some(row => row.isManual)))

/** All scenes share one cached month and one current attribution ledger. */
export function useTvData({ month = 'current', metric = 'gross', enabled = true, paceScope = 'overall', paceScopeId = '' } = {}) {
  const [today, setToday] = useState(brazilDate)
  const period = useMemo(() => resolveTvPeriod(month, new Date(`${today}T12:00:00-03:00`)), [month, today])
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const request = useRef(null)
  const generation = useRef(0)
  const stateRef = useRef(null)

  useEffect(() => {
    const tick = () => setToday(brazilDate())
    const timer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])

  const load = useCallback(() => {
    if (!enabled) return Promise.resolve()
    // An automatic tick and a manual refresh may arrive together. They share
    // the same request instead of launching another historical cache poll.
    if (request.current) return request.current.promise
    const id = ++generation.current
    const controller = new AbortController()
    const previous = stateRef.current?.month === period.key ? stateRef.current : null
    const active = () => id === generation.current && !controller.signal.aborted
    const publish = value => {
      if (!active()) return
      const next = { ...value, month: period.key }
      stateRef.current = next
      setState(next)
    }
    setBusy(true)
    const run = async () => {
      let snapshot = null
      const results = await Promise.allSettled([
        axios.get(`${API_URL}/goal-plans/${period.year}/${period.month}`, { signal: controller.signal, timeout: 30_000 }),
        axios.get(`${API_URL}/goal-plans/options`, { signal: controller.signal, timeout: 30_000 }),
        period.future ? Promise.resolve({ records: [], sources: [], fetchedAt: Date.now() })
          : loadPeriodSales(period.start, period.observedEnd, { historical: true, signal: controller.signal,
            isCancelled: () => !active(), onSnapshot: sales => {
              if (!active() || !validSales(sales)) return
              snapshot = sales
              if (!usableSales(sales) && previous?.sales) return
              // Keep the display useful if today's snapshot is still being
              // prepared; final metadata and cache status follow when ready.
              publish({ ...EMPTY, ...previous, sales, salesError: false, error: null, updatedAt: sales.fetchedAt || Date.now() })
            } }),
      ])
      if (!active()) return
      const [planResult, directoryResult, salesResult] = results
      const plans = planResult.status === 'fulfilled' ? planResult.value.data?.plans : null
      const directory = directoryResult.status === 'fulfilled' ? directoryResult.value.data : null
      const plansError = !Array.isArray(plans)
      const directoryError = !Array.isArray(directory?.individuals) || !Array.isArray(directory?.teams)
      const candidate = salesResult.status === 'fulfilled' && validSales(salesResult.value) ? salesResult.value : snapshot
      const failedSales = !period.future && !usableSales(candidate)
      const salesError = failedSales || salesResult.status === 'rejected' || Boolean(candidate?.cache?.pollTimedOut)
      const preserve = failedSales && previous?.sales
      const sales = preserve ? previous.sales : candidate || null
      const errors = []
      if (failedSales) errors.push(preserve ? 'A atualização das vendas falhou. Exibindo a última leitura válida deste mês.' : 'Vendas indisponíveis no momento.')
      else if (salesError) errors.push('A atualização das vendas não foi concluída. Os valores disponíveis foram preservados; a TV tentará novamente.')
      if (plansError) errors.push(previous?.plans?.length ? 'Metas em atualização. Exibindo o último plano disponível.' : 'Não foi possível carregar as metas.')
      if (directoryError) errors.push('Cadastro de times e vendedores indisponível.')
      publish({ sales, plans: plansError ? previous?.plans || [] : plans,
        directory: directoryError ? previous?.directory || {} : directory, plansError, directoryError, salesError,
        error: errors.length ? errors.join(' ') : null,
        updatedAt: preserve ? previous.updatedAt : sales?.fetchedAt || (period.future ? Date.now() : null) })
    }
    const promise = run().catch(error => {
      if (!active() || wasCancelled(error)) return
      publish({ ...EMPTY, ...previous, sales: previous?.sales || null, salesError: true,
        error: previous?.sales ? 'Não foi possível atualizar. Exibindo a última leitura válida deste mês.' : 'Não foi possível carregar os dados da TV.' })
    }).finally(() => {
      if (request.current?.id === id) request.current = null
      if (active()) setBusy(false)
    })
    request.current = { id, controller, promise }
    return promise
  }, [enabled, period])

  useEffect(() => {
    load()
    const refreshVisible = () => { if (!document.hidden) load() }
    const invalidate = () => { generation.current++ }
    const timer = window.setInterval(refreshVisible, 60_000)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      invalidate()
      request.current?.controller.abort()
      request.current = null
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [load])

  const current = enabled && state?.month === period.key ? state : null
  const model = useMemo(() => current ? buildTvData({ ...current, sales: current.sales || {}, year: period.year,
    month: period.month, today: period.today, metric, paceScope, paceScopeId }) : null, [current, period, metric, paceScope, paceScopeId])
  return { model, loading: Boolean(enabled && (!current || (!current.sales && busy))),
    refreshing: Boolean(enabled && current?.sales && busy), error: current?.error || null,
    refresh: load, updatedAt: current?.updatedAt || null }
}
