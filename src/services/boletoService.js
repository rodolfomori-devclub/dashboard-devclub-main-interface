// // src/services/boletoService.js

// import { db } from '../firebase';
// import { 
//   collection, 
//   query, 
//   where, 
//   getDocs, 
//   Timestamp 
// } from 'firebase/firestore';

// /**
//  * Serviço para consulta de vendas via boleto (TMB)
//  * Futuramente será substituído pela API da TMB
//  */
// export const boletoService = {
//   /**
//    * Obtém vendas de boleto em um intervalo de datas
//    * @param {Date} startDate Data inicial
//    * @param {Date} endDate Data final
//    * @returns {Promise<Array>} Array de vendas
//    */
//   async getSalesByDateRange(startDate, endDate) {
//     try {
//       // Converter datas para Timestamp do Firestore
//       const startTimestamp = Timestamp.fromDate(startDate);
//       const endTimestamp = Timestamp.fromDate(endDate);
      
//       // Consultar vendas no período
//       const salesRef = collection(db, 'tmb_boleto_sales');
//       const q = query(
//         salesRef,
//         where('timestamp', '>=', startTimestamp),
//         where('timestamp', '<=', endTimestamp)
//       );
      
//       const querySnapshot = await getDocs(q);
      
//       // Mapear documentos para formato padronizado
//       const sales = querySnapshot.docs.map(doc => {
//         const data = doc.data();
//         return {
//           id: doc.id,
//           product: data.product,
//           value: data.value || 0,
//           timestamp: data.timestamp?.toDate() || new Date(),
//           payment_method: 'boleto',
//           channel: data.channel || 'TMB',
//           // Formatar como objeto compatível com o formato das transações do PagarMe
//           dates: {
//             created_at: Math.floor(data.timestamp?.toDate().getTime() / 1000) // Converter para timestamp Unix
//           },
//           calculation_details: {
//             net_amount: data.value || 0,
//             net_affiliate_value: 0, // Boletos não têm afiliados
//             payment_method: 'boleto'
//           }
//         };
//       });
      
//       return sales;
//     } catch (error) {
//       console.error('Erro ao buscar vendas de boleto:', error);
//       return [];
//     }
//   },

//   /**
//    * Obtém vendas de boleto para uma data específica
//    * @param {Date} date Data específica
//    * @returns {Promise<Array>} Array de vendas
//    */
//   async getSalesByDate(date) {
//     // Criar versão da data com início do dia
//     const startDate = new Date(date);
//     startDate.setHours(0, 0, 0, 0);
    
//     // Criar versão da data com fim do dia
//     const endDate = new Date(date);
//     endDate.setHours(23, 59, 59, 999);
    
//     return this.getSalesByDateRange(startDate, endDate);
//   },

//   /**
//    * Obtém vendas de boleto para um mês específico
//    * @param {number} year Ano
//    * @param {number} month Mês (0-11)
//    * @returns {Promise<Array>} Array de vendas
//    */
//   async getSalesByMonth(year, month) {
//     // Primeiro dia do mês
//     const startDate = new Date(year, month, 1);
//     startDate.setHours(0, 0, 0, 0);
    
//     // Último dia do mês
//     const endDate = new Date(year, month + 1, 0);
//     endDate.setHours(23, 59, 59, 999);
    
//     return this.getSalesByDateRange(startDate, endDate);
//   },

//   /**
//    * Obtém vendas de boleto para um ano específico
//    * @param {number} year Ano
//    * @returns {Promise<Array>} Array de vendas
//    */
//   async getSalesByYear(year) {
//     // Primeiro dia do ano
//     const startDate = new Date(year, 0, 1);
//     startDate.setHours(0, 0, 0, 0);
    
//     // Último dia do ano
//     const endDate = new Date(year, 11, 31);
//     endDate.setHours(23, 59, 59, 999);
    
//     return this.getSalesByDateRange(startDate, endDate);
//   }
// };

// export default boletoService;
// src/services/boletoService.js
import axios from 'axios';

// ID da planilha do Google Sheets
// https://drive.google.com/open?id=1NOj8TdVXGddTuxIQOv-4JYHxlzPbQWml&usp=drive_fs
const SHEET_ID = '12W7rG0P4fPUHkaccJ26KNa877LkqcRo5gv4gO5RQfFA';

// API Key (em um ambiente de produção, isto deveria estar protegido via variáveis de ambiente)
// Para simplicidade, estamos usando uma conexão pública de leitura apenas
// const API_KEY = 'AIzaSyBOXnnT1F-h9s1FP3063BQ_-vE3gT3yfwk';
// const API_KEY = 'AIzaSyBG_fHr7v0kfT2e5kXnNa68VMQyOUQY1Dw';
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';





/**
 * Serviço para consulta de vendas via boleto (TMB) do Google Sheets
 */
export const boletoService = {
  /**
   * Busca todos os dados da planilha
   * @returns {Promise<Array>} Array de vendas
   */
  async fetchAllSheetData() {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Vendas!A:E?key=${API_KEY}`;
      
      const response = await axios.get(url);
      const rows = response.data.values || [];
      
      // Pular a primeira linha (cabeçalhos)
      const dataRows = rows.slice(1);
      
      // Converter para o formato esperado pelos dashboards
      return dataRows.map(row => {
        const [dateStr, product, value, payment_method, channel] = row;
        
        // Converter data para objeto Date (assume formato DD/MM/YYYY)
        const [day, month, year] = dateStr.split('/').map(num => parseInt(num));
        const timestamp = new Date(year, month - 1, day, 12, 0, 0);
        
        // Converter valor para número (assume formato R$ 1.234,56)
        const numericValue = parseFloat(
          value.replace('R$', '')
               .replace('.', '')
               .replace(',', '.')
               .trim()
        );
        
        return {
          id: `sheet-${dateStr}-${product}-${Math.random().toString(36).substring(2, 10)}`,
          product,
          value: numericValue,
          timestamp,
          payment_method: payment_method || 'boleto',
          channel: channel || 'TMB',
          // Formatar como objeto compatível com o formato das transações do PagarMe
          dates: {
            created_at: Math.floor(timestamp.getTime() / 1000) // Converter para timestamp Unix
          },
          calculation_details: {
            net_amount: numericValue,
            net_affiliate_value: 0, // Boletos não têm afiliados
            payment_method: 'boleto'
          }
        };
      });
    } catch (error) {
      console.error('Erro ao buscar dados da planilha do Google Sheets:', error);
      return [];
    }
  },

  /**
   * Filtra as vendas por intervalo de data
   * @param {Date} startDate Data inicial
   * @param {Date} endDate Data final
   * @returns {Promise<Array>} Array de vendas filtradas
   */
  async getSalesByDateRange(startDate, endDate) {
    try {
      const allSales = await this.fetchAllSheetData();
      
      // Filtrar por intervalo de datas
      return allSales.filter(sale => {
        const saleDate = sale.timestamp;
        return saleDate >= startDate && saleDate <= endDate;
      });
    } catch (error) {
      console.error('Erro ao filtrar vendas por intervalo de datas:', error);
      return [];
    }
  },

  /**
   * Obtém vendas de boleto para uma data específica
   * @param {Date} date Data específica
   * @returns {Promise<Array>} Array de vendas
   */
  async getSalesByDate(date) {
    // Criar versão da data com início do dia
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    // Criar versão da data com fim do dia
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    return this.getSalesByDateRange(startDate, endDate);
  },

  /**
   * Obtém vendas de boleto para um mês específico
   * @param {number} year Ano
   * @param {number} month Mês (0-11)
   * @returns {Promise<Array>} Array de vendas
   */
  async getSalesByMonth(year, month) {
    // Primeiro dia do mês
    const startDate = new Date(year, month, 1);
    startDate.setHours(0, 0, 0, 0);
    
    // Último dia do mês
    const endDate = new Date(year, month + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return this.getSalesByDateRange(startDate, endDate);
  },

  /**
   * Obtém vendas de boleto para um ano específico
   * @param {number} year Ano
   * @returns {Promise<Array>} Array de vendas
   */
  async getSalesByYear(year) {
    // Primeiro dia do ano
    const startDate = new Date(year, 0, 1);
    startDate.setHours(0, 0, 0, 0);
    
    // Último dia do ano
    const endDate = new Date(year, 11, 31);
    endDate.setHours(23, 59, 59, 999);
    
    return this.getSalesByDateRange(startDate, endDate);
  }
};

export default boletoService;