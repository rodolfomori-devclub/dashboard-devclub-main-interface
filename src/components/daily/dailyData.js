import axios from 'axios'
import { sourceFinancialMetadata } from '../../utils/sourceAvailability.js'
import { normalizeSource, SOURCE_DEFINITIONS } from '../../utils/salesData.js'
import { getSalesLedger, mergeSalesOperations } from '../../services/salesOpsService.js'
import { invalidateAsaasCashCache } from '../../services/asaasCashService.js'

const cache = new Map()
const inflight = new Map()
const TTL = 60_000
let generation = 0
export function invalidateSalesCache() { generation++; cache.clear(); inflight.clear(); invalidateAsaasCashCache() }
export const salesCacheGeneration = () => generation
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

export function validateSalesRange(startDate, endDate) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error('Período inválido')
}

export function normalizeProviderSource(sourceId, payload) {
  const source = SOURCE_DEFINITIONS.find(item => item.id === sourceId)
  if (!source) throw new Error('Fonte desconhecida')
  return { ...source, ...sourceFinancialMetadata(sourceId, payload?.data), rows: normalizeSource(sourceId, payload), summary: curatedSummary(payload.data), origin: payload.source || source.label }
}

// Providers may be reused; the ledger is deliberately read again for each load.
// Cached transactions never retain an old seller overlay or reconciled manual.
export async function mergeFreshSalesLedger(result, startDate, endDate, fetchLedger = getSalesLedger) {
  const operations = await fetchLedger(startDate, endDate).then(data => ({ data, status: 'ready' }), error => ({ data: null, status: 'unavailable', error: error.message }))
  const records = mergeSalesOperations(result.records || result.sources.flatMap(source => source.rows), operations.data || {})
  const sources = result.sources.filter(source => source.id !== 'manual').map(source => ({ ...source, rows: records.filter(row => row.sourceId === source.id) }))
  sources.push({ id: 'manual', label: 'Vendas manuais', platform: 'Manual', kind: 'sale', status: operations.status, rows: records.filter(row => row.isManual) })
  return { ...result, sources, records, ledger: operations.data, operationsStatus: operations.status, operationsError: operations.error }
}

export async function loadSalesRange(startDate, endDate, options = {}) {
  validateSalesRange(startDate, endDate)
  const providers = await loadProviders(startDate, endDate, options)
  return mergeFreshSalesLedger(providers, startDate, endDate)
}

async function loadProviders(startDate, endDate, { force = false, includeAsaas = true } = {}) {
  const key = `${startDate}:${endDate}:asaas=${includeAsaas}`
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
    const settled = await Promise.allSettled(SOURCE_DEFINITIONS.map(async (source) => {
      if (source.id === 'asaas' && !includeAsaas) return { ...source, status: 'not_requested', salesAvailable: false, reason: 'annual_cash_on_demand', rows: [], cash: null }
      const response = await loaders[source.id]()
      return normalizeProviderSource(source.id, response.data)
    }))
    const sources = settled.map((result, index) => result.status === 'fulfilled' ? result.value : {
      ...SOURCE_DEFINITIONS[index], status: 'unavailable', rows: [],
    })
    const result = { date: daily ? startDate : null, startDate, endDate, sources, fetchedAt: Date.now() }
    if (requestGeneration === generation) {
      if (cache.size >= 10) cache.delete(cache.keys().next().value)
      cache.set(key, result)
    }
    return result
  })()
  inflight.set(key, request)
  try { return await request } finally { if (inflight.get(key) === request) inflight.delete(key) }
}
