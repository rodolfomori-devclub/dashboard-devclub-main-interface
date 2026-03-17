import axios from 'axios';

const isDev = import.meta.env.DEV;

const api = axios.create({
  baseURL: isDev ? 'http://localhost:3000/api' : import.meta.env.VITE_API_URL,
  timeout: 60000
});

// Caching simples com TTL em memória
let _cache = {
  data: null,
  timestamp: null,
  TTL: 30 * 1000 // 30 segundos
};

export const vidometroService = {
  /**
   * Busca dados do Vidômetro do backend
   */
  async fetchVidometroData() {
    const now = Date.now();

    // Verificar cache local
    if (_cache.data && _cache.timestamp && (now - _cache.timestamp < _cache.TTL)) {
      return {
        ...(_cache.data || {}),
        cacheAge: now - _cache.timestamp,
        fromLocalCache: true
      };
    }

    try {
      const response = await api.get('/vidometro');

      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;

        // Atualizar cache
        _cache.data = data;
        _cache.timestamp = now;

        return {
          ...data,
          cacheAge: 0,
          fromLocalCache: false
        };
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dados vidômetro:', error.message);

      // Retornar cache antigo se disponível
      if (_cache.data) {
        const age = now - _cache.timestamp;
        return {
          ...(_cache.data || {}),
          cacheAge: age,
          fromLocalCache: true,
          stale: true,
          error: error.message
        };
      }

      throw error;
    }
  },

  clearCache() {
    _cache.data = null;
    _cache.timestamp = null;
  }
};

export default vidometroService;
