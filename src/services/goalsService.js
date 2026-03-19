// src/services/goalsService.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Serviço para gerenciar metas de vendas via backend PostgreSQL
 */
export const goalsService = {
  /**
   * Buscar meta geral para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @param {string} goalType - Tipo de objetivo: 'meta', 'superMeta', 'ultraMeta'
   * @returns {Promise<number>} Valor da meta
   */
  async getGoal(type, year, month = null, goalType = 'meta') {
    try {
      let url;
      if (type === 'month' && month) {
        url = `${API_URL}/goals/${type}/${year}/${month}`;
      } else if (type === 'year') {
        url = `${API_URL}/goals/${type}/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }

      const response = await axios.get(url);

      if (response.data?.success && response.data?.data) {
        return response.data.data[goalType] || 0;
      }

      return 0;
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
      return 0;
    }
  },

  /**
   * Salvar meta geral para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @param {string} goalType - Tipo de objetivo: 'meta', 'superMeta', 'ultraMeta'
   * @param {number} value - Valor da meta
   * @returns {Promise<void>}
   */
  async saveGoal(type, year, month = null, goalType = 'meta', value) {
    try {
      let url;
      if (type === 'month' && month) {
        url = `${API_URL}/goals/${type}/${year}/${month}`;
      } else if (type === 'year') {
        url = `${API_URL}/goals/${type}/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }

      await axios.post(url, { goalType, value });
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      throw error;
    }
  },

  /**
   * Buscar todas as metas para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @returns {Promise<Object>} Objeto com todas as metas (meta, superMeta, ultraMeta)
   */
  async getAllGoals(type, year, month = null) {
    try {
      let url;
      if (type === 'month' && month) {
        url = `${API_URL}/goals/${type}/${year}/${month}`;
      } else if (type === 'year') {
        url = `${API_URL}/goals/${type}/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }

      const response = await axios.get(url);

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        return {
          meta: data.meta || 0,
          superMeta: data.superMeta || 0,
          ultraMeta: data.ultraMeta || 0
        };
      }

      return {
        meta: 0,
        superMeta: 0,
        ultraMeta: 0
      };
    } catch (error) {
      console.error('Erro ao buscar metas:', error);
      return {
        meta: 0,
        superMeta: 0,
        ultraMeta: 0
      };
    }
  },

  /**
   * Buscar metas de faturamento para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @returns {Promise<Object>} Objeto com todas as metas de faturamento
   */
  async getRevenueGoals(type, year, month = null) {
    try {
      let url;
      if (type === 'month' && month) {
        url = `${API_URL}/goals/revenue/${type}/${year}/${month}`;
      } else if (type === 'year') {
        url = `${API_URL}/goals/revenue/${type}/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }

      const response = await axios.get(url);

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        return {
          faturamentoCartao: {
            base: data.faturamentoCartao?.base || 0,
            super: data.faturamentoCartao?.super || 0,
            ultra: data.faturamentoCartao?.ultra || 0
          },
          faturamentoBoleto: {
            base: data.faturamentoBoleto?.base || 0,
            super: data.faturamentoBoleto?.super || 0,
            ultra: data.faturamentoBoleto?.ultra || 0
          },
          investimentoTrafego: {
            base: data.investimentoTrafego?.base || 0,
            super: data.investimentoTrafego?.super || 0,
            ultra: data.investimentoTrafego?.ultra || 0
          }
        };
      }

      return {
        faturamentoCartao: { base: 0, super: 0, ultra: 0 },
        faturamentoBoleto: { base: 0, super: 0, ultra: 0 },
        investimentoTrafego: { base: 0, super: 0, ultra: 0 }
      };
    } catch (error) {
      console.error('Erro ao buscar metas de faturamento:', error);
      return {
        faturamentoCartao: { base: 0, super: 0, ultra: 0 },
        faturamentoBoleto: { base: 0, super: 0, ultra: 0 },
        investimentoTrafego: { base: 0, super: 0, ultra: 0 }
      };
    }
  },

  /**
   * Salvar metas de faturamento para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @param {Object} goals - Objeto com as metas de faturamento
   * @returns {Promise<void>}
   */
  async saveRevenueGoals(type, year, month = null, goals) {
    try {
      let url;
      if (type === 'month' && month) {
        url = `${API_URL}/goals/revenue/${type}/${year}/${month}`;
      } else if (type === 'year') {
        url = `${API_URL}/goals/revenue/${type}/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }

      await axios.post(url, goals);
    } catch (error) {
      console.error('Erro ao salvar metas de faturamento:', error);
      throw error;
    }
  },

  /**
   * Buscar todas as metas de faturamento de um ano (todos os meses)
   * @param {number} year - Ano das metas
   * @returns {Promise<Object>} Objeto com metas de cada mês
   */
  async getYearlyRevenueGoalsBreakdown(year) {
    try {
      const response = await axios.get(`${API_URL}/goals/revenue/yearly/${year}/breakdown`);

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }

      return {};
    } catch (error) {
      console.error('Erro ao buscar metas do ano:', error);
      return {};
    }
  },

  /**
   * Buscar meta individual de um vendedor para um período
   * @param {string} sellerId - ID do vendedor
   * @param {number} year - Ano da meta
   * @param {number} month - Mês da meta (1-12)
   * @returns {Promise<number>} Valor da meta
   */
  async getSellerGoal(sellerId, year, month) {
    try {
      const response = await axios.get(`${API_URL}/goals/seller/${sellerId}/${year}/${month}`);

      if (response.data?.success && response.data?.data) {
        return response.data.data.value || 0;
      }

      return 0;
    } catch (error) {
      console.error(`Erro ao buscar meta do vendedor ${sellerId}:`, error);
      return 0;
    }
  },

  /**
   * Salvar meta individual de um vendedor para um período
   * @param {string} sellerId - ID do vendedor
   * @param {string} sellerName - Nome do vendedor
   * @param {number} year - Ano da meta
   * @param {number} month - Mês da meta (1-12)
   * @param {number} value - Valor da meta
   * @returns {Promise<void>}
   */
  async saveSellerGoal(sellerId, sellerName, year, month, value) {
    try {
      await axios.post(`${API_URL}/goals/seller/${sellerId}/${year}/${month}`, {
        value,
        sellerName
      });
    } catch (error) {
      console.error(`Erro ao salvar meta do vendedor ${sellerId}:`, error);
      throw error;
    }
  },

  /**
   * Buscar todas as metas individuais dos vendedores para um período
   * @param {number} year - Ano das metas
   * @param {number} month - Mês das metas (1-12)
   * @returns {Promise<Array>} Array com objetos de metas dos vendedores
   */
  async getAllSellerGoals(year, month) {
    try {
      const sellerGoals = [];

      // Não temos uma maneira direta de consultar todos os IDs de vendedores
      // Uma opção seria manter uma lista de vendedores em um documento separado
      // Por enquanto, vamos retornar um array vazio

      return sellerGoals;
    } catch (error) {
      console.error('Erro ao buscar metas dos vendedores:', error);
      return [];
    }
  }
};

export default goalsService;
