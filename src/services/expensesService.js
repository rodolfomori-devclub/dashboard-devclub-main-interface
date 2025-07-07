// src/services/expensesService.js
import axios from 'axios';

// ID da planilha do Google Sheets com despesas
const SHEET_ID = '1cvaU5eUOez8F_1c0Xn3zRJTSFFHblSEJLoK7ZW9dUt8';
// API Key
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';

/**
 * Serviço para consulta de despesas do Google Sheets
 * Implementação para buscar dados de todas as abas
 */
export const expensesService = {
  // Armazenar os dados em cache após a primeira chamada
  _cachedData: null,
  _lastFetchTime: null,
  _cachedTags: null,
  
  /**
   * Extrair dia/mês/ano de uma string no formato DD/MM/YYYY
   * @param {string} dateStr String de data no formato DD/MM/YYYY
   * @returns {Object} Objeto com dia, mês e ano extraídos
   */
  _parseDateString(dateStr) {
    try {
      // Considerar apenas a parte da data (ignorar a hora se houver)
      const datePart = dateStr.split(' ')[0];
      const [day, month, year] = datePart.split('/').map(num => parseInt(num.trim(), 10));
      
      // Validar data para evitar valores inválidos
      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        console.warn(`Data inválida: "${dateStr}", usando data atual como fallback`);
        const today = new Date();
        return {
          day: today.getDate(),
          month: today.getMonth() + 1,
          year: today.getFullYear()
        };
      }
      
      return { day, month, year };
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
   * @param {string} dateStr String de data (YYYY-MM-DD)
   * @param {Date} startDate Data de início
   * @param {Date} endDate Data final
   * @returns {boolean} Verdadeiro se a data estiver no intervalo
   */
  _isDateInRange(dateStr, startDate, endDate) {
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate;
  },

  /**
   * Buscar todos os dados de todas as abas da planilha
   * @returns {Promise<Array>} Array com os dados processados de todas as abas
   */
  async fetchAllSheetData() {
    // Se temos dados em cache e foram buscados há menos de 5 minutos, usar o cache
    const now = Date.now();
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < 5 * 60 * 1000)) {
      console.log('Usando dados de despesas em cache');
      return this._cachedData;
    }
    
    try {
      console.log('Buscando dados da planilha de despesas');
      
      // Primeiro, vamos buscar informações sobre a planilha
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
      const sheetsResponse = await axios.get(sheetsUrl);

      console.log(sheetsResponse)
      
      // Obter todas as abas
      const sheets = sheetsResponse.data.sheets || [];
      if (sheets.length === 0) {
        console.error('Nenhuma aba encontrada na planilha de despesas');
        return [];
      }
      
      // Buscar dados de todas as abas
      const allExpenses = [];
      
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
        const headers = rows[0].map(header => header.toLowerCase().trim());
        const nameIndex = headers.indexOf('nome');
        const categoryIndex = headers.indexOf('categoria');
        const valueIndex = headers.indexOf('valor');
        const dateIndex = headers.indexOf('data');
        const tagIndex = headers.indexOf('tag');
        
        // Verificar se encontrou os campos obrigatórios
        if (nameIndex === -1 || valueIndex === -1 || dateIndex === -1) {
          console.error(`Aba ${sheetName} não contém os campos obrigatórios (nome, valor, data)`);
          continue;
        }
        
        // Mapear os dados (pular a primeira linha, que são cabeçalhos)
        const sheetExpenses = rows.slice(1).map((row, index) => {
          // Verificar se a linha tem dados suficientes
          if (row.length < Math.max(nameIndex, valueIndex, dateIndex) + 1) {
            return null;
          }
          
          try {
            const name = row[nameIndex];
            const category = categoryIndex >= 0 ? row[categoryIndex] : null;
            const dateStr = row[dateIndex];
            const tag = tagIndex >= 0 ? row[tagIndex] : null;
            
            // Se faltam campos importantes, pular
            if (!name || !dateStr) {
              return null;
            }
            
            // Processar o valor
            let expenseValue = 0;
            if (row[valueIndex]) {
              // Converter para número, considerando formato brasileiro (13.912,10)
              // Primeiro remove símbolos de moeda e espaços
              let rawValue = row[valueIndex].toString().replace(/[R$\s]/g, '').trim();
              // Remove pontos que são separadores de milhares
              rawValue = rawValue.replace(/\./g, '');
              // Substitui vírgula por ponto para separador decimal
              rawValue = rawValue.replace(',', '.');
              expenseValue = parseFloat(rawValue) || 0;
            }
            
            // Extrair a data
            const dateParts = this._parseDateString(dateStr);
            const formattedDate = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
            
            // Criar objeto com as informações da despesa
            return {
              id: `${sheetName}-${index}-${Math.random().toString(36).substring(2, 10)}`,
              name: name.trim(),
              category: category ? category.trim() : null,
              tag: tag ? tag.trim() : null,
              value: expenseValue,
              date: formattedDate,
              sheetName: sheetName
            };
          } catch (err) {
            console.log(`Erro ao processar linha ${index + 2} da aba ${sheetName}:`, err.message);
            return null;
          }
        }).filter(item => item !== null);
        
        // Adicionar despesas desta aba ao array total
        allExpenses.push(...sheetExpenses);
      }
      
      console.log(`Total de despesas processadas: ${allExpenses.length}`);
      
      // Atualizar cache
      this._cachedData = allExpenses;
      this._lastFetchTime = now;
      
      return allExpenses;
    } catch (error) {
      console.error('Erro ao buscar dados de despesas:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Obter todas as tags únicas das despesas
   * @returns {Promise<Array>} Array com todas as tags
   */
  async getAllTags() {
    // Verificar se já temos as tags em cache
    if (this._cachedTags) {
      return this._cachedTags;
    }
    
    try {
      // Buscar todos os dados da planilha
      const allExpenses = await this.fetchAllSheetData();
      
      // Extrair todas as tags únicas e não vazias
      const uniqueTags = new Set();
      
      allExpenses.forEach(expense => {
        if (expense.tag && expense.tag.trim()) {
          uniqueTags.add(expense.tag.trim());
        }
      });
      
      const tags = Array.from(uniqueTags).sort();
      
      // Atualizar cache
      this._cachedTags = tags;
      
      return tags;
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      return [];
    }
  },

  /**
   * Filtrar despesas por intervalo de datas e tag opcional
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @param {string} tag Tag opcional para filtrar
   * @returns {Promise<Array>} Despesas no intervalo especificado
   */
  async getExpensesByDateRange(startDate, endDate, tag = '') {
    try {
      console.log(`Filtrando despesas entre ${startDate.toLocaleDateString()} e ${endDate.toLocaleDateString()}${tag ? `, tag: ${tag}` : ''}`);
      
      // Ajustar datas para comparação (ignorar a hora)
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      // Buscar todos os dados
      const allExpenses = await this.fetchAllSheetData();
      
      // Filtrar pelo intervalo de datas e tag (se fornecida)
      const filtered = allExpenses.filter(expense => {
        const inRange = this._isDateInRange(expense.date, startDateObj, endDateObj);
        const matchesTag = !tag || (expense.tag && expense.tag.toLowerCase() === tag.toLowerCase());
        
        return inRange && matchesTag;
      });
      
      console.log(`Encontradas ${filtered.length} despesas no período${tag ? ` com a tag "${tag}"` : ''}`);
      
      return filtered;
    } catch (error) {
      console.error('Erro ao filtrar despesas:', error);
      return [];
    }
  },

  /**
   * Filtrar despesas por mês específico e tag opcional
   * @param {number} year Ano
   * @param {number} month Mês (0-11)
   * @param {string} tag Tag opcional para filtrar
   * @returns {Promise<Array>} Despesas do mês especificado
   */
  async getExpensesByMonth(year, month, tag = '') {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    return this.getExpensesByDateRange(startDate, endDate, tag);
  },

  /**
   * Filtrar despesas por ano específico e tag opcional
   * @param {number} year Ano
   * @param {string} tag Tag opcional para filtrar
   * @returns {Promise<Array>} Despesas do ano especificado
   */
  async getExpensesByYear(year, tag = '') {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    return this.getExpensesByDateRange(startDate, endDate, tag);
  }
};

export default expensesService;