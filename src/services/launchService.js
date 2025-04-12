// src/services/leadSheetService.js
import axios from 'axios';

// ID da planilha do Google Sheets (extraído da URL fornecida)
const SHEET_ID = '11l2oWgWgOzZHKVSCh3HQanVirSvQPLT11UGr1IYZoeY';
// API Key (usando a mesma chave dos outros serviços)
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';
// Nome da aba específica que queremos consultar
const SHEET_NAME = 'Principal';

/**
 * Serviço para consulta de dados de leads do Google Sheets
 */
export const launchService = {
  // Armazenar os dados em cache após a primeira chamada
  _cachedData: null,
  _lastFetchTime: null,

  /**
   * Buscar dados da aba "Principal" da planilha
   * @returns {Promise<Array>} Array com os dados processados da planilha
   */
  async fetchSheetData() {
    // Se temos dados em cache e foram buscados há menos de 5 minutos, usar o cache
    const now = Date.now();
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < 5 * 60 * 1000)) {
      console.log('Usando dados em cache');
      return this._cachedData;
    }
    
    try {
      console.log(`Buscando dados da aba "${SHEET_NAME}"`);
      
      // Buscar os dados diretamente da aba "Principal"
      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${API_KEY}`;
      const response = await axios.get(valuesUrl);
      
      const rows = response.data.values || [];
      console.log(`Número de linhas na aba ${SHEET_NAME}: ${rows.length}`);
      
      if (rows.length <= 1) {
        console.log('Aba vazia ou contém apenas cabeçalhos');
        return [];
      }
      
      // Extrair os cabeçalhos
      const headers = rows[0].map(header => header.trim());
      console.log('Cabeçalhos encontrados:', headers);
      
      // Mapear os dados (pular a primeira linha, que são cabeçalhos)
      const processedData = rows.slice(1).map((row, index) => {
        // Criar um objeto com os dados da linha
        const rowData = {};
        
        // Associar cada valor ao seu cabeçalho
        headers.forEach((header, colIndex) => {
          rowData[header] = colIndex < row.length ? row[colIndex] : null;
        });
        
        // Adicionar um ID único para cada linha
        rowData.id = `lead-${index}-${Math.random().toString(36).substring(2, 10)}`;
        
        return rowData;
      });
      
      console.log(`Dados processados: ${processedData.length} itens válidos`);
      
      // Imprimir amostra dos dados no console
      console.log('Amostra dos dados (3 primeiros registros):');
      processedData.slice(0, 3).forEach((item, index) => {
        console.log(`Item ${index + 1}:`, item);
      });
      
      // Atualizar cache
      this._cachedData = processedData;
      this._lastFetchTime = now;
      
      return processedData;
    } catch (error) {
      console.error(`Erro ao buscar dados da aba "${SHEET_NAME}":`, error.response?.data || error.message);
      
      // Se o erro for específico de "aba não encontrada", fornecer informações adicionais
      if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('Unable to parse range')) {
        console.error(`A aba "${SHEET_NAME}" não foi encontrada. Tentando verificar as abas disponíveis...`);
        
        try {
          // Buscar informações sobre a planilha para mostrar as abas disponíveis
          const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
          const sheetsResponse = await axios.get(sheetsUrl);
          
          const sheets = sheetsResponse.data.sheets || [];
          const availableSheets = sheets.map(s => s.properties?.title).filter(Boolean);
          
          console.log('Abas disponíveis na planilha:', availableSheets);
          console.log(`Por favor, verifique se a aba "${SHEET_NAME}" existe ou use uma das abas disponíveis.`);
        } catch (sheetsError) {
          console.error('Erro ao buscar informações das abas disponíveis:', sheetsError);
        }
      }
      
      return [];
    }
  },

  /**
   * Método para teste - apenas para imprimir dados no console
   */
  async logDataToConsole() {
    try {
      const data = await this.fetchSheetData();
      console.log(`DADOS DA ABA "${SHEET_NAME}":`);
      console.log(`Total de ${data.length} registros encontrados`);
      
      if (data.length > 0) {
        // Mostrar estatísticas básicas
        console.log('Estrutura dos dados:');
        const sampleKeys = Object.keys(data[0]);
        console.log('Colunas disponíveis:', sampleKeys);
        
        // Mostrar os primeiros 5 registros completos
        console.log('Primeiros 5 registros:');
        data.slice(0, 5).forEach((item, idx) => {
          console.log(`Registro ${idx + 1}:`, item);
        });
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao realizar o log dos dados:', error);
      return [];
    }
  }
};

export default launchService;