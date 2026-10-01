import axios from 'axios'
import { sourceFinancialMetadata } from '../../utils/sourceAvailability'
import { normalizeSource, SOURCE_DEFINITIONS } from '../../utils/salesData'
import { getSalesLedger, mergeSalesOperations } from '../../services/salesOpsService'

const cache = new Map()
const inflight = new Map()
const TTL = 60_000
let generation = 0
export function invalidateSalesCache() { generation++; cache.clear(); inflight.clear() }
const summaryFields = ['count', 'totalValue', 'entryValue', 'confirmedCount', 'listPriceValue', 'confirmedValue', 'pendingValue', 'expectedEntryValue', 'totalGross', 'totalNet', 'totalFees', 'totalRefundAmount']
const curatedSummary = (data) => {
  const pick = (value) => Object.fromEntries(summaryFields.filter((field) => value?.[field] !== undefined).map((field) => [field, value[field]]))
  return { ...pick(data), sales: pick(data?.sales), emitted: pick(data?.emitted) }
}

export function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function loadDailySales(date, options) {
  return loadSalesRange(date, date, options)
}

export async function loadSalesRange(startDate, endDate, { force = false } = {}) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error('Período inválido')
  const key = `${startDate}:${endDate}`
  if (inflight.has(key)) return inflight.get(key)
  const previous = cache.get(key)
  if (!force && previous && Date.now() - previous.fetchedAt < TTL) return previous
  const requestGeneration = generation
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  const daily = startDate === endDate
  const config = { timeout: daily ? 60_000 : 120_000, params: daily ? { date: startDate } : { data_inicio: startDate, data_final: endDate } }
  const guruDates = { ordered_at_ini: startDate, ordered_at_end: endDate }
  const loaders = {
    guru: () => axios.post(`${base}/transactions`, guruDates, { timeout: config.timeout }),
    guruRefunds: () => axios.post(`${base}/refunds`, guruDates, { timeout: config.timeout }),
    tmb: () => axios.get(`${base}/boleto/vendas/${daily ? 'data' : 'periodo'}`, config),
    asaas: () => axios.get(`${base}/boleto/asaas/vendas`, config),
    boletex: () => axios.get(`${base}/boleto/boletex/vendas`, config),
    hotmart: () => axios.get(`${base}/hotmart/vendas`, config),
    hotmartRefunds: () => axios.get(`${base}/hotmart/reembolsos`, config),
  }
  const request = (async () => {
    // Start ledger validation alongside platform requests; unavailable manual
    // data is represented explicitly in the source status, never as zero sales.
    const ledgerRequest = getSalesLedger(startDate, endDate).then((data) => ({ data, status: 'ready' }), (error) => ({ data: null, status: 'unavailable', error: error.message }));
    const settled = await Promise.allSettled(SOURCE_DEFINITIONS.map(async (source) => {
      const response = await loaders[source.id]()
      return { ...source, ...sourceFinancialMetadata(source.id, response.data.data), rows: normalizeSource(source.id, response.data), summary: curatedSummary(response.data.data), origin: response.data.source || source.label }
    }))
    const sources = settled.map((result, index) => result.status === 'fulfilled' ? result.value : {
      ...SOURCE_DEFINITIONS[index], status: 'unavailable', rows: [],
    })
    const operations = await ledgerRequest;
    const records = mergeSalesOperations(sources.flatMap((source) => source.rows), operations.data || {});
    sources.push({ id: 'manual', label: 'Vendas manuais', platform: 'Manual', kind: 'sale', status: operations.status, rows: records.filter((row) => row.isManual) });
    const result = { date: daily ? startDate : null, startDate, endDate, sources, records, ledger: operations.data,
      operationsStatus: operations.status, operationsError: operations.error, fetchedAt: Date.now() }
    if (requestGeneration === generation) {
      if (cache.size >= 10) cache.delete(cache.keys().next().value)
      cache.set(key, result)
    }
    return result
  })()
  inflight.set(key, request)
  try { return await request } finally { if (inflight.get(key) === request) inflight.delete(key) }
}
