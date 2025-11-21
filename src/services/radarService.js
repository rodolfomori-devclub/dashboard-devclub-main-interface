// src/services/radarService.js
import axios from 'axios';

// ID da planilha do Radar DevClub
const SHEET_ID = '1Gvvhjhbzp-6Fgvb3bqlTB5SbFevMz2bGIUH99H8Ubfc';
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';

// Mapeamento de mês para nome da aba
const MONTH_TAB_NAMES = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro'
};

/**
 * Serviço para consulta de dados do Radar DevClub (Toca o Sino)
 */
export const radarService = {
  _cachedData: {}, // Cache por mês: { '2024-11': [...] }
  _lastFetchTime: {},
  _availableTabs: null,

  /**
   * Converte data brasileira para formato ISO (YYYY-MM-DD)
   * Aceita formatos: DD/MM/YYYY, DD/MM/YY, DD/MM (usa ano passado como parâmetro)
   */
  _parseDateString(dateStr, tabName = null, defaultYear = null) {
    try {
      if (!dateStr) return null;

      // Remove espaços extras e pega apenas a parte da data
      let datePart = dateStr.toString().trim().split(' ')[0];

      // Ignora linhas que não são datas (Total, nomes de meses, etc)
      if (datePart.toLowerCase() === 'total' ||
          datePart.toLowerCase() === 'agosto' ||
          datePart.toLowerCase() === 'setembro' ||
          datePart.toLowerCase() === 'outubro' ||
          datePart.toLowerCase() === 'novembro' ||
          !datePart.includes('/')) {
        return null;
      }

      // Tenta diferentes formatos
      let day, month, year;

      // Formato DD/MM/YYYY, DD/MM/YY ou DD/MM
      if (datePart.includes('/')) {
        const parts = datePart.split('/').map(num => parseInt(num.trim(), 10));

        if (parts.length === 2) {
          // Formato DD/MM - usa o ano fornecido ou atual
          [day, month] = parts;
          year = defaultYear || new Date().getFullYear();
        } else if (parts.length >= 3) {
          [day, month, year] = parts;
          // Ajusta ano de 2 dígitos
          if (year < 100) {
            year = year > 50 ? 1900 + year : 2000 + year;
          }
        }
      }
      // Formato DD-MM-YYYY
      else if (datePart.includes('-')) {
        const parts = datePart.split('-').map(num => parseInt(num.trim(), 10));
        if (parts.length >= 3) {
          // Verifica se é YYYY-MM-DD ou DD-MM-YYYY
          if (parts[0] > 1000) {
            [year, month, day] = parts;
          } else {
            [day, month, year] = parts;
          }
        }
      }

      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return null;
      }

      // Validação básica
      if (day < 1 || day > 31 || month < 1 || month > 12) {
        return null;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } catch (error) {
      console.error(`Erro ao analisar data "${dateStr}":`, error);
      return null;
    }
  },

  /**
   * Converte string de valor brasileiro para número
   */
  _parseValue(valueStr) {
    if (!valueStr) return 0;
    // Remove R$, espaços e converte formato brasileiro
    let rawValue = valueStr.toString().replace(/[R$\s]/g, '').trim();
    rawValue = rawValue.replace(/\./g, '');
    rawValue = rawValue.replace(',', '.');
    return parseFloat(rawValue) || 0;
  },

  /**
   * Converte string de porcentagem para número
   */
  _parsePercentage(percentStr) {
    if (!percentStr) return 0;
    let rawValue = percentStr.toString().replace('%', '').trim();
    rawValue = rawValue.replace(',', '.');
    return parseFloat(rawValue) || 0;
  },

  /**
   * Buscar lista de abas disponíveis
   */
  async fetchAvailableTabs() {
    if (this._availableTabs) {
      return this._availableTabs;
    }

    try {
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}&fields=sheets.properties.title`;
      const response = await axios.get(metadataUrl);

      const sheets = response.data.sheets || [];
      this._availableTabs = sheets.map(sheet => sheet.properties.title);
      console.log('Abas disponíveis:', this._availableTabs);

      return this._availableTabs;
    } catch (error) {
      console.error('Erro ao buscar abas:', error);
      return [];
    }
  },

  /**
   * Buscar dados de uma aba específica (mês)
   */
  async fetchDataByTab(tabName, year) {
    const cacheKey = `${year}-${tabName}`;
    const now = Date.now();

    // Cache de 5 minutos
    if (this._cachedData[cacheKey] && this._lastFetchTime[cacheKey] &&
        (now - this._lastFetchTime[cacheKey] < 5 * 60 * 1000)) {
      console.log(`Usando dados em cache para ${tabName}`);
      return this._cachedData[cacheKey];
    }

    try {
      console.log(`Buscando dados da aba "${tabName}"`);

      // Buscar dados da aba específica
      // Formato correto: sheet name sem aspas extras na URL
      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabName)}!A:AE?key=${API_KEY}`;
      console.log('URL da API:', valuesUrl);
      const response = await axios.get(valuesUrl);

      const rows = response.data.values || [];
      console.log(`Total de linhas: ${rows.length}`);

      if (rows.length <= 1) {
        console.log('Planilha vazia ou contém apenas cabeçalhos');
        return [];
      }

      // Encontrar a linha de cabeçalhos (procura por "leads" ou "data" em alguma coluna)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row && row.some(cell =>
          cell && typeof cell === 'string' &&
          (cell.toLowerCase().includes('leads') ||
           cell.toLowerCase().includes('ligações') ||
           cell.toLowerCase().includes('vendas realizadas'))
        )) {
          headerRowIndex = i;
          console.log(`Linha de cabeçalho encontrada na posição ${i}`);
          break;
        }
      }

      const headers = rows[headerRowIndex];
      console.log('Cabeçalhos encontrados:', headers);

      // Função auxiliar para encontrar índice de coluna
      const findColumnIndex = (searchTerms) => {
        for (const term of searchTerms) {
          const index = headers.findIndex(h => h && h.toLowerCase().includes(term.toLowerCase()));
          if (index !== -1) return index;
        }
        return -1;
      };

      // Mapear índices das colunas baseado nos cabeçalhos reais
      const columnMap = {
        data: 0,
        leadsRecebidosTotais: findColumnIndex(['leads recebidos totais', 'leads recebidos']),
        negociosTrabalhados: findColumnIndex(['negócios trabahados', 'negocios trabalhados', 'negócios trabalhados']),
        ligacoesRealizadas: findColumnIndex(['ligações realizadas totais', 'ligacoes realizadas totais']),
        ligacoesAtendidas: findColumnIndex(['ligações atendidadas totais', 'ligacoes atendidas totais', 'ligações atendidadas']),
        mensagensEnviadas: findColumnIndex(['mensagens enviadas totais', 'mensagens enviadas']),
        qualificacoes: findColumnIndex(['qualificações totais', 'qualificacoes totais']),
        reunioesAgendadas: findColumnIndex(['reuniões agendadas totais', 'reunioes agendadas totais']),
        reunioesPrevistas: findColumnIndex(['reuniões previstas']),
        reunioesRealizadasPerpetuo: findColumnIndex(['reuniões realizadas perpétuo', 'perpetuo']),
        previstasSdrIa: findColumnIndex(['previstas sdr ia']),
        realizadasSdrIa: findColumnIndex(['realizadas sdr ia']),
        reunioesRealizadas: findColumnIndex(['reuniões realizadas ']), // Note o espaço no final
        noShow1: findColumnIndex(['no show']),
        vendasRealizadas: findColumnIndex(['vendas    realizadas', 'vendas realizadas']),
        vendaTMB: findColumnIndex(['venda tmb', 'tmb(boleto)']),
        vendaGURU: findColumnIndex(['venda guru', 'guru (cartão)']),
        valorTMB: findColumnIndex(['valor tmb']),
        valorGURU: findColumnIndex(['valor guru']),
        valorVendasRealizadas: findColumnIndex(['valor vendas realizadas', 'valor vendas', 'valor total', 'faturamento']),
        percentTMB: findColumnIndex(['% tmb']),
        percentGURU: findColumnIndex(['% guru']),
        ticketMedio: findColumnIndex(['ticket médio total', 'ticket medio total', 'ticket médio']),
        taxaLigacaoAtendida: findColumnIndex(['ligação x', 'ligacao x']),
        taxaLeadsQualificacao: findColumnIndex(['leads x\nqualificação', 'leads x qualificação']),
        taxaLeadsAgendamento: findColumnIndex(['leads x\nagendamento', 'leads x agendamento']),
        taxaQualificacaoAgendamento: findColumnIndex(['qualificação x agendamento', 'qualificacao x agendamento']),
        taxaOportunidadesRealizadas: findColumnIndex(['oportunidades x realizadas']),
        taxaNoShow: findColumnIndex(['%              no show', '% no show']),
        taxaReunioesVendas: findColumnIndex(['reuniões realizadas x vendas', 'reunioes realizadas x vendas'])
      };

      console.log('Mapa de colunas:', columnMap);

      // Processar dados (pular cabeçalho)
      const dataRows = rows.slice(headerRowIndex + 1);
      const processedData = dataRows.map((row, index) => {
        const dateStr = row[0];
        // Passar o mês do nome da aba para ajudar no parsing
        const date = this._parseDateString(dateStr, tabName, year);

        if (!date) {
          if (index < 5) {
            console.log(`Linha ${headerRowIndex + index + 2} ignorada - data inválida:`, dateStr);
          }
          return null;
        }

        if (index < 3) {
          console.log(`Linha ${headerRowIndex + index + 2} processada - data:`, dateStr, '→', date);
        }

        return {
          id: `radar-${index}`,
          date,
          dateFormatted: dateStr,

          // Leads e Contatos
          leadsRecebidosTotais: parseInt(row[columnMap.leadsRecebidosTotais]) || 0,
          negociosTrabalhados: parseInt(row[columnMap.negociosTrabalhados]) || 0,

          // Ligações
          ligacoesRealizadas: parseInt(row[columnMap.ligacoesRealizadas]) || 0,
          ligacoesAtendidas: parseInt(row[columnMap.ligacoesAtendidas]) || 0,
          mensagensEnviadas: parseInt(row[columnMap.mensagensEnviadas]) || 0,

          // Qualificações
          qualificacoes: parseInt(row[columnMap.qualificacoes]) || 0,

          // Reuniões
          reunioesAgendadas: parseInt(row[columnMap.reunioesAgendadas]) || 0,
          reunioesPrevistas: parseInt(row[columnMap.reunioesPrevistas]) || 0,
          reunioesRealizadasPerpetuo: parseInt(row[columnMap.reunioesRealizadasPerpetuo]) || 0,
          previstasSdrIa: parseInt(row[columnMap.previstasSdrIa]) || 0,
          realizadasSdrIa: parseInt(row[columnMap.realizadasSdrIa]) || 0,
          reunioesRealizadas: parseInt(row[columnMap.reunioesRealizadas]) || 0,
          noShow: parseInt(row[columnMap.noShow1]) || 0,

          // Vendas
          vendasRealizadas: parseInt(row[columnMap.vendasRealizadas]) || 0,
          vendaTMB: parseInt(row[columnMap.vendaTMB]) || 0,
          vendaGURU: parseInt(row[columnMap.vendaGURU]) || 0,

          // Valores
          valorTMB: this._parseValue(row[columnMap.valorTMB]),
          valorGURU: this._parseValue(row[columnMap.valorGURU]),
          valorVendasRealizadas: this._parseValue(row[columnMap.valorVendasRealizadas]),

          // Percentuais de vendas
          percentTMB: this._parsePercentage(row[columnMap.percentTMB]),
          percentGURU: this._parsePercentage(row[columnMap.percentGURU]),
          ticketMedio: this._parseValue(row[columnMap.ticketMedio]),

          // Taxas de conversão
          taxaLigacaoAtendida: this._parsePercentage(row[columnMap.taxaLigacaoAtendida]),
          taxaLeadsQualificacao: this._parsePercentage(row[columnMap.taxaLeadsQualificacao]),
          taxaLeadsAgendamento: this._parsePercentage(row[columnMap.taxaLeadsAgendamento]),
          taxaQualificacaoAgendamento: this._parsePercentage(row[columnMap.taxaQualificacaoAgendamento]),
          taxaOportunidadesRealizadas: this._parsePercentage(row[columnMap.taxaOportunidadesRealizadas]),
          taxaNoShow: this._parsePercentage(row[columnMap.taxaNoShow]),
          taxaReunioesVendas: this._parsePercentage(row[columnMap.taxaReunioesVendas])
        };
      }).filter(item => item !== null);

      console.log(`Dados processados: ${processedData.length} registros para ${tabName}`);

      // Atualizar cache
      this._cachedData[cacheKey] = processedData;
      this._lastFetchTime[cacheKey] = now;

      return processedData;
    } catch (error) {
      console.error(`Erro ao buscar dados da aba ${tabName}:`, error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Buscar todos os dados (para compatibilidade - busca todas as abas)
   */
  async fetchAllData() {
    const tabs = await this.fetchAvailableTabs();
    const currentYear = new Date().getFullYear();
    let allData = [];

    for (const tab of tabs) {
      // Verificar se é uma aba de mês
      const monthNumber = Object.entries(MONTH_TAB_NAMES).find(([, name]) => name === tab)?.[0];
      if (monthNumber) {
        const tabData = await this.fetchDataByTab(tab, currentYear);
        allData = allData.concat(tabData);
      }
    }

    return allData;
  },

  /**
   * Buscar dados por mês específico
   */
  async getDataByMonth(year, month) {
    const tabName = MONTH_TAB_NAMES[month];
    if (!tabName) {
      console.error(`Mês inválido: ${month}`);
      return [];
    }

    // Verificar se a aba existe
    const availableTabs = await this.fetchAvailableTabs();
    if (!availableTabs.includes(tabName)) {
      console.log(`Aba "${tabName}" não encontrada na planilha`);
      return [];
    }

    const data = await this.fetchDataByTab(tabName, year);

    // Filtrar apenas dados do mês selecionado
    const monthStr = String(month).padStart(2, '0');
    const filtered = data.filter(record => {
      const recordMonth = record.date.substring(5, 7);
      return recordMonth === monthStr;
    });

    console.log(`Filtrados ${filtered.length} registros para ${tabName} (de ${data.length} total)`);

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Buscar dados por intervalo de datas
   */
  async getDataByDateRange(startDate, endDate) {
    const allData = await this.fetchAllData();

    const filtered = allData.filter(record => {
      return record.date >= startDate && record.date <= endDate;
    });

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Calcular totais do período
   */
  calculateTotals(data) {
    return data.reduce((acc, record) => ({
      leadsRecebidosTotais: acc.leadsRecebidosTotais + record.leadsRecebidosTotais,
      negociosTrabalhados: acc.negociosTrabalhados + record.negociosTrabalhados,
      ligacoesRealizadas: acc.ligacoesRealizadas + record.ligacoesRealizadas,
      ligacoesAtendidas: acc.ligacoesAtendidas + record.ligacoesAtendidas,
      mensagensEnviadas: acc.mensagensEnviadas + record.mensagensEnviadas,
      qualificacoes: acc.qualificacoes + record.qualificacoes,
      reunioesAgendadas: acc.reunioesAgendadas + record.reunioesAgendadas,
      reunioesPrevistas: acc.reunioesPrevistas + record.reunioesPrevistas,
      reunioesRealizadas: acc.reunioesRealizadas + record.reunioesRealizadas,
      noShow: acc.noShow + record.noShow,
      vendasRealizadas: acc.vendasRealizadas + record.vendasRealizadas,
      vendaTMB: acc.vendaTMB + record.vendaTMB,
      vendaGURU: acc.vendaGURU + record.vendaGURU,
      valorTMB: acc.valorTMB + record.valorTMB,
      valorGURU: acc.valorGURU + record.valorGURU,
      valorVendasRealizadas: acc.valorVendasRealizadas + record.valorVendasRealizadas
    }), {
      leadsRecebidosTotais: 0,
      negociosTrabalhados: 0,
      ligacoesRealizadas: 0,
      ligacoesAtendidas: 0,
      mensagensEnviadas: 0,
      qualificacoes: 0,
      reunioesAgendadas: 0,
      reunioesPrevistas: 0,
      reunioesRealizadas: 0,
      noShow: 0,
      vendasRealizadas: 0,
      vendaTMB: 0,
      vendaGURU: 0,
      valorTMB: 0,
      valorGURU: 0,
      valorVendasRealizadas: 0
    });
  },

  /**
   * Calcular médias das taxas de conversão
   */
  calculateAverageRates(data) {
    if (data.length === 0) return {};

    const sum = data.reduce((acc, record) => ({
      taxaLigacaoAtendida: acc.taxaLigacaoAtendida + record.taxaLigacaoAtendida,
      taxaLeadsQualificacao: acc.taxaLeadsQualificacao + record.taxaLeadsQualificacao,
      taxaLeadsAgendamento: acc.taxaLeadsAgendamento + record.taxaLeadsAgendamento,
      taxaQualificacaoAgendamento: acc.taxaQualificacaoAgendamento + record.taxaQualificacaoAgendamento,
      taxaOportunidadesRealizadas: acc.taxaOportunidadesRealizadas + record.taxaOportunidadesRealizadas,
      taxaNoShow: acc.taxaNoShow + record.taxaNoShow,
      taxaReunioesVendas: acc.taxaReunioesVendas + record.taxaReunioesVendas,
      ticketMedio: acc.ticketMedio + record.ticketMedio
    }), {
      taxaLigacaoAtendida: 0,
      taxaLeadsQualificacao: 0,
      taxaLeadsAgendamento: 0,
      taxaQualificacaoAgendamento: 0,
      taxaOportunidadesRealizadas: 0,
      taxaNoShow: 0,
      taxaReunioesVendas: 0,
      ticketMedio: 0
    });

    const count = data.length;
    return {
      taxaLigacaoAtendida: sum.taxaLigacaoAtendida / count,
      taxaLeadsQualificacao: sum.taxaLeadsQualificacao / count,
      taxaLeadsAgendamento: sum.taxaLeadsAgendamento / count,
      taxaQualificacaoAgendamento: sum.taxaQualificacaoAgendamento / count,
      taxaOportunidadesRealizadas: sum.taxaOportunidadesRealizadas / count,
      taxaNoShow: sum.taxaNoShow / count,
      taxaReunioesVendas: sum.taxaReunioesVendas / count,
      ticketMedio: sum.ticketMedio / count
    };
  },

  /**
   * Obter meses disponíveis nos dados
   */
  async getAvailableMonths() {
    const availableTabs = await this.fetchAvailableTabs();
    const currentYear = new Date().getFullYear();

    // Mapear abas para meses
    const months = [];
    for (const tab of availableTabs) {
      const monthEntry = Object.entries(MONTH_TAB_NAMES).find(([, name]) => name === tab);
      if (monthEntry) {
        const month = parseInt(monthEntry[0]);
        months.push({
          year: currentYear,
          month,
          key: `${currentYear}-${String(month).padStart(2, '0')}`
        });
      }
    }

    // Ordenar por mês (mais recente primeiro)
    return months.sort((a, b) => b.month - a.month);
  },

  /**
   * Obter o mês mais recente disponível
   */
  async getMostRecentMonth() {
    const months = await this.getAvailableMonths();
    return months.length > 0 ? months[0] : null;
  },

  /**
   * Limpar cache
   */
  clearCache() {
    this._cachedData = {};
    this._lastFetchTime = {};
    this._availableTabs = null;
  }
};

export default radarService;
