import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

export const refundsService = {
  async getAll() {
    const response = await axios.get(`${API_URL}/reembolsos/all`, { timeout: 60000 })
    return response.data
  },

  async getTypeform() {
    const response = await axios.get(`${API_URL}/reembolsos/typeform`, { timeout: 30000 })
    return response.data
  },

  async getPlanilha() {
    const response = await axios.get(`${API_URL}/reembolsos/planilha`, { timeout: 30000 })
    return response.data
  },

  async getVendasMensais(meses) {
    const response = await axios.get(`${API_URL}/reembolsos/vendas-mensais`, {
      params: { meses: meses.join(',') },
      timeout: 120000,
    })
    return response.data
  },
}
