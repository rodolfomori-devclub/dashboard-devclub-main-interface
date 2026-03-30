import axios from 'axios';
import { boletoService } from './boletoService';

const API_URL = import.meta.env.VITE_API_URL;

export const revenueService = {
  /**
   * Busca faturamento por período usando as APIs do Guru (cartão) e TMB (boleto)
   * @param {string} startDate - Data de início (YYYY-MM-DD)
   * @param {string} endDate - Data de fim (YYYY-MM-DD)
   * @returns {Object} Dados de faturamento consolidados
   */
  async getRevenueByDateRange(startDate, endDate) {
    try {
    

      // 1. Buscar transações de cartão (GURU)
      let cardTransactions = [];
      try {
        const cardResponse = await axios.post(`${API_URL}/transactions`, {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        });
        cardTransactions = cardResponse.data.data || [];

      } catch (error) {
        console.error('Erro ao buscar transações de cartão (Guru):', error);
      }

      // 1b. Buscar vendas Hotmart (cartão)
      let hotmartTotalNet = 0;
      let hotmartTotalCount = 0;
      try {
        const hotmartResponse = await axios.get(`${API_URL}/hotmart/vendas`, {
          params: { data_inicio: startDate, data_final: endDate },
          timeout: 30000,
        });
        if (hotmartResponse.data?.success) {
          const hotmartData = hotmartResponse.data.data;
          hotmartTotalNet = hotmartData?.totalNet || 0;
          hotmartTotalCount = hotmartData?.count || 0;
        }
      } catch (error) {
        console.error('Erro ao buscar vendas Hotmart:', error);
      }

      // 2. Buscar vendas de boleto (TMB)
      let boletoSales = [];
      try {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        boletoSales = await boletoService.getSalesByDateRange(startDateObj, endDateObj);

      } catch (error) {
        console.error('Erro ao buscar vendas de boleto:', error);
      }

      // 2b. Buscar vendas Asaas (boleto parcelado)
      let asaasTotalValue = 0;
      let asaasTotalCount = 0;
      try {
        let asaasResponse;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            asaasResponse = await axios.get(`${API_URL}/boleto/asaas/vendas`, {
              params: { data_inicio: startDate, data_final: endDate },
              timeout: 60000,
            });
            break;
          } catch (err) {
            if (err?.response?.status === 429 && attempt < 3) {
              console.log(`Asaas 429 - retry ${attempt}/3 em ${attempt * 10}s...`);
              await new Promise(r => setTimeout(r, attempt * 10000));
              continue;
            }
            throw err;
          }
        }
        if (asaasResponse?.data?.success) {
          const asaasData = asaasResponse.data.data;
          asaasTotalValue = asaasData?.sales?.totalValue || 0;
          asaasTotalCount = asaasData?.sales?.count || 0;
        }
      } catch (error) {
        console.error('Erro ao buscar vendas Asaas:', error);
      }

      // 3. Processar dados de cartão
      let totalCardRevenue = 0;
      let totalCardSales = 0;
      const cardRevenueByDay = {};

      cardTransactions.forEach(transaction => {
        const netAmount = Number(transaction?.calculation_details?.net_amount || 0);
        totalCardRevenue += netAmount;
        totalCardSales += 1;

        // Agrupar por dia
        const timestamp = transaction.dates?.created_at * 1000;
        const date = new Date(timestamp);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!cardRevenueByDay[dateStr]) {
          cardRevenueByDay[dateStr] = { revenue: 0, sales: 0 };
        }
        cardRevenueByDay[dateStr].revenue += netAmount;
        cardRevenueByDay[dateStr].sales += 1;
      });

      // 4. Processar dados de boleto
      let totalBoletoRevenue = 0;
      let totalBoletoSales = 0;
      const boletoRevenueByDay = {};

      boletoSales.forEach(sale => {
        const value = Number(sale.value || 0);
        totalBoletoRevenue += value;
        totalBoletoSales += 1;

        // Agrupar por dia
        const date = sale.date?.timestamp || sale.timestamp;
        const d = new Date(date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        if (!boletoRevenueByDay[dateStr]) {
          boletoRevenueByDay[dateStr] = { revenue: 0, sales: 0 };
        }
        boletoRevenueByDay[dateStr].revenue += value;
        boletoRevenueByDay[dateStr].sales += 1;
      });

      // 5. Consolidar dados por dia
      const allDates = new Set([
        ...Object.keys(cardRevenueByDay),
        ...Object.keys(boletoRevenueByDay)
      ]);

      const dailyRevenue = Array.from(allDates).map(date => ({
        date,
        cardRevenue: cardRevenueByDay[date]?.revenue || 0,
        cardSales: cardRevenueByDay[date]?.sales || 0,
        boletoRevenue: boletoRevenueByDay[date]?.revenue || 0,
        boletoSales: boletoRevenueByDay[date]?.sales || 0,
        totalRevenue: (cardRevenueByDay[date]?.revenue || 0) + (boletoRevenueByDay[date]?.revenue || 0),
        totalSales: (cardRevenueByDay[date]?.sales || 0) + (boletoRevenueByDay[date]?.sales || 0)
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Incluir Hotmart no total de cartão (Guru + Hotmart)
      const combinedCardRevenue = totalCardRevenue + hotmartTotalNet;
      const combinedCardSales = totalCardSales + hotmartTotalCount;

      // Incluir Asaas no total de boleto (TMB + Asaas)
      const combinedBoletoRevenue = totalBoletoRevenue + asaasTotalValue;
      const combinedBoletoSales = totalBoletoSales + asaasTotalCount;

      const result = {
        period: { startDate, endDate },
        totals: {
          cardRevenue: combinedCardRevenue,
          cardSales: combinedCardSales,
          boletoRevenue: combinedBoletoRevenue,
          boletoSales: combinedBoletoSales,
          totalRevenue: combinedCardRevenue + combinedBoletoRevenue,
          totalSales: combinedCardSales + combinedBoletoSales
        },
        daily: dailyRevenue,
        raw: {
          cardTransactions,
          boletoSales
        }
      };



      return result;
    } catch (error) {
      console.error('Erro ao buscar faturamento:', error);
      throw error;
    }
  },

  /**
   * Busca faturamento por LF usando as datas de abertura e fechamento
   * @param {Array} launches - Array de lançamentos com datas
   * @returns {Array} Array com faturamento por LF
   */
  async getRevenueByLaunch(launches) {
    try {


      const revenueByLaunch = [];

      for (const launch of launches) {
        const launchName = launch['Lançamento'];
        
        // Pegar todas as colunas do lançamento
        const allColumns = Object.keys(launch);
        
        // Procurar por valores de data nas últimas colunas
        const dateValues = [];
        const lastColumns = allColumns.slice(-5); // Últimas 5 colunas
        
        lastColumns.forEach((column, index) => {
          const value = launch[column];
          if (value && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(value)) {
            dateValues.push({
              column,
              value,
              position: allColumns.length - 5 + index + 1
            });
          }
        });
        
        // Usar a penúltima data como abertura e a última como fechamento
        let openDate = null;
        let closeDate = null;
        
        if (dateValues.length >= 2) {
          const openingDate = dateValues[dateValues.length - 2];
          const closingDate = dateValues[dateValues.length - 1];
          
          openDate = this.convertBrazilianDateToISO(openingDate.value);
          closeDate = this.convertBrazilianDateToISO(closingDate.value);
          

        }

        if (!openDate || !closeDate) {

          
          revenueByLaunch.push({
            launch: launchName,
            openDate,
            closeDate,
            revenue: 0,
            error: 'Datas não encontradas'
          });
          continue;
        }

        try {

          
          const revenueData = await this.getRevenueByDateRange(openDate, closeDate);
          
          revenueByLaunch.push({
            launch: launchName,
            openDate,
            closeDate,
            revenue: revenueData.totals.totalRevenue,
            cardRevenue: revenueData.totals.cardRevenue,
            boletoRevenue: revenueData.totals.boletoRevenue,
            totalSales: revenueData.totals.totalSales,
            cardSales: revenueData.totals.cardSales,
            boletoSales: revenueData.totals.boletoSales,
            dailyData: revenueData.daily,
            period: revenueData.period
          });


        } catch (error) {
          console.error(`❌ Erro ao buscar faturamento para ${launchName}:`, error);
          revenueByLaunch.push({
            launch: launchName,
            openDate,
            closeDate,
            revenue: 0,
            error: error.message
          });
        }

        // Aguardar um pouco entre as requisições para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return revenueByLaunch;
    } catch (error) {
      console.error('Erro ao buscar faturamento por lançamento:', error);
      throw error;
    }
  },

  /**
   * Converte data brasileira (DD/MM/YYYY) para formato ISO (YYYY-MM-DD)
   * @param {string} dateStr - Data no formato brasileiro
   * @returns {string} Data no formato ISO
   */
  convertBrazilianDateToISO(dateStr) {
    if (!dateStr) return null;
    
    // Formato: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    return null;
  },

  /**
   * Formata valor monetário
   * @param {number} value - Valor a ser formatado
   * @returns {string} Valor formatado
   */
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value || 0);
  }
}; 