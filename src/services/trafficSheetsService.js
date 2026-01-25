import axios from 'axios';

/**
 * Serviço para acessar dados de tráfego do Google Sheets
 * Planilha: AUX | Dashboard com métricas de marketing digital
 */
class TrafficSheetsService {
  constructor() {
    this.spreadsheetId = '1dGBzqdZpenGDy5RB6K_RXvq7qA5lMgeGWK818a7q5iU';
    this.sheetName = 'AUX | Dashboard';

    // Cache e controle
    this.cache = null;
    this.lastFetch = null;
    this.cacheTime = 30000; // 30 segundos
    this.isFetching = false;
    this.fetchPromise = null;
  }

  /**
   * Busca dados da planilha de tráfego
   */
  async fetchTrafficData() {
    const now = Date.now();

    // Retorna cache se válido
    if (this.cache && this.lastFetch && (now - this.lastFetch) < this.cacheTime) {
      return this.cache;
    }

    // Se já está buscando, aguarda a promise existente
    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isFetching = true;

    // URL de exportação CSV com o nome da aba
    const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.sheetName)}`;

    this.fetchPromise = axios.get(csvUrl, {
      timeout: 15000,
      headers: {
        'Accept': 'text/csv',
        'Cache-Control': 'no-cache'
      }
    })
    .then(response => {
      const processedData = this.processCSVData(response.data);

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
      throw error;
    });

    return this.fetchPromise;
  }

  /**
   * Processa CSV para formato JSON
   */
  processCSVData(csvText) {
    const lines = csvText.split('\n');
    const result = [];

    // Parse CSV considerando valores entre aspas
    const parseCSVLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      values.push(current.trim());
      return values;
    };

    // Primeira linha contém os headers
    const headers = parseCSVLine(lines[0]);

    // Processa cada linha de dados
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLine(lines[i]);
      const rowData = {};

      headers.forEach((header, index) => {
        let value = values[index] || '';

        // Remove aspas extras
        value = value.replace(/^"|"$/g, '');

        // Processa valores baseado no tipo de campo
        if (header === 'DATA') {
          // Mantém formato de data
          rowData[header] = value;
        } else if (header === 'INVESTIMENTO' || header.includes('CP')) {
          // Remove R$ e converte para número
          const numValue = value.replace(/[R$\s]/g, '').replace('.', '').replace(',', '.');
          rowData[header] = parseFloat(numValue) || 0;
        } else if (header.startsWith('Nº')) {
          // Converte para número inteiro
          rowData[header] = parseInt(value.replace(/\D/g, '')) || 0;
        } else if (header === 'CTR' || header.includes('CONVERSÃO') || header.includes('CARREG')) {
          // Converte percentuais
          const percentValue = value.replace('%', '').replace(',', '.');
          rowData[header] = parseFloat(percentValue) || 0;
        } else {
          rowData[header] = value;
        }
      });

      // Adiciona apenas linhas com data válida
      if (rowData.DATA && rowData.DATA.includes('/')) {
        result.push(rowData);
      }
    }

    return result;
  }

  /**
   * Calcula métricas agregadas e estatísticas
   */
  calculateMetrics(data) {
    if (!data || data.length === 0) return null;

    // Dados mais recentes (última linha)
    const latestData = data[data.length - 1];

    // Calcula totais
    const totals = data.reduce((acc, row) => {
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

    // Calcula médias
    const count = data.length;
    const averages = {
      ctr: totals.cliques > 0 ? (totals.cliques / totals.impressoes * 100) : 0,
      cpc: totals.cliques > 0 ? (totals.investimento / totals.cliques) : 0,
      cpl: totals.leads > 0 ? (totals.investimento / totals.leads) : 0,
      cpm: totals.impressoes > 0 ? (totals.investimento / totals.impressoes * 1000) : 0,
      conversaoPagina: totals.pageviews > 0 ? (totals.leads / totals.pageviews * 100) : 0,
      carregamentoPagina: totals.cliques > 0 ? (totals.pageviews / totals.cliques * 100) : 0
    };

    // Calcula variações (comparando último dia com penúltimo)
    let variations = null;
    if (data.length >= 2) {
      const previous = data[data.length - 2];
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
      dataCount: count,
      period: {
        start: data[0].DATA,
        end: latestData.DATA
      }
    };
  }

  /**
   * Calcula variação percentual entre dois valores
   */
  calculateVariation(oldValue, newValue) {
    if (!oldValue || oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue * 100).toFixed(2);
  }

  /**
   * Obtém dados filtrados por período
   */
  async getDataByPeriod(startDate, endDate) {
    const data = await this.fetchTrafficData();

    return data.filter(row => {
      const [day, month, year] = row.DATA.split('/');
      const rowDate = new Date(year || new Date().getFullYear(), month - 1, day);

      return rowDate >= startDate && rowDate <= endDate;
    });
  }

  /**
   * Inicia atualizações em tempo real
   */
  startRealTimeUpdates(callback, interval = 60000) {
    // Busca inicial
    this.fetchTrafficData()
      .then(data => {
        const metrics = this.calculateMetrics(data);
        callback({ data, metrics });
      })
      .catch(error => {
        callback({ error });
      });

    // Configura intervalo de atualização
    const intervalId = setInterval(async () => {
      try {
        const data = await this.fetchTrafficData();
        const metrics = this.calculateMetrics(data);
        callback({ data, metrics });
      } catch (error) {
        callback({ error });
      }
    }, interval);

    return intervalId;
  }

  /**
   * Para atualizações em tempo real
   */
  stopRealTimeUpdates(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }

  /**
   * Limpa cache manualmente
   */
  clearCache() {
    this.cache = null;
    this.lastFetch = null;
  }
}

const trafficSheetsService = new TrafficSheetsService();
export default trafficSheetsService;