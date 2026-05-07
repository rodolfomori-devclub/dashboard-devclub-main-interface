import axios from 'axios'

const API_KEY = import.meta.env.VITE_LEADS_API_KEY

// Em desenvolvimento usa o proxy do Vite para evitar CORS
// Em produção usa a URL direta (a API tem CORS liberado para o domínio de prod)
const isDev = import.meta.env.DEV
const BASE_URL = isDev ? '/leads-proxy' : import.meta.env.VITE_LEADS_API_URL

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': API_KEY,
  },
  timeout: 30000,
})

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map()

function cacheGet(key) {
  const e = cache.get(key)
  if (e && Date.now() - e.time < CACHE_TTL) return e.data
  return null
}

function cacheSet(key, data) {
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0]
    if (oldest) cache.delete(oldest[0])
  }
  cache.set(key, { data, time: Date.now() })
}

// endDate é exclusivo na API — adiciona 1 dia automaticamente
function buildDateParams(startDate, endDate) {
  const params = {}
  if (startDate) params.startDate = startDate
  if (endDate) {
    const d = new Date(endDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    params.endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return params
}

function buildFilterParams({ startDate, endDate, search, isBuyer, utmSource, utmMedium, utmCampaign, tags, orderBy, order } = {}) {
  const params = { ...buildDateParams(startDate, endDate) }
  if (search) params.search = search
  if (isBuyer !== undefined && isBuyer !== null && isBuyer !== '') params.isBuyer = isBuyer
  if (utmSource) params.utmSource = Array.isArray(utmSource) ? utmSource.join(',') : utmSource
  if (utmMedium) params.utmMedium = Array.isArray(utmMedium) ? utmMedium.join(',') : utmMedium
  if (utmCampaign) params.utmCampaign = Array.isArray(utmCampaign) ? utmCampaign.join(',') : utmCampaign
  if (tags) params.tags = Array.isArray(tags) ? tags.join(',') : tags
  if (orderBy) params.orderBy = orderBy
  if (order) params.order = order
  return params
}

export const leadsService = {
  // ============ SURVEY LEADS (resposta de pesquisa) ============

  async fetchLeads({ page = 1, limit = 10, ...filters } = {}) {
    const params = { page, limit, ...buildFilterParams(filters) }
    const { data } = await api.get('/leads', { params })
    return data
  },

  async fetchSurveyCount({ startDate, endDate } = {}) {
    const cacheKey = `surveyCount:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(cacheKey)
    if (cached !== null) return cached
    const data = await this.fetchLeads({ page: 1, limit: 1, startDate, endDate })
    const total = data.total || 0
    cacheSet(cacheKey, total)
    return total
  },

  async fetchAllSurveyLeads({ startDate, endDate, maxRecords = 10000, forceRefresh = false } = {}) {
    const cacheKey = `allSurvey:${startDate || ''}:${endDate || ''}`
    if (!forceRefresh) {
      const cached = cacheGet(cacheKey)
      if (cached) return cached
    }
    const all = []
    let page = 1
    const limit = 100
    let totalPages = 1
    while (page <= totalPages && all.length < maxRecords) {
      const data = await this.fetchLeads({ page, limit, startDate, endDate })
      all.push(...(data.leads || []))
      totalPages = data.totalPages || 1
      page++
    }
    cacheSet(cacheKey, all)
    return all
  },

  // alias retrocompatível (LeadsPage.jsx)
  async fetchAllLeads(opts = {}) {
    return this.fetchAllSurveyLeads(opts)
  },

  // ============ CLIENTS (leads captados) ============

  async fetchClients({ page = 1, limit = 20, ...filters } = {}) {
    const params = { page, limit, ...buildFilterParams(filters) }
    const { data } = await api.get('/clients', { params })
    return data
  },

  async fetchClientsCount(filters = {}) {
    const cacheKey = `clientsCount:${JSON.stringify(filters)}`
    const cached = cacheGet(cacheKey)
    if (cached !== null) return cached
    const data = await this.fetchClients({ ...filters, page: 1, limit: 1 })
    const total = data.total || 0
    cacheSet(cacheKey, total)
    return total
  },

  async fetchAllClients({ maxRecords = 10000, ...filters } = {}) {
    const cacheKey = `allClients:${JSON.stringify(filters)}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached
    const all = []
    let page = 1
    const limit = 100
    let totalPages = 1
    while (page <= totalPages && all.length < maxRecords) {
      const data = await this.fetchClients({ ...filters, page, limit })
      all.push(...(data.clients || []))
      totalPages = data.totalPages || 1
      page++
    }
    cacheSet(cacheKey, all)
    return all
  },

  async fetchClientActivities(email) {
    if (!email) return []
    const { data } = await api.get(`/clients/${encodeURIComponent(email)}/activities`)
    return data
  },

  // ============ METRICS ============

  async fetchOverview({ startDate, endDate } = {}) {
    const cacheKey = `overview:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached
    const params = buildDateParams(startDate, endDate)
    const { data } = await api.get('/metrics/overview', { params })
    cacheSet(cacheKey, data)
    return data
  },

  async fetchBuyersMetrics({ startDate, endDate } = {}) {
    const cacheKey = `buyers:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached
    const params = buildDateParams(startDate, endDate)
    const { data } = await api.get('/metrics/buyers', { params })
    cacheSet(cacheKey, data)
    return data
  },

  async fetchAttribution({ startDate, endDate } = {}) {
    const cacheKey = `attribution:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached
    const params = buildDateParams(startDate, endDate)
    const { data } = await api.get('/metrics/attribution', { params })
    cacheSet(cacheKey, data)
    return data
  },

  async fetchTagsMetrics({ startDate, endDate } = {}) {
    const cacheKey = `tags:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached
    const params = buildDateParams(startDate, endDate)
    const { data } = await api.get('/metrics/tags', { params })
    cacheSet(cacheKey, data)
    return data
  },

  async fetchRealTime() {
    // sem cache (é real-time)
    const { data } = await api.get('/metrics/real-time')
    return data
  },

  // ============ CACHE ============

  clearCache() {
    cache.clear()
  },
}

export default leadsService
