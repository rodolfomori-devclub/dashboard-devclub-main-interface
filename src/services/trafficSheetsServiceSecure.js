import axios from 'axios';

/**
 * Serviço SEGURO para acessar dados de tráfego do Google Sheets
 * Implementa boas práticas de segurança e performance
 */

// Rate Limiter simples
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest() {
    const now = Date.now();
    // Remove requisições antigas fora da janela
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }

  getRemainingTime() {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    const now = Date.now();
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }
}

class TrafficSheetsServiceSecure {
  constructor() {
    // Usar variáveis de ambiente ou valores padrão seguros
    this.spreadsheetId = import.meta.env.VITE_TRAFFIC_SPREADSHEET_ID ||
                         '1dGBzqdZpenGDy5RB6K_RXvq7qA5lMgeGWK818a7q5iU';
    this.sheetName = import.meta.env.VITE_TRAFFIC_SHEET_NAME || 'AUX | Dashboard';

    // Configurações de cache e timeout
    this.cacheTime = parseInt(import.meta.env.VITE_CACHE_TIME) || 30000;
    this.requestTimeout = parseInt(import.meta.env.VITE_REQUEST_TIMEOUT) || 15000;

    // Rate limiting
    const maxRequests = parseInt(import.meta.env.VITE_MAX_REQUESTS_PER_MINUTE) || 10;
    this.rateLimiter = new RateLimiter(maxRequests, 60000);

    // Cache
    this.cache = null;
    this.lastFetch = null;
    this.isFetching = false;
    this.fetchPromise = null;

    // Schema de validação
    this.requiredFields = ['DATA', 'INVESTIMENTO', 'Nº IMPRESSÕES', 'Nº CLIQUES'];
  }

  /**
   * Valida o schema dos dados recebidos
   */
  validateDataSchema(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Dados inválidos: array vazio ou formato incorreto');
    }

    const firstRow = data[0];
    const missingFields = this.requiredFields.filter(field => !firstRow.hasOwnProperty(field));

    if (missingFields.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    return true;
  }

  /**
   * Sanitiza valores para prevenir injeções
   */
  sanitizeValue(value) {
    if (typeof value !== 'string') return value;

    // Remove caracteres potencialmente perigosos
    return value
      .replace(/[<>]/g, '') // Remove tags HTML
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Busca dados com rate limiting e validação
   */
  async fetchTrafficData() {
    const now = Date.now();

    // Verifica cache
    if (this.cache && this.lastFetch && (now - this.lastFetch) < this.cacheTime) {
      return this.cache;
    }

    // Verifica rate limiting
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getRemainingTime();
      throw new Error(`Limite de requisições excedido. Tente novamente em ${Math.ceil(waitTime / 1000)} segundos.`);
    }

    // Evita requisições simultâneas
    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isFetching = true;

    const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.sheetName)}`;

    this.fetchPromise = axios.get(csvUrl, {
      timeout: this.requestTimeout,
      headers: {
        'Accept': 'text/csv',
        'Cache-Control': 'no-cache'
      },
      // Validação adicional de resposta
      validateStatus: (status) => status === 200,
    })
    .then(response => {
      // Valida tipo de conteúdo
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('text')) {
        throw new Error('Resposta inválida: tipo de conteúdo inesperado');
      }

      const processedData = this.processCSVData(response.data);

      // Valida schema dos dados
      this.validateDataSchema(processedData);

      // Atualiza cache
      this.cache = processedData;
      this.lastFetch = now;
      this.isFetching = false;
      this.fetchPromise = null;

      return processedData;
    })
    .catch(error => {
      this.isFetching = false;
      this.fetchPromise = null;

      // Não expõe detalhes internos do erro
      if (error.response) {
        throw new Error(`Erro ao buscar dados: ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Erro de conexão. Verifique sua internet.');
      } else {
        throw new Error(error.message || 'Erro ao processar dados');
      }
    });

    return this.fetchPromise;
  }

  /**
   * Processa CSV com validação e sanitização
   */
  processCSVData(csvText) {
    // Valida entrada
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Dados CSV inválidos');
    }

    const lines = csvText.split('\n').filter(line => line.trim());
    const result = [];

    // Parse seguro de CSV
    const parseCSVLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(this.sanitizeValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }

      values.push(this.sanitizeValue(current.trim()));
      return values;
    };

    // Headers
    const headers = parseCSVLine(lines[0]);

    // Processa dados com validação
    for (let i = 1; i < lines.length && i < 10000; i++) { // Limite de segurança
      const values = parseCSVLine(lines[i]);
      const rowData = {};

      headers.forEach((header, index) => {
        let value = values[index] || '';

        // Remove aspas e sanitiza
        value = value.replace(/^"|"$/g, '');
        value = this.sanitizeValue(value);

        // Processa com validação de tipo
        if (header === 'DATA') {
          // Valida formato de data
          if (value && !value.match(/^\d{1,2}\/\d{1,2}(\/\d{4})?$/)) {
            value = ''; // Invalida datas mal formatadas
          }
          rowData[header] = value;
        } else if (header === 'INVESTIMENTO' || header.includes('CP')) {
          // Parse seguro de valores monetários
          const numValue = value.replace(/[R$\s]/g, '').replace('.', '').replace(',', '.');
          const parsed = parseFloat(numValue);
          rowData[header] = isFinite(parsed) ? parsed : 0;
        } else if (header.startsWith('Nº')) {
          // Parse seguro de inteiros
          const parsed = parseInt(value.replace(/\D/g, ''));
          rowData[header] = isFinite(parsed) ? parsed : 0;
        } else if (header === 'CTR' || header.includes('CONVERSÃO') || header.includes('CARREG')) {
          // Parse seguro de percentuais
          const percentValue = value.replace('%', '').replace(',', '.');
          const parsed = parseFloat(percentValue);
          rowData[header] = isFinite(parsed) ? parsed : 0;
        } else {
          rowData[header] = value;
        }
      });

      // Adiciona apenas linhas válidas
      if (rowData.DATA && rowData.DATA.includes('/')) {
        result.push(rowData);
      }
    }

    return result;
  }

  /**
   * Calcula métricas com validação
   */
  calculateMetrics(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Validação de dados antes do cálculo
    const validData = data.filter(row =>
      typeof row.INVESTIMENTO === 'number' &&
      typeof row['Nº IMPRESSÕES'] === 'number'
    );

    if (validData.length === 0) {
      return null;
    }

    const latestData = validData[validData.length - 1];

    // Cálculos seguros com validação
    const totals = validData.reduce((acc, row) => {
      acc.investimento += row.INVESTIMENTO || 0;
      acc.impressoes += row['Nº IMPRESSÕES'] || 0;
      acc.cliques += row['Nº CLIQUES'] || 0;
      acc.pageviews += row['Nº PAGEVIEW'] || 0;
      acc.leads += row['Nº LEADS'] || 0;
      return acc;
    }, {
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      pageviews: 0,
      leads: 0
    });

    // Cálculos com proteção contra divisão por zero
    const safeDivide = (numerator, denominator) => {
      return denominator > 0 ? numerator / denominator : 0;
    };

    const averages = {
      ctr: safeDivide(totals.cliques, totals.impressoes) * 100,
      cpc: safeDivide(totals.investimento, totals.cliques),
      cpl: safeDivide(totals.investimento, totals.leads),
      cpm: safeDivide(totals.investimento, totals.impressoes) * 1000,
      conversaoPagina: safeDivide(totals.leads, totals.pageviews) * 100,
      carregamentoPagina: safeDivide(totals.pageviews, totals.cliques) * 100
    };

    // Cálculo seguro de variações
    let variations = null;
    if (validData.length >= 2) {
      const previous = validData[validData.length - 2];
      variations = {
        investimento: this.calculateVariation(previous.INVESTIMENTO, latestData.INVESTIMENTO),
        impressoes: this.calculateVariation(previous['Nº IMPRESSÕES'], latestData['Nº IMPRESSÕES']),
        cliques: this.calculateVariation(previous['Nº CLIQUES'], latestData['Nº CLIQUES']),
        leads: this.calculateVariation(previous['Nº LEADS'], latestData['Nº LEADS']),
        ctr: this.calculateVariation(previous.CTR, latestData.CTR),
        cpl: this.calculateVariation(previous.CPL, latestData.CPL)
      };
    }

    return {
      latest: latestData,
      totals,
      averages,
      variations,
      dataCount: validData.length,
      period: {
        start: validData[0].DATA,
        end: latestData.DATA
      }
    };
  }

  /**
   * Cálculo seguro de variação percentual
   */
  calculateVariation(oldValue, newValue) {
    if (!isFinite(oldValue) || !isFinite(newValue) || oldValue === 0) {
      return 0;
    }
    const variation = ((newValue - oldValue) / oldValue * 100);
    return isFinite(variation) ? parseFloat(variation.toFixed(2)) : 0;
  }

  /**
   * Limpa cache de forma segura
   */
  clearCache() {
    this.cache = null;
    this.lastFetch = null;
  }

  /**
   * Inicia atualizações com proteção
   */
  startRealTimeUpdates(callback, interval = 60000) {
    // Valida intervalo mínimo
    const safeInterval = Math.max(interval, 30000); // Mínimo 30 segundos

    // Busca inicial
    this.fetchTrafficData()
      .then(data => {
        const metrics = this.calculateMetrics(data);
        callback({ data, metrics });
      })
      .catch(error => {
        callback({ error: error.message });
      });

    // Intervalo protegido
    const intervalId = setInterval(async () => {
      try {
        const data = await this.fetchTrafficData();
        const metrics = this.calculateMetrics(data);
        callback({ data, metrics });
      } catch (error) {
        callback({ error: error.message });
      }
    }, safeInterval);

    return intervalId;
  }

  /**
   * Para atualizações de forma segura
   */
  stopRealTimeUpdates(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
}

const trafficSheetsServiceSecure = new TrafficSheetsServiceSecure();
export default trafficSheetsServiceSecure;