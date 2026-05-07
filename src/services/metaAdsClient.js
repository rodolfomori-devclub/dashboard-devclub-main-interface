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

export const metaAdsClient = {
  async fetchInsights({ startDate, endDate, accountId, level } = {}) {
    const key = `insights:${accountId || 'default'}:${startDate || ''}:${endDate || ''}:${level || ''}`
    const cached = cacheGet(key)
    if (cached) return cached

    const url = accountId ? `/meta/insights/${accountId}` : '/meta/insights'
    const { data } = await api.get(url, {
      params: { start_date: startDate, end_date: endDate, level },
    })
    cacheSet(key, data)
    return data
  },

  async fetchDailySpend({ days = 30, accountId } = {}) {
    const key = `dailySpend:${days}:${accountId || ''}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get(`/meta/daily-spend/${days}`, {
      params: { accountId },
    })
    cacheSet(key, data)
    return data
  },

  async fetchAllAccountsSpend({ days = 30 } = {}) {
    const key = `allAccountsSpend:${days}`
    const cached = cacheGet(key)
    if (cached) return cached
    const { data } = await api.get(`/meta/all-accounts-spend/${days}`)
    cacheSet(key, data)
    return data
  },

  async fetchAccounts() {
    const cached = cacheGet('accounts')
    if (cached) return cached
    const { data } = await api.get('/meta/accounts')
    cacheSet('accounts', data)
    return data
  },

  async fetchCampaigns({ accountId } = {}) {
    const url = accountId ? `/meta/campaigns/${accountId}` : '/meta/campaigns'
    const { data } = await api.get(url)
    return data
  },

  async testConnection() {
    const { data } = await api.get('/meta/test-connection')
    return data
  },

  clearCache() {
    cache.clear()
  },
}

export default metaAdsClient
