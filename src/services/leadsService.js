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
})

let _allLeadsCache = null
let _allLeadsCacheTime = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Chave de cache inclui intervalo de datas para invalidar quando mudar o filtro
let _allLeadsCacheKey = null

export const leadsService = {
  // endDate é exclusivo na API — adiciona 1 dia automaticamente
  _buildDateParams(startDate, endDate) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) {
      const d = new Date(endDate)
      d.setDate(d.getDate() + 1)
      params.endDate = d.toISOString().split('T')[0]
    }
    return params
  },

  async fetchLeads({ page = 1, limit = 10, search = '', startDate = '', endDate = '' } = {}) {
    const params = { page, limit, ...this._buildDateParams(startDate, endDate) }
    if (search) params.search = search
    const response = await api.get('/leads', { params })
    return response.data
  },

  async fetchAllLeads({ startDate = '', endDate = '', forceRefresh = false } = {}) {
    const cacheKey = `${startDate}|${endDate}`
    const now = Date.now()
    if (
      !forceRefresh &&
      _allLeadsCache &&
      _allLeadsCacheTime &&
      _allLeadsCacheKey === cacheKey &&
      now - _allLeadsCacheTime < CACHE_TTL
    ) {
      return _allLeadsCache
    }

    const allLeads = []
    let page = 1
    const limit = 100
    let totalPages = 1

    while (page <= totalPages) {
      const data = await this.fetchLeads({ page, limit, startDate, endDate })
      allLeads.push(...data.leads)
      totalPages = data.totalPages || 1
      page++
    }

    _allLeadsCache = allLeads
    _allLeadsCacheTime = Date.now()
    _allLeadsCacheKey = cacheKey
    return allLeads
  },

  clearCache() {
    _allLeadsCache = null
    _allLeadsCacheTime = null
    _allLeadsCacheKey = null
  },
}
