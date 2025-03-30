// src/services/goalsService.js
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where } from "firebase/firestore";

/**
 * Serviço para gerenciar metas de vendas no Firebase
 */
export const goalsService = {
  /**
   * Buscar meta geral para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @param {string} goalType - Tipo de objetivo: 'meta', 'superMeta', 'ultraMeta'
   * @returns {Promise<number>} Valor da meta
   */
  async getGoal(type, year, month = null, goalType = 'meta') {
    try {
      let docPath;
      if (type === 'month' && month) {
        docPath = `goals/monthly/${year}/${month}`;
      } else if (type === 'year') {
        docPath = `goals/yearly/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }
      
      const goalDoc = await getDoc(doc(db, docPath));
      
      if (goalDoc.exists()) {
        return goalDoc.data()[goalType] || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
      return 0;
    }
  },
  
  /**
   * Salvar meta geral para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @param {string} goalType - Tipo de objetivo: 'meta', 'superMeta', 'ultraMeta'
   * @param {number} value - Valor da meta
   * @returns {Promise<void>}
   */
  async saveGoal(type, year, month = null, goalType = 'meta', value) {
    try {
      let docPath;
      if (type === 'month' && month) {
        docPath = `goals/monthly/${year}/${month}`;
      } else if (type === 'year') {
        docPath = `goals/yearly/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }
      
      const goalRef = doc(db, docPath);
      const goalDoc = await getDoc(goalRef);
      
      if (goalDoc.exists()) {
        // Atualizar documento existente
        await updateDoc(goalRef, {
          [goalType]: value,
          updatedAt: new Date()
        });
      } else {
        // Criar novo documento
        await setDoc(goalRef, {
          [goalType]: value,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      throw error;
    }
  },
  
  /**
   * Buscar todas as metas para um período específico
   * @param {string} type - Tipo de meta: 'month', 'year'
   * @param {number} year - Ano da meta
   * @param {number|null} month - Mês da meta (1-12), nulo se for meta anual
   * @returns {Promise<Object>} Objeto com todas as metas (meta, superMeta, ultraMeta)
   */
  async getAllGoals(type, year, month = null) {
    try {
      let docPath;
      if (type === 'month' && month) {
        docPath = `goals/monthly/${year}/${month}`;
      } else if (type === 'year') {
        docPath = `goals/yearly/${year}`;
      } else {
        throw new Error('Tipo de meta inválido');
      }
      
      const goalDoc = await getDoc(doc(db, docPath));
      
      if (goalDoc.exists()) {
        const data = goalDoc.data();
        return {
          meta: data.meta || 0,
          superMeta: data.superMeta || 0,
          ultraMeta: data.ultraMeta || 0
        };
      }
      
      return {
        meta: 0,
        superMeta: 0,
        ultraMeta: 0
      };
    } catch (error) {
      console.error('Erro ao buscar metas:', error);
      return {
        meta: 0,
        superMeta: 0,
        ultraMeta: 0
      };
    }
  },
  
  /**
   * Buscar meta individual de um vendedor para um período
   * @param {string} sellerId - ID do vendedor
   * @param {number} year - Ano da meta
   * @param {number} month - Mês da meta (1-12)
   * @returns {Promise<number>} Valor da meta
   */
  async getSellerGoal(sellerId, year, month) {
    try {
      const sellerGoalDoc = await getDoc(doc(db, `sellerGoals/${sellerId}/${year}/${month}`));
      
      if (sellerGoalDoc.exists()) {
        return sellerGoalDoc.data().value || 0;
      }
      
      return 0;
    } catch (error) {
      console.error(`Erro ao buscar meta do vendedor ${sellerId}:`, error);
      return 0;
    }
  },
  
  /**
   * Salvar meta individual de um vendedor para um período
   * @param {string} sellerId - ID do vendedor
   * @param {string} sellerName - Nome do vendedor
   * @param {number} year - Ano da meta
   * @param {number} month - Mês da meta (1-12)
   * @param {number} value - Valor da meta
   * @returns {Promise<void>}
   */
  async saveSellerGoal(sellerId, sellerName, year, month, value) {
    try {
      const goalRef = doc(db, `sellerGoals/${sellerId}/${year}/${month}`);
      
      await setDoc(goalRef, {
        value,
        sellerName,
        year,
        month,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error(`Erro ao salvar meta do vendedor ${sellerId}:`, error);
      throw error;
    }
  },
  
  /**
   * Buscar todas as metas individuais dos vendedores para um período
   * @param {number} year - Ano das metas
   * @param {number} month - Mês das metas (1-12)
   * @returns {Promise<Array>} Array com objetos de metas dos vendedores
   */
  async getAllSellerGoals(year, month) {
    try {
      const sellerGoals = [];
      
      // Não temos uma maneira direta de consultar todos os IDs de vendedores
      // Uma opção seria manter uma lista de vendedores em um documento separado
      // Por enquanto, vamos retornar um array vazio
      
      return sellerGoals;
    } catch (error) {
      console.error('Erro ao buscar metas dos vendedores:', error);
      return [];
    }
  }
};

export default goalsService;