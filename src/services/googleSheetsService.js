// src/services/googleSheetsService.js
import axios from 'axios';

/**
 * Serviço para acessar Google Sheets diretamente no frontend
 * Replica exatamente a lógica do backend que estava funcionando
 */
class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = '1Gvvhjhbzp-6Fgvb3bqlTB5SbFevMz2bGIUH99H8Ubfc';
    // URL para exportar como CSV (formato público)
    this.csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/export?format=csv`;
    
    // Cache unificado para todos os dados
    this._cachedRawCSV = null;
    this._cachedParsedData = null;
    this._lastFetchTime = null;
    this._cacheTimeout = 30 * 1000; // 30 segundos de cache (reduzido de 5 minutos)
    
    // Flag para evitar múltiplas requisições simultâneas
    this._fetchingData = false;
    this._fetchPromise = null;
  }

  // Parser de CSV otimizado
  parseCSV(csvText) {
    // Usar split simples para linhas
    const lines = csvText.split('\n');
    const result = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Regex otimizada para parsing de CSV
      const values = [];
      const regex = /(?:^|,)("(?:[^"]+|"")*"|[^,]*)/g;
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        let value = match[1];
        // Remover aspas externas se existirem
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1).replace(/""/g, '"');
        }
        values.push(value.trim());
      }
      
      if (values.length > 0) {
        result.push(values);
      }
    }
    
    return result;
  }

  // Método para buscar e cachear dados brutos
  async fetchRawData() {
    // Se já está buscando, retorna a promise existente
    if (this._fetchingData && this._fetchPromise) {
      console.log('Já existe uma requisição em andamento, aguardando...');
      return this._fetchPromise;
    }

    // Verifica cache
    const now = Date.now();
    if (this._cachedRawCSV && this._lastFetchTime && (now - this._lastFetchTime < this._cacheTimeout)) {
      console.log('Usando dados em cache (válido por mais', Math.round((this._cacheTimeout - (now - this._lastFetchTime)) / 1000), 'segundos)');
      return this._cachedRawCSV;
    }

    // Marca que está buscando
    this._fetchingData = true;
    
    // Cria a promise de fetch
    this._fetchPromise = axios.get(this.csvUrl, {
      maxRedirects: 5,
      timeout: 10000, // Timeout de 10 segundos
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Dashboard/1.0)',
        'Accept': 'text/csv',
        'Cache-Control': 'no-cache'
      }
    }).then(response => {
      console.log('Dados baixados do Google Sheets');
      this._cachedRawCSV = response.data;
      this._lastFetchTime = Date.now();
      this._fetchingData = false;
      this._fetchPromise = null;
      return response.data;
    }).catch(error => {
      this._fetchingData = false;
      this._fetchPromise = null;
      throw error;
    });

    return this._fetchPromise;
  }

  async getSalesData() {
    try {
      console.log('Buscando dados de vendas...');
      const startTime = performance.now();
      
      // Usa o método centralizado de fetch com cache
      const csvData = await this.fetchRawData();
      
      // Verifica se já temos dados parseados em cache
      if (this._cachedParsedData && this._cachedParsedData.salesData) {
        console.log('Retornando dados de vendas do cache parseado');
        return this._cachedParsedData.salesData;
      }
      
      const records = this.parseCSV(csvData);
      
      console.log('Total de linhas:', records.length);
      
      // Pular as primeiras 3 linhas (título, totais e cabeçalhos)
      if (records.length < 4) {
        return [];
      }
      
      const salesData = [];
      const year = new Date().getFullYear();
      
      // Processa apenas linhas com dados
      for (let i = 3; i < records.length; i++) {
        const row = records[i];
        
        if (row && row.length >= 18 && row[0]) {
          const dateStr = row[0];
          
          if (dateStr && dateStr.includes('/')) {
            const [day, month] = dateStr.split('/');
            const fullDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            // Parse otimizado de números
            const vendasRealizadas = parseInt(row[14]) || 0;
            const vendaTMB = parseInt(row[15]) || 0;
            const vendaGuru = parseInt(row[16]) || 0;
            
            // Parse otimizado de valor monetário
            let valorStr = row[17] || '0';
            if (typeof valorStr === 'string') {
              valorStr = valorStr.replace(/[R$'"]/g, '').replace(/\./g, '').replace(',', '.').trim();
            }
            const valorTotal = parseFloat(valorStr) || 0;
            
            salesData.push({
              date: fullDate,
              vendas_realizadas: vendasRealizadas,
              venda_tmb: vendaTMB,
              venda_guru: vendaGuru,
              valor_vendas_realizadas: valorTotal,
              quantity: vendasRealizadas,
              value: valorTotal,
              product: 'Vendas DevClub',
              seller: 'Equipe DevClub',
              status: 'completed'
            });
          }
        }
      }
      
      // Cache dos dados parseados
      if (!this._cachedParsedData) {
        this._cachedParsedData = {};
      }
      this._cachedParsedData.salesData = salesData;
      
      const endTime = performance.now();
      console.log(`Dados de vendas processados: ${salesData.length} registros em ${Math.round(endTime - startTime)}ms`);
      
      return salesData;
    } catch (error) {
      console.error('Erro ao processar dados de vendas:', error);
      throw error;
    }
  }

  async getAllData() {
    try {
      console.log('Buscando todos os dados...');
      const startTime = performance.now();
      
      // Verifica se já temos dados completos em cache
      if (this._cachedParsedData && this._cachedParsedData.allData) {
        const now = Date.now();
        if (this._lastFetchTime && (now - this._lastFetchTime < this._cacheTimeout)) {
          console.log('Retornando todos os dados do cache parseado');
          return this._cachedParsedData.allData;
        }
      }
      
      // Usa o método centralizado de fetch com cache
      const csvData = await this.fetchRawData();
      const records = this.parseCSV(csvData);
      
      console.log('Total de linhas:', records.length);
      
      if (records.length < 4) {
        return [];
      }

      // Pegar os cabeçalhos da linha 3
      const headers = records[2];
      const allData = [];
      const year = new Date().getFullYear();
      
      // Processa dados em batch para melhor performance
      for (let i = 3; i < records.length; i++) {
        const row = records[i];
        
        if (row && row.length > 0 && row[0]) {
          const dateStr = row[0];
          
          if (dateStr && dateStr.includes('/')) {
            const [day, month] = dateStr.split('/');
            const fullDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            const rowData = { date: fullDate };
            
            // Processa cada campo de forma otimizada
            for (let index = 0; index < headers.length && index < row.length; index++) {
              const header = headers[index];
              if (!header) continue;
              
              let value = row[index];
              
              // Processamento otimizado de valores
              if (typeof value === 'string' && value) {
                value = value.replace(/^["']|["']$/g, '').trim();
                
                // Detecção rápida de tipo de valor
                if (value.includes('%')) {
                  const num = parseFloat(value.replace('%', '').replace(',', '.'));
                  if (!isNaN(num)) value = num;
                } else if (value.includes('R$')) {
                  const num = parseFloat(value.replace(/[R$.\s]/g, '').replace(',', '.'));
                  if (!isNaN(num)) value = num;
                } else if (/^[\d.,]+$/.test(value)) {
                  const num = parseFloat(value.replace(',', '.'));
                  if (!isNaN(num)) value = num;
                }
              }
              
              // Criar chave limpa do cabeçalho
              const cleanHeaderName = header.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^\w_]/g, '');
              
              rowData[cleanHeaderName] = value;
            }
            
            allData.push(rowData);
          }
        }
      }
      
      // Cache dos dados completos parseados
      if (!this._cachedParsedData) {
        this._cachedParsedData = {};
      }
      this._cachedParsedData.allData = allData;
      
      const endTime = performance.now();
      console.log(`Dados completos processados: ${allData.length} registros em ${Math.round(endTime - startTime)}ms`);
      
      return allData;
    } catch (error) {
      console.error('Erro ao processar dados completos:', error);
      throw error;
    }
  }
  
  // Método para limpar o cache manualmente
  clearCache() {
    console.log('Limpando cache de dados...');
    this._cachedRawCSV = null;
    this._cachedParsedData = null;
    this._lastFetchTime = null;
  }
}

const googleSheetsService = new GoogleSheetsService();
export default googleSheetsService;