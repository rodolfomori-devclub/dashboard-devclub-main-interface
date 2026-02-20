import axios from 'axios'

const isDev = import.meta.env.DEV
const BASE_URL = isDev
  ? '/monitoring-proxy'
  : 'https://smart-ads-api-gazrm25mda-uc.a.run.app/monitoring'

// Cache por chave de período
const _cache = {}
const _cacheTime = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const monitoringService = {
  /**
   * Busca dados de monitoramento.
   * - Se startDate + endDate fornecidos: usa start_date/end_date (ignora hours)
   * - Se vazio ("Tudo"): usa hours=8760 (~1 ano)
   */
  async fetchDailyCheck({ startDate = '', endDate = '' } = {}) {
    const cacheKey = startDate && endDate ? `${startDate}|${endDate}` : 'all'
    const now = Date.now()

    if (_cache[cacheKey] && _cacheTime[cacheKey] && now - _cacheTime[cacheKey] < CACHE_TTL) {
      return _cache[cacheKey]
    }

    const params = startDate && endDate
      ? { start_date: startDate, end_date: endDate }
      : { hours: 8760 }

    const response = await axios.get(`${BASE_URL}/daily-check/railway`, { params })
    _cache[cacheKey] = response.data
    _cacheTime[cacheKey] = Date.now()
    return _cache[cacheKey]
  },

  clearCache() {
    Object.keys(_cache).forEach(k => delete _cache[k])
    Object.keys(_cacheTime).forEach(k => delete _cacheTime[k])
  },
}
