// src/services/tsApiService.js
import axios from 'axios';

// URL do backend - usar localhost:3000
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Busca dados de vendas do endpoint /api/tsales/sales
 * que já está configurado para usar TMB quando BOLETO_DATA_SOURCE=tmb
 */
export const getSales = async () => {
    try {
      console.log('Buscando dados de vendas da API backend (TMB)...');
      
      const response = await axios.get(`${API_BASE_URL}/tsales/sales`, {
        timeout: 120000, // 2 minutos de timeout para TMB
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Resposta da API:', response.data);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data || [],
          summary: response.data.summary || {}
        };
      }
      
      return {
        success: false,
        data: [],
        summary: {}
      };
    } catch (error) {
      console.error('Erro ao buscar dados de vendas:', error);
      
      // Se o backend não estiver rodando, retornar dados vazios
      if (error.code === 'ECONNREFUSED') {
        console.error('Backend não está rodando na porta 3000!');
      }
      
      return {
        success: false,
        message: 'Erro ao buscar dados de vendas',
        error: error.message,
        data: [],
        summary: {}
      };
    }
};

/**
 * Busca todos os dados da planilha através do endpoint /api/general/all-data
 */
export const getAllData = async () => {
    try {
      console.log('Buscando todos os dados da API backend...');
      
      const response = await axios.get(`${API_BASE_URL}/general/all-data`, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Resposta da API (dados gerais):', response.data);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data || [],
          summary: response.data.summary || {},
          fields: response.data.fields || [],
          total_records: response.data.total_records || 0
        };
      }
      
      return {
        success: false,
        data: [],
        summary: {},
        fields: [],
        total_records: 0
      };
    } catch (error) {
      console.error('Erro ao buscar dados gerais:', error);
      
      if (error.code === 'ECONNREFUSED') {
        console.error('Backend não está rodando na porta 3000!');
      }
      
      return {
        success: false,
        error: 'Erro ao buscar dados gerais',
        message: error.message,
        data: [],
        summary: {},
        fields: [],
        total_records: 0
      };
    }
};

/**
 * Busca dados de vendas TMB através do endpoint /api/boleto
 * Este endpoint já está configurado para usar a API TMB quando BOLETO_DATA_SOURCE=tmb
 */
export const getTMBSales = async (startDate, endDate) => {
  try {
    console.log(`Buscando vendas TMB de ${startDate} até ${endDate}...`);
    
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await axios.get(`${API_BASE_URL}/boleto/sales`, {
      params,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Vendas TMB recebidas:', response.data);
    
    return {
      success: true,
      data: response.data.data || [],
      summary: response.data.summary || {},
      source: response.data.source || 'tmb'
    };
  } catch (error) {
    console.error('Erro ao buscar vendas TMB:', error);
    
    return {
      success: false,
      message: error.message,
      data: [],
      summary: {}
    };
  }
};

/**
 * Busca resumo de vendas TMB
 */
export const getTMBSummary = async () => {
  try {
    console.log('Buscando resumo TMB...');
    
    const response = await axios.get(`${API_BASE_URL}/boleto/summary`, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Resumo TMB:', response.data);
    
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Erro ao buscar resumo TMB:', error);
    
    return {
      success: false,
      message: error.message
    };
  }
};