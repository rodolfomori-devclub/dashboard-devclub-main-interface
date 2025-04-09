// src/services/commercialService.js
import axios from 'axios';

// ID da planilha do Google Sheets com dados comerciais
const SHEET_ID = '1sLPgeIYpAGWnUXolgWqSskKhbWYmwZZXo-86EDHZ8lI';
// API Key
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';

/**
 * Serviço para consulta de vendas comerciais do Google Sheets
 * Implementação atualizada para buscar dados de todas as abas
 */
export const commercialService = {
  // Armazenar os dados em cache após a primeira chamada
  _cachedData: null,
  _lastFetchTime: null,
  _cachedVendors: null,
  _cachedProducts: null,
  
  /**
   * Extrair dia/mês/ano de uma string no formato DD/MM/YYYY
   * @param {string} dateStr String de data 
   * @returns {Object} Objeto com dia, mês e ano extraídos
   */
  _parseDateString(dateStr) {
    try {
      // Tentar diferentes formatos de data
      let dateParts;
      
      // Verificar se a data está no formato "DD/MM/YYYY"
      if (dateStr.includes('/')) {
        dateParts = dateStr.split('/').map(num => parseInt(num.trim(), 10));
        if (dateParts.length === 3) {
          return {
            day: dateParts[0],
            month: dateParts[1],
            year: dateParts[2]
          };
        }
      }
      
      // Verificar se a data está no formato "YYYY-MM-DD"
      if (dateStr.includes('-')) {
        dateParts = dateStr.split('-').map(num => parseInt(num.trim(), 10));
        if (dateParts.length === 3) {
          return {
            day: dateParts[2],
            month: dateParts[1],
            year: dateParts[0]
          };
        }
      }
      
      // Se não conseguir parsear, usar a data atual
      console.warn(`Data inválida: "${dateStr}", usando data atual como fallback`);
      const today = new Date();
      return {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      };
    } catch (error) {
      console.error(`Erro ao analisar data "${dateStr}":`, error);
      const today = new Date();
      return {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      };
    }
  },

  /**
   * Verificar se uma data está dentro de um intervalo
   * @param {Date} date Data a verificar
   * @param {Date} startDate Data de início
   * @param {Date} endDate Data final
   * @returns {boolean} Verdadeiro se a data estiver no intervalo
   */
  _isDateInRange(date, startDate, endDate) {
    return date >= startDate && date <= endDate;
  },

  /**
   * Buscar todos os dados de todas as abas da planilha
   * @returns {Promise<Array>} Array com os dados processados da planilha
   */
  async fetchAllSalesData() {
    // Se temos dados em cache e foram buscados há menos de 5 minutos, usar o cache
    const now = Date.now();
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < 5 * 60 * 1000)) {
      console.log('Usando dados comerciais em cache');
      return this._cachedData;
    }
    
    try {
      console.log('Buscando dados da planilha comercial (todas as abas)');
      
      // Buscar informações sobre a planilha para obter todas as abas
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
      const sheetsResponse = await axios.get(sheetsUrl);
      
      // Obter todas as abas
      const sheets = sheetsResponse.data.sheets || [];
      if (sheets.length === 0) {
        console.error('Nenhuma aba encontrada na planilha comercial');
        return [];
      }
      
      console.log(`Total de abas encontradas: ${sheets.length}`);
      
      // Buscar dados de todas as abas
      const allSales = [];
      
      for (const sheet of sheets) {
        const sheetName = sheet.properties?.title;
        if (!sheetName) continue;
        
        console.log(`Buscando dados da aba: ${sheetName}`);
        
        // Buscar os dados da aba
        const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
        const response = await axios.get(valuesUrl);
        
        const rows = response.data.values || [];
        console.log(`Número de linhas na aba ${sheetName}: ${rows.length}`);
        
        if (rows.length <= 1) {
          console.log(`Aba ${sheetName} vazia ou contém apenas cabeçalhos`);
          continue;
        }
        
        // Identificar cabeçalhos (para lidar com diferentes estruturas)
        const headers = rows[0].map(header => 
          header ? header.toLowerCase().trim() : ''
        );
        
        // Encontrar índices dos campos necessários
        const produtoIndex = headers.indexOf('produto') !== -1 ? 
          headers.indexOf('produto') : 0;
        
        const valorIndex = headers.indexOf('valor') !== -1 ? 
          headers.indexOf('valor') : 1;
        
        const vendedorIndex = headers.indexOf('vendedor') !== -1 ? 
          headers.indexOf('vendedor') : 2;
        
        const dataIndex = headers.indexOf('data') !== -1 ? 
          headers.indexOf('data') : 3;
        
        const pagamentoIndex = headers.indexOf('pagamento') !== -1 ? 
          headers.indexOf('pagamento') : headers.indexOf('meio de pagamento') !== -1 ? 
          headers.indexOf('meio de pagamento') : 4;
        
        const canalIndex = headers.indexOf('canal') !== -1 ? 
          headers.indexOf('canal') : 5;
        
        // Mapear os dados (pular a primeira linha, que são cabeçalhos)
        const sheetSales = rows.slice(1).map((row, index) => {
          // Verificar se a linha tem dados suficientes
          if (row.length < Math.max(produtoIndex, valorIndex, vendedorIndex, dataIndex) + 1) {
            return null;
          }
          
          try {
            // Obter valores com tratamento para evitar erros com campos ausentes
            const produto = row[produtoIndex] || 'Não especificado';
            
            // Tratar valor: remover formatação e converter para número
            let valor = 0;
            if (row[valorIndex]) {
              const valorStr = row[valorIndex].toString().replace(/[^0-9.,]/g, '').replace(',', '.');
              valor = parseFloat(valorStr) || 0;
            }
            
            const vendedor = row[vendedorIndex] || 'Desconhecido';
            const dataStr = row[dataIndex] || new Date().toLocaleDateString();
            const meioPagamento = row.length > pagamentoIndex ? row[pagamentoIndex] || 'Desconhecido' : 'Desconhecido';
            const canal = row.length > canalIndex ? row[canalIndex] || 'Desconhecido' : 'Desconhecido';
            
            // Processar a data
            const dateParts = this._parseDateString(dataStr);
            const timestamp = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
            
            // Criar objeto de venda
            return {
              id: `commercial-${sheetName}-${index}-${Math.random().toString(36).substring(2, 10)}`,
              product: produto.trim(),
              value: valor,
              seller: vendedor.trim(),
              paymentMethod: meioPagamento.trim(),
              channel: canal.trim(),
              date: {
                day: dateParts.day,
                month: dateParts.month,
                year: dateParts.year,
                formatted: `${dateParts.day}/${dateParts.month}/${dateParts.year}`
              },
              timestamp,
              sheetName // Manter referência da aba para depuração
            };
          } catch (err) {
            console.log(`Erro ao processar linha ${index + 2} da aba ${sheetName}:`, err.message);
            return null;
          }
        }).filter(item => item !== null);
        
        console.log(`Processadas ${sheetSales.length} vendas válidas na aba ${sheetName}`);
        
        // Adicionar vendas desta aba ao array total
        allSales.push(...sheetSales);
      }
      
      console.log(`Total de vendas comerciais processadas de todas as abas: ${allSales.length}`);
      
      // Extrair lista de vendedores únicos
      const uniqueVendors = [...new Set(allSales.map(sale => sale.seller))];
      this._cachedVendors = uniqueVendors.sort();
      console.log(`Vendedores encontrados: ${uniqueVendors.length}`);
      
      // Extrair lista de produtos únicos
      const uniqueProducts = [...new Set(allSales.map(sale => sale.product))];
      this._cachedProducts = uniqueProducts.sort();
      console.log(`Produtos encontrados: ${uniqueProducts.length}`);
      
      // Atualizar cache
      this._cachedData = allSales;
      this._lastFetchTime = now;
      
      return allSales;
    } catch (error) {
      console.error('Erro ao buscar dados da planilha comercial:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Obter lista de todos os vendedores
   * @returns {Promise<Array>} Array com nomes dos vendedores
   */
  async getVendors() {
    if (this._cachedVendors) {
      return this._cachedVendors;
    }
    
    // Se não tem em cache, buscar todos os dados para extrair vendedores
    await this.fetchAllSalesData();
    return this._cachedVendors || [];
  },

  /**
   * Obter lista de todos os produtos
   * @returns {Promise<Array>} Array com nomes dos produtos
   */
  async getProducts() {
    if (this._cachedProducts) {
      return this._cachedProducts;
    }
    
    // Se não tem em cache, buscar todos os dados para extrair produtos
    await this.fetchAllSalesData();
    return this._cachedProducts || [];
  },

  /**
   * Filtrar vendas por intervalo de datas
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Vendas no intervalo especificado
   */
  async getSalesByDateRange(startDate, endDate) {
    try {
      console.log(`Filtrando vendas entre ${startDate.toLocaleDateString()} e ${endDate.toLocaleDateString()}`);
      
      // Ajustar datas para comparação (ignorar a hora)
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      // Buscar todos os dados
      const allSales = await this.fetchAllSalesData();
      
      // Filtrar pelo intervalo de datas
      const filtered = allSales.filter(sale => 
        this._isDateInRange(sale.timestamp, startDateObj, endDateObj)
      );
      
      console.log(`Encontradas ${filtered.length} vendas comerciais no período`);
      
      return filtered;
    } catch (error) {
      console.error('Erro ao filtrar vendas por intervalo de datas:', error);
      return [];
    }
  },

  /**
   * Filtrar vendas por vendedor e intervalo de datas
   * @param {string} seller Nome do vendedor
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Vendas do vendedor no intervalo especificado
   */
  async getSalesBySeller(seller, startDate, endDate) {
    try {
      const salesInRange = await this.getSalesByDateRange(startDate, endDate);
      
      // Filtrar pelo vendedor
      const filteredBySeller = salesInRange.filter(sale => 
        sale.seller.toLowerCase() === seller.toLowerCase()
      );
      
      console.log(`Encontradas ${filteredBySeller.length} vendas para o vendedor "${seller}" no período`);
      
      return filteredBySeller;
    } catch (error) {
      console.error(`Erro ao filtrar vendas do vendedor "${seller}":`, error);
      return [];
    }
  },

  /**
   * Filtrar vendas por mês específico
   * @param {number} year Ano
   * @param {number} month Mês (1-12)
   * @returns {Promise<Array>} Vendas do mês especificado
   */
  async getSalesByMonth(year, month) {
    try {
      console.log(`Filtrando vendas para o mês ${month}/${year}`);
      
      // Definir primeiro e último dia do mês
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      return this.getSalesByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Erro ao filtrar vendas por mês:', error);
      return [];
    }
  },

  /**
   * Filtrar vendas por ano específico
   * @param {number} year Ano
   * @returns {Promise<Array>} Vendas do ano especificado
   */
  async getSalesByYear(year) {
    try {
      console.log(`Filtrando vendas para o ano ${year}`);
      
      // Definir primeiro e último dia do ano
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      
      return this.getSalesByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Erro ao filtrar vendas por ano:', error);
      return [];
    }
  }
};

export default commercialService;