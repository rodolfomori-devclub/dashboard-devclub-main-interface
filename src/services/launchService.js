// src/services/launchService.js
import axios from 'axios';

// ID da planilha do Google Sheets
const SHEET_ID = '11l2oWgWgOzZHKVSCh3HQanVirSvQPLT11UGr1IYZoeY';
// API Key
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';
// Nome da aba específica que queremos consultar (ou vazia para usar a primeira aba)
const SHEET_NAME = 'Principal';

/**
 * Serviço para consulta de dados de lançamentos do Google Sheets
 * Estrutura da planilha:
 * - Coluna A: Nomes dos campos/métricas
 * - Demais colunas: Dados de cada lançamento (ex: DEV 09, DEV 10, etc)
 */
export const launchService = {
  // Armazenar os dados em cache após a primeira chamada
  _cachedData: null,
  _lastFetchTime: null,

  /**
   * Buscar dados da planilha e organizar por lançamentos
   * @returns {Promise<Object>} Dados processados organizados por lançamento
   */
  async fetchSheetData() {
    // Se temos dados em cache e foram buscados há menos de 5 minutos, usar o cache
    const now = Date.now();
    if (this._cachedData && this._lastFetchTime && (now - this._lastFetchTime < 5 * 60 * 1000)) {
      console.log('Usando dados de lançamentos em cache');
      return this._cachedData;
    }
    
    try {
      console.log('Buscando dados da planilha de lançamentos');
      
      // Primeiro, vamos buscar informações sobre a planilha
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
      const sheetsResponse = await axios.get(sheetsUrl);
      
      // Obter todas as abas
      const sheets = sheetsResponse.data.sheets || [];
      if (sheets.length === 0) {
        console.error('Nenhuma aba encontrada na planilha');
        return { launches: [], data: {} };
      }
      
      console.log(`Número de abas na planilha: ${sheets.length}`);
      
      // Identificar a aba principal (usar a especificada ou a primeira)
      let mainSheetName = SHEET_NAME || sheets[0].properties?.title;
      
      // Se SHEET_NAME está especificado mas não existir, verificar se existe uma aba com nome similar
      if (SHEET_NAME && !sheets.some(s => s.properties?.title === SHEET_NAME)) {
        const similarSheet = sheets.find(sheet => 
          sheet.properties?.title?.toLowerCase().includes(SHEET_NAME.toLowerCase())
        );
        
        if (similarSheet) {
          mainSheetName = similarSheet.properties.title;
          console.log(`Aba específica "${SHEET_NAME}" não encontrada. Usando aba similar: ${mainSheetName}`);
        } else {
          console.log(`Aba específica "${SHEET_NAME}" não encontrada. Usando primeira aba: ${sheets[0].properties?.title}`);
          mainSheetName = sheets[0].properties?.title;
        }
      }
      
      console.log(`Buscando dados da aba: ${mainSheetName}`);
      
      // Buscar os dados da aba principal
      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(mainSheetName)}?key=${API_KEY}`;
      const response = await axios.get(valuesUrl);
      
      const rows = response.data.values || [];
      console.log(`Número de linhas na planilha: ${rows.length}`);
      
      if (rows.length <= 1) {
        console.log('Planilha vazia ou contém apenas cabeçalhos');
        return { launches: [], data: {} };
      }
      
      // Obter nomes dos lançamentos a partir da primeira linha (cabeçalhos)
      // Ignorar a primeira coluna (que contém os nomes dos campos)
      const launchNames = rows[0].slice(1).map(name => name.trim()).filter(Boolean);
      console.log(`Lançamentos encontrados: ${launchNames.join(', ')}`);
      
      if (launchNames.length === 0) {
        console.log('Nenhum lançamento encontrado na planilha');
        return { launches: [], data: {} };
      }
      
      // Processar os dados - cada linha a partir da segunda representa um campo/métrica
      const processedData = {};
      
      // Para cada lançamento, criar um objeto com os dados
      launchNames.forEach((launchName, index) => {
        const launchData = {};
        
        // A partir da segunda linha, processar cada métrica
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length <= 1) continue; // Ignorar linhas sem dados
          
          const fieldName = row[0] ? row[0].trim() : `Campo ${i}`;
          const fieldValue = index + 1 < row.length ? row[index + 1] : null;
          
          // Adicionar ao objeto de dados do lançamento
          launchData[fieldName] = this._processValue(fieldValue);
        }
        
        // Adicionar o lançamento processado ao objeto geral
        processedData[launchName] = launchData;
      });
      
      const result = {
        launches: launchNames,
        data: processedData
      };
      
      // Atualizar cache
      this._cachedData = result;
      this._lastFetchTime = now;
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar dados da planilha:', error.response?.data || error.message);
      return { launches: [], data: {} };
    }
  },
  
  /**
   * Processar um valor para o formato adequado (número, texto, etc)
   * @param {string} value - Valor a ser processado
   * @returns {number|string|null} Valor processado
   * @private
   */
  _processValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    // Tentar converter para número se for valor monetário ou percentual
    if (typeof value === 'string') {
      // Verificar se é um valor monetário (R$) ou percentual (%)
      if (value.includes('R$') || value.includes('%') || 
          value.match(/^[\d.,]+$/) || 
          value.match(/^-[\d.,]+$/)) {
        
        // Remover formatação
        const numericValue = value.replace(/[^\d.,\-+]/g, '').replace(',', '.');
        const parsedValue = parseFloat(numericValue);
        
        if (!isNaN(parsedValue)) {
          return parsedValue;
        }
      }
    }
    
    // Se não for um número válido, retornar como string
    return value;
  },
  
  /**
   * Obter lista de lançamentos disponíveis
   * @returns {Promise<Array>} Lista de nomes de lançamentos
   */
  async getLaunches() {
    const { launches } = await this.fetchSheetData();
    return launches;
  },
  
  /**
   * Obter dados de um lançamento específico
   * @param {string} launchName - Nome do lançamento
   * @returns {Promise<Object>} Dados do lançamento
   */
  async getLaunchData(launchName) {
    const { data } = await this.fetchSheetData();
    return data[launchName] || {};
  },
  
  /**
   * Obter todas as métricas/campos disponíveis
   * @returns {Promise<Array>} Lista de nomes de métricas/campos
   */
  async getMetrics() {
    const { data, launches } = await this.fetchSheetData();
    
    if (launches.length === 0) {
      return [];
    }
    
    // Usar o primeiro lançamento para extrair os nomes dos campos
    const firstLaunch = data[launches[0]];
    return firstLaunch ? Object.keys(firstLaunch) : [];
  },
  
  /**
   * Obter valor formatado para exibição
   * @param {number|string} value - Valor a formatar
   * @param {string} metric - Nome da métrica/campo
   * @returns {string} Valor formatado
   */
  formatValue(value, metric) {
    if (value === null || value === undefined) {
      return '-';
    }
    
    // Verificar se é um valor monetário
    const lowerMetric = metric.toLowerCase();
    const isMonetary = lowerMetric.includes('invest') || 
                       lowerMetric.includes('custo') || 
                       lowerMetric.includes('valor') ||
                       lowerMetric.includes('receita') ||
                       lowerMetric.includes('faturamento') ||
                       lowerMetric.includes('r$');
    
    // Verificar se é percentual
    const isPercentage = lowerMetric.includes('%') || 
                        lowerMetric.includes('taxa') ||
                        lowerMetric.includes('percentual');
    
    if (typeof value === 'number') {
      if (isMonetary) {
        return new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(value);
      }
      
      if (isPercentage) {
        return `${value.toLocaleString('pt-BR')}%`;
      }
      
      // Número simples com separador de milhares
      return value.toLocaleString('pt-BR');
    }
    
    // Retornar como string se não for um número
    return String(value);
  },
  
  /**
   * Calcular métricas para um lançamento específico
   * @param {string} launchName - Nome do lançamento
   * @returns {Promise<Object>} Métricas calculadas
   */
  async calculateLaunchMetrics(launchName) {
    const launchData = await this.getLaunchData(launchName);
    
    if (!launchData || Object.keys(launchData).length === 0) {
      console.log(`Nenhum dado encontrado para o lançamento ${launchName}`);
      return {
        name: launchName,
        metrics: {
          investment: 0,
          revenue: 0,
          profit: 0,
          roi: 0,
          leads: 0,
          leadCost: 0,
          facebookInvestment: 0,
          googleInvestment: 0,
          guruRevenue: 0,
          tmbRevenue: 0
        }
      };
    }
    
    // Procurar valores relacionados a cada métrica principal
    const metrics = {
      // Valores padrão
      investment: 0,
      revenue: 0,
      profit: 0,
      roi: 0,
      leads: 0,
      leadCost: 0,
      facebookInvestment: 0,
      googleInvestment: 0,
      guruRevenue: 0,
      tmbRevenue: 0
    };
    
    // Buscar valores diretamente ou inferir de campos relacionados
    for (const [key, value] of Object.entries(launchData)) {
      const lowerKey = key.toLowerCase();
      
      // Investimento total
      if (lowerKey.includes('investimento total') || 
          lowerKey.includes('total investido') ||
          lowerKey.includes('custo total')) {
        metrics.investment = typeof value === 'number' ? value : 0;
      }
      
      // Investimento Facebook
      else if (lowerKey.includes('facebook') && 
              (lowerKey.includes('invest') || lowerKey.includes('gasto'))) {
        metrics.facebookInvestment = typeof value === 'number' ? value : 0;
      }
      
      // Investimento Google
      else if (lowerKey.includes('google') && 
              (lowerKey.includes('invest') || lowerKey.includes('gasto'))) {
        metrics.googleInvestment = typeof value === 'number' ? value : 0;
      }
      
      // Receita/Faturamento Total
      else if ((lowerKey.includes('receita') || lowerKey.includes('faturamento')) && 
               lowerKey.includes('total')) {
        metrics.revenue = typeof value === 'number' ? value : 0;
      }
      
      // Receita GURU
      else if ((lowerKey.includes('receita') || lowerKey.includes('faturamento')) && 
               lowerKey.includes('guru')) {
        metrics.guruRevenue = typeof value === 'number' ? value : 0;
      }
      
      // Receita TMB
      else if ((lowerKey.includes('receita') || lowerKey.includes('faturamento')) && 
               (lowerKey.includes('tmb') || lowerKey.includes('boleto'))) {
        metrics.tmbRevenue = typeof value === 'number' ? value : 0;
      }
      
      // Leads
      else if (lowerKey.includes('leads') && 
              (lowerKey.includes('total') || !lowerKey.includes('custo'))) {
        metrics.leads = typeof value === 'number' ? value : 0;
      }
      
      // Custo por Lead
      else if (lowerKey.includes('custo por lead') || lowerKey.includes('cpl')) {
        metrics.leadCost = typeof value === 'number' ? value : 0;
      }
    }
    
    // Calcular métricas derivadas se necessário
    
    // Se não temos investimento total mas temos os parciais
    if (metrics.investment === 0 && (metrics.facebookInvestment > 0 || metrics.googleInvestment > 0)) {
      metrics.investment = metrics.facebookInvestment + metrics.googleInvestment;
    }
    
    // Se não temos receita total mas temos as parciais
    if (metrics.revenue === 0 && (metrics.guruRevenue > 0 || metrics.tmbRevenue > 0)) {
      metrics.revenue = metrics.guruRevenue + metrics.tmbRevenue;
    }
    
    // Calcular lucro se tivermos receita e investimento
    if (metrics.revenue > 0 && metrics.investment > 0) {
      metrics.profit = metrics.revenue - metrics.investment;
      metrics.roi = metrics.revenue / metrics.investment;
    }
    
    // Calcular custo por lead se não temos o valor direto
    if (metrics.leadCost === 0 && metrics.leads > 0 && metrics.investment > 0) {
      metrics.leadCost = metrics.investment / metrics.leads;
    }
    
    return {
      name: launchName,
      metrics
    };
  },
  
  /**
   * Método para análise básica - apenas para uso em desenvolvimento
   */
  async logDataToConsole() {
    try {
      const { launches, data } = await this.fetchSheetData();
      console.log('ANÁLISE DE DADOS DE LANÇAMENTO:');
      console.log(`Total de ${launches.length} lançamentos encontrados:`);
      console.log(launches);
      
      if (launches.length > 0) {
        // Mostrar um exemplo de dados do primeiro lançamento
        const firstLaunch = launches[0];
        console.log(`\nExemplo de dados do lançamento "${firstLaunch}":`);
        console.log(data[firstLaunch]);
        
        // Mostrar algumas métricas calculadas
        const metrics = await this.calculateLaunchMetrics(firstLaunch);
        console.log(`\nMétricas calculadas para "${firstLaunch}":`);
        console.log(metrics);
      }
      
      return launches.map(launch => ({
        name: launch,
        data: data[launch]
      }));
    } catch (error) {
      console.error('Erro ao realizar análise de dados:', error);
      return [];
    }
  }
};

export default launchService;