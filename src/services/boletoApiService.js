// src/services/boletoApiService.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Serviço para consulta de vendas via boleto usando a API backend
 * Pode usar TMB API ou Google Sheets conforme configurado no backend
 */
export const boletoApiService = {
  // Cache local
  _cachedData: null,
  _lastFetchTime: null,
  _cacheTimeout: 5 * 60 * 1000, // 5 minutos

  /**
   * Buscar todos os pedidos de boleto
   * @returns {Promise<Array>} Array com os dados processados
   */
  async fetchAllData() {
    const now = Date.now();
    
    // Usar cache se disponível e recente
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < this._cacheTimeout)) {
      console.log('Usando dados de boleto em cache');
      return this._cachedData;
    }

    try {
      console.log('Buscando dados de boleto da API...');
      const response = await axios.get(`${API_URL}/boleto/pedidos`);
      
      if (response.data.success) {
        const data = response.data.data || [];
        console.log(`Dados recebidos: ${data.length} pedidos`);
        console.log(`Fonte de dados: ${response.data.source}`);
        
        // Atualizar cache
        this._cachedData = data;
        this._lastFetchTime = now;
        
        return data;
      } else {
        console.error('Erro na resposta da API:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar dados de boleto:', error);
      
      // Retornar cache se disponível, mesmo que expirado
      if (this._cachedData) {
        console.log('Usando cache antigo devido a erro na API');
        return this._cachedData;
      }
      
      return [];
    }
  },

  /**
   * Buscar vendas por data específica
   * @param {Date} date Data para filtrar
   * @returns {Promise<Array>} Vendas do dia especificado
   */
  async getSalesByDate(date) {
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      console.log(`Buscando vendas de boleto para ${dateStr}`);
      
      const response = await axios.get(`${API_URL}/boleto/vendas/data`, {
        params: { date: dateStr }
      });
      
      if (response.data.success) {
        const data = response.data.data || [];
        console.log(`Encontradas ${data.length} vendas para ${dateStr}`);
        return data;
      } else {
        console.error('Erro na resposta da API:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar vendas por data:', error);
      return [];
    }
  },

  /**
   * Buscar vendas por intervalo de datas
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Vendas no intervalo especificado
   */
  async getSalesByDateRange(startDate, endDate) {
    try {
      const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`Buscando vendas de boleto entre ${startStr} e ${endStr}`);
      
      const response = await axios.get(`${API_URL}/boleto/vendas/periodo`, {
        params: {
          data_inicio: startStr,
          data_final: endStr
        }
      });
      
      if (response.data.success) {
        const data = response.data.data || [];
        console.log(`Encontradas ${data.length} vendas no período`);
        return data;
      } else {
        console.error('Erro na resposta da API:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar vendas por período:', error);
      return [];
    }
  },

  /**
   * Buscar vendas por mês específico
   * @param {number} year Ano
   * @param {number} month Mês (0-11)
   * @returns {Promise<Array>} Vendas do mês especificado
   */
  async getSalesByMonth(year, month) {
    try {
      console.log(`🔍 Buscando vendas de boleto para ${month + 1}/${year}`);
      console.log(`⏱️  Timeout: 10 minutos (API TMB pode ser muito lenta)`);

      const response = await axios.get(`${API_URL}/boleto/vendas/mes`, {
        params: { year, month },
        timeout: 600000, // 10 minutos de timeout (API TMB é MUITO lenta)
        onDownloadProgress: (progressEvent) => {
          // Mostrar progresso se disponível
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📥 Download: ${percentCompleted}%`);
          }
        }
      });

      if (response.data.success) {
        const data = response.data.data || [];
        console.log(`✅ Encontradas ${data.length} vendas para ${month + 1}/${year}`);

        // Avisar se recebeu dados parciais
        if (response.data.partial) {
          console.warn(`⚠️  ATENÇÃO: Dados parciais retornados (algumas semanas falharam)`);
        }

        return data;
      } else {
        console.error('Erro na resposta da API:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao buscar vendas por mês:', error);

      // Se foi timeout, dar uma dica
      if (error.code === 'ECONNABORTED') {
        console.error('⏱️  Timeout: A API TMB demorou mais de 10 minutos.');
        console.error('💡 Recomendação: Use Google Sheets como fonte de dados.');
      }

      return [];
    }
  },

  /**
   * Buscar vendas por ano específico
   * @param {number} year Ano
   * @returns {Promise<Array>} Vendas do ano especificado
   */
  async getSalesByYear(year) {
    try {
      console.log(`Buscando vendas de boleto para o ano ${year}`);

      const response = await axios.get(`${API_URL}/boleto/vendas/ano`, {
        params: { year },
        timeout: 300000 // 5 minutos de timeout para consultas anuais
      });

      if (response.data.success) {
        const data = response.data.data || [];
        console.log(`Encontradas ${data.length} vendas para o ano ${year}`);
        return data;
      } else {
        console.error('Erro na resposta da API:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar vendas por ano:', error);
      return [];
    }
  },

  /**
   * Buscar status da integração
   * @returns {Promise<Object>} Informações sobre a fonte de dados
   */
  async getStatus() {
    try {
      const response = await axios.get(`${API_URL}/boleto/status`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      return {
        success: false,
        error: 'Não foi possível verificar o status'
      };
    }
  },

  /**
   * Limpar cache
   */
  clearCache() {
    this._cachedData = null;
    this._lastFetchTime = null;
    console.log('Cache de boletos limpo');
  },

  // Manter compatibilidade com o código existente
  async fetchAllSheetData() {
    return this.fetchAllData();
  }
};

export default boletoApiService;