// src/services/boletoService.js
import axios from 'axios';

// ID da planilha do Google Sheets
const SHEET_ID = '1jPCyVkRImt8yYPgMlBAeMZPqwdyQvy9P_KpWmo2PHBU';
// API Key
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';

// Mapeamento de produtos para seus respectivos valores (usado como fallback)
const PRODUCT_VALUES = {
  'DevClub Full Stack': 2200,
  'DevClub Boleto': 2200,
  'DevClub Cartão': 2000,
  'Vitalicio Cartão': 1000,
  'Vitalicio Boleto': 1200,
  'DevClub Vitalício': 5000,
  'Front End Cartão': 500,
  'Front End Boleto': 1200,
  // Adicionar outros produtos conforme necessário
  'DEFAULT': 2200 // Valor padrão se não encontrar o produto
};

/**
 * Serviço para consulta de vendas via boleto (TMB) do Google Sheets
 * Implementação completamente redesenhada com lógica de data simplificada
 */
export const boletoService = {
  // Armazenar os dados em cache após a primeira chamada
  _cachedData: null,
  _lastFetchTime: null,
  
  /**
   * Extrair dia/mês/ano de uma string no formato DD/MM/YYYY
   * @param {string} dateStr String de data no formato DD/MM/YYYY
   * @returns {Object} Objeto com dia, mês e ano extraídos
   */
  _parseDateString(dateStr) {
    try {
      // Considerar apenas a parte da data (ignorar a hora)
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
   * @param {Object} dateObj Objeto com dia, mês e ano
   * @param {Object} startObj Objeto com dia, mês e ano do início
   * @param {Object} endObj Objeto com dia, mês e ano do fim
   * @returns {boolean} Verdadeiro se a data estiver no intervalo
   */
  _isDateInRange(dateObj, startObj, endObj) {
    // Criar strings de data para comparação no formato YYYY-MM-DD
    const dateStr = `${dateObj.year}-${String(dateObj.month).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
    const startStr = `${startObj.year}-${String(startObj.month).padStart(2, '0')}-${String(startObj.day).padStart(2, '0')}`;
    const endStr = `${endObj.year}-${String(endObj.month).padStart(2, '0')}-${String(endObj.day).padStart(2, '0')}`;
    
    // Comparação de strings simples
    return dateStr >= startStr && dateStr <= endStr;
  },

  /**
   * Buscar todos os dados da planilha
   * @returns {Promise<Array>} Array com os dados processados da planilha
   */
  async fetchAllSheetData() {
    // Se temos dados em cache e foram buscados há menos de 5 minutos, usar o cache
    const now = Date.now();
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < 5 * 60 * 1000)) {
      console.log('Usando dados em cache');
      return this._cachedData;
    }
    
    try {
      console.log('Buscando dados da planilha');
      
      // Primeiro, vamos buscar informações sobre a planilha
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
      const sheetsResponse = await axios.get(sheetsUrl);
      
      // Encontrar a primeira aba
      const sheets = sheetsResponse.data.sheets || [];
      if (sheets.length === 0) {
        console.error('Nenhuma aba encontrada na planilha');
        return [];
      }
      
      // Obter o nome da primeira aba
      const sheetName = sheets[0].properties?.title;
      if (!sheetName) {
        console.error('Não foi possível determinar o nome da aba');
        return [];
      }
      
      console.log(`Usando a aba: ${sheetName}`);
      
      // Buscar os dados da aba
      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
      const response = await axios.get(valuesUrl);
      
      const rows = response.data.values || [];
      console.log(`Número de linhas na planilha: ${rows.length}`);
      
      if (rows.length <= 1) {
        console.log('Planilha vazia ou contém apenas cabeçalhos');
        return [];
      }
      
      // Mapear os dados (pular a primeira linha, que são cabeçalhos)
      const processedData = rows.slice(1).map((row, index) => {
        // Verificar se a linha tem dados suficientes
        if (row.length < 5) {
          console.log(`Linha ${index + 2} tem dados insuficientes:`, row);
          return null;
        }
        
        try {
          const [nome, email, telefone, dataHoraStr, produto] = row;
          
          // Se faltam campos importantes, pular
          if (!dataHoraStr || !produto) {
            console.log(`Linha ${index + 2} com campos obrigatórios faltando`);
            return null;
          }
          
          // Extrair a data da string (ignora a hora)
          const dateParts = this._parseDateString(dataHoraStr);
          
          // Pegar o valor diretamente da planilha (índice 5), se existir
          // Caso contrário, usar o valor do mapeamento ou valor padrão
          let saleValue = 0;
          
          // Verificar se existe um valor na posição 5 da linha
          if (row.length > 5 && row[5]) {
            // Converter para número, removendo possíveis formatações (R$, ., etc)
            const rawValue = row[5].toString().replace(/[^\d,.-]/g, '').replace(',', '.');
            saleValue = parseFloat(rawValue) || 0;
            
            // Se não conseguir converter ou for 0, usar o valor do mapeamento
            if (!saleValue) {
              saleValue = PRODUCT_VALUES[produto.trim()] || PRODUCT_VALUES.DEFAULT;
            }
          } else {
            // Se não existir o valor na planilha, usar o mapeamento
            saleValue = PRODUCT_VALUES[produto.trim()] || PRODUCT_VALUES.DEFAULT;
          }
          
          // Criar objeto com as informações da venda
          return {
            id: `sheet-${index}-${Math.random().toString(36).substring(2, 10)}`,
            raw: { // Guardar os dados brutos para depuração
              nome,
              email,
              telefone,
              dataHoraStr,
              produto,
              valor: row.length > 5 ? row[5] : null
            },
            product: produto.trim(),
            value: saleValue,
            date: { // Guardar data decomposta para facilitar filtragem
              ...dateParts,
              original: dataHoraStr,
              // Para compatibilidade com código existente
              timestamp: new Date(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0)
            },
            payment_method: 'boleto',
            channel: 'TMB',
            // Para compatibilidade com código existente
            timestamp: new Date(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0),
            dates: {
              created_at: Math.floor(new Date(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0).getTime() / 1000)
            },
            calculation_details: {
              net_amount: saleValue,
              net_affiliate_value: 0,
              payment_method: 'boleto'
            }
          };
        } catch (err) {
          console.log(`Erro ao processar linha ${index + 2}:`, err.message);
          return null;
        }
      }).filter(item => item !== null);
      
      console.log(`Dados processados: ${processedData.length} itens válidos`);
      
      // Atualizar cache
      this._cachedData = processedData;
      this._lastFetchTime = now;
      
      return processedData;
    } catch (error) {
      console.error('Erro ao buscar dados da planilha:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Filtrar vendas por dia específico
   * @param {Date} date Data para filtrar
   * @returns {Promise<Array>} Vendas do dia especificado
   */
  async getSalesByDate(date) {
    try {
      // Extrair dia, mês e ano da data fornecida
      const day = date.getDate();
      const month = date.getMonth() + 1; // getMonth() retorna 0-11
      const year = date.getFullYear();
      
      console.log(`Filtrando vendas para o dia ${day}/${month}/${year}`);
      
      const dateFilter = { day, month, year };
      
      // Buscar todos os dados
      const allSales = await this.fetchAllSheetData();
      
      // Filtrar apenas pelo dia exato (usando os objetos de data decompostos)
      const filtered = allSales.filter(sale => 
        sale.date.day === dateFilter.day && 
        sale.date.month === dateFilter.month && 
        sale.date.year === dateFilter.year
      );
      
      console.log(`Encontradas ${filtered.length} vendas para ${day}/${month}/${year}`);
      
      // Log detalhado para depuração
      if (filtered.length > 0) {
        console.log("Primeiras vendas encontradas:");
        filtered.slice(0, 3).forEach(sale => {
          console.log(`  - Data original: ${sale.date.original}, Produto: ${sale.product}`);
        });
      }
      
      return filtered;
    } catch (error) {
      console.error('Erro ao filtrar vendas por data:', error);
      return [];
    }
  },

  /**
   * Filtrar vendas por intervalo de datas
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Vendas no intervalo especificado
   */
  async getSalesByDateRange(startDate, endDate) {
    try {
      // Extrair dia, mês e ano das datas de início e fim
      const startFilter = {
        day: startDate.getDate(),
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear()
      };
      
      const endFilter = {
        day: endDate.getDate(),
        month: endDate.getMonth() + 1,
        year: endDate.getFullYear()
      };
      
      console.log(`Filtrando vendas entre ${startFilter.day}/${startFilter.month}/${startFilter.year} e ${endFilter.day}/${endFilter.month}/${endFilter.year}`);
      
      // Buscar todos os dados
      const allSales = await this.fetchAllSheetData();
      
      // Filtrar pelo intervalo de datas
      const filtered = allSales.filter(sale => 
        this._isDateInRange(sale.date, startFilter, endFilter)
      );
      
      console.log(`Encontradas ${filtered.length} vendas no intervalo`);
      
      return filtered;
    } catch (error) {
      console.error('Erro ao filtrar vendas por intervalo de datas:', error);
      return [];
    }
  },

  /**
   * Filtrar vendas por mês específico
   * @param {number} year Ano
   * @param {number} month Mês (0-11)
   * @returns {Promise<Array>} Vendas do mês especificado
   */
  async getSalesByMonth(year, month) {
    try {
      // Ajustar mês para 1-12 (internamente usamos 1-12, mas a API recebe 0-11)
      const adjustedMonth = month + 1;
      
      console.log(`Filtrando vendas para o mês ${adjustedMonth}/${year}`);
      
      // Criar filtro para o mês
      const monthFilter = { month: adjustedMonth, year };
      
      // Buscar todos os dados
      const allSales = await this.fetchAllSheetData();
      
      // Filtrar apenas pelo mês exato
      const filtered = allSales.filter(sale => 
        sale.date.month === monthFilter.month && 
        sale.date.year === monthFilter.year
      );
      
      console.log(`Encontradas ${filtered.length} vendas para ${adjustedMonth}/${year}`);
      
      return filtered;
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
      
      // Buscar todos os dados
      const allSales = await this.fetchAllSheetData();
      
      // Filtrar apenas pelo ano exato
      const filtered = allSales.filter(sale => sale.date.year === year);
      
      console.log(`Encontradas ${filtered.length} vendas para o ano ${year}`);
      
      return filtered;
    } catch (error) {
      console.error('Erro ao filtrar vendas por ano:', error);
      return [];
    }
  }
};

export default boletoService;