import axios from 'axios'
import { createAsaasCashLoader } from '../utils/asaasCashRange.js'

const loader = createAsaasCashLoader(async ({ startDate, endDate }) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  const response = await axios.get(`${base}/boleto/asaas/vendas`, { params: { data_inicio: startDate, data_final: endDate }, timeout: 120_000 })
  return response.data
})
export const loadAsaasCashRange = loader.load
export const invalidateAsaasCashCache = loader.invalidate
