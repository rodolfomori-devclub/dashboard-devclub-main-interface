import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

const CACHE_TTL = 60 * 1000
const cache = new Map()

function cacheGet(key) {
  const e = cache.get(key)
  if (e && Date.now() - e.time < CACHE_TTL) return e.data
  return null
}

function cacheSet(key, data) {
  if (cache.size > 30) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0]
    if (oldest) cache.delete(oldest[0])
  }
  cache.set(key, { data, time: Date.now() })
}

export const activeCampaignService = {
  async getLists({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = cacheGet('lists')
      if (cached) return cached
    }
    const { data } = await api.get('/activecampaign/lists')
    cacheSet('lists', data)
    return data
  },

  async getListsSummary({ startDate, endDate } = {}) {
    const key = `summary:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get('/activecampaign/lists-summary', {
      params: { startDate, endDate },
    })
    cacheSet(key, data)
    return data
  },

  async getContacts({ startDate, endDate, listId, page = 1, limit = 20, search } = {}) {
    const { data } = await api.get('/activecampaign/contacts', {
      params: { startDate, endDate, listId, page, limit, search },
    })
    return data
  },

  async getTags({ limit = 100 } = {}) {
    const key = `tags:${limit}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get('/activecampaign/tags', { params: { limit } })
    cacheSet(key, data)
    return data
  },

  async getCampaigns({ startDate, endDate, limit = 50 } = {}) {
    const key = `campaigns:${startDate || ''}:${endDate || ''}:${limit}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get('/activecampaign/campaigns', {
      params: { startDate, endDate, limit },
    })
    cacheSet(key, data)
    return data
  },

  async getDailySeries({ startDate, endDate, listId } = {}) {
    const key = `daily:${startDate || ''}:${endDate || ''}:${listId || ''}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get('/activecampaign/daily-series', {
      params: { startDate, endDate, listId },
    })
    cacheSet(key, data)
    return data
  },

  async getEngagementSummary({ startDate, endDate } = {}) {
    const key = `engagement:${startDate || ''}:${endDate || ''}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get('/activecampaign/engagement-summary', {
      params: { startDate, endDate },
    })
    cacheSet(key, data)
    return data
  },

  clearCache() {
    cache.clear()
  },
}

export default activeCampaignService
