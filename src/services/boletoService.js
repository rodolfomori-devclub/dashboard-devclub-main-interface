// src/services/boletoService.js
import boletoApiService from './boletoApiService';

/**
 * Serviço para consulta de vendas via boleto
 * Agora usa a API backend que pode buscar dados da TMB ou Google Sheets
 */
export const boletoService = {

  /**
   * Buscar todos os dados via API backend
   * @returns {Promise<Array>} Array com os dados processados
   */
  async fetchAllSheetData() {
    return boletoApiService.fetchAllData();
  },

  /**
   * Filtrar vendas por dia específico
   * @param {Date} date Data para filtrar
   * @returns {Promise<Array>} Vendas do dia especificado
   */
  async getSalesByDate(date) {
    return boletoApiService.getSalesByDate(date);
  },

  /**
   * Filtrar vendas por intervalo de datas
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Vendas no intervalo especificado
   */
  async getSalesByDateRange(startDate, endDate) {
    return boletoApiService.getSalesByDateRange(startDate, endDate);
  },

  /**
   * Filtrar vendas por mês específico
   * @param {number} year Ano
   * @param {number} month Mês (0-11)
   * @returns {Promise<Array>} Vendas do mês especificado
   */
  async getSalesByMonth(year, month) {
    return boletoApiService.getSalesByMonth(year, month);
  },

  /**
   * Filtrar vendas por ano específico
   * @param {number} year Ano
   * @returns {Promise<Array>} Vendas do ano especificado
   */
  async getSalesByYear(year) {
    return boletoApiService.getSalesByYear(year);
  },

  /**
   * Buscar status da integração
   * @returns {Promise<Object>} Informações sobre a fonte de dados
   */
  async getStatus() {
    return boletoApiService.getStatus();
  },

  /**
   * Limpar cache
   */
  clearCache() {
    return boletoApiService.clearCache();
  }
};

export default boletoService;