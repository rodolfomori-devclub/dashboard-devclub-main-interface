import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../utils/currencyUtils'

function DailyDashboard() {
  const [data, setData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    // Obter data atual em formato local
    const today = new Date()
    // Criar data de 7 dias atrás
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)

    // Formatar para YYYY-MM-DD em fuso horário local
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start: formatLocalDate(sevenDaysAgo),
      end: formatLocalDate(today),
    }
  })

  const convertTimestampToDate = (timestamp) => {
    if (timestamp > 1700000000) {
      // Para timestamps em segundos (formato Unix)
      const date = new Date(timestamp * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Para timestamps em milissegundos (formato JavaScript)
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const fetchData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true)
      console.log(`Buscando dados: De ${startDate} até ${endDate}`);
      
      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        'http://localhost:3000/api/transactions',
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        },
      )

      // Buscar reembolsos
      const refundsResponse = await axios.post(
        'http://localhost:3000/api/refunds',
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        },
      )

      console.log('Dados de transações recebidos:', transactionsResponse.data)
      console.log('Dados de reembolsos recebidos:', refundsResponse.data)

      const dailyDataMap = {}
      let totalAffiliateValue = 0

      // Inicializar o mapa de dados diários
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        dailyDataMap[dateStr] = {
          date: dateStr,
          net_amount: 0,
          quantity: 0,
          affiliate_value: 0,
          refund_amount: 0,
          refund_quantity: 0
        }
      }

      // Processar transações
      if (Array.isArray(transactionsResponse.data.data)) {
        transactionsResponse.data.data.forEach((transaction) => {
          // Converte o timestamp para data local
          const transactionDate = convertTimestampToDate(transaction.dates.created_at);
          
          // Log para debug
          console.log(`Transação: timestamp=${transaction.dates.created_at}, data=${transactionDate}`);
          
          const affiliateValue =
            transaction.calculation_details?.net_affiliate_value || 0

          if (dailyDataMap[transactionDate]) {
            dailyDataMap[transactionDate].net_amount +=
              transaction.calculation_details.net_amount
            dailyDataMap[transactionDate].quantity += 1
            dailyDataMap[transactionDate].affiliate_value += affiliateValue
          } else {
            console.log(`Aviso: Transação com data ${transactionDate} fora do intervalo definido`);
          }

          totalAffiliateValue += affiliateValue
        })
      }

      // Processar reembolsos
      let totalRefundAmount = 0;
      let totalRefundQuantity = 0;

      if (Array.isArray(refundsResponse.data.data)) {
        refundsResponse.data.data.forEach((refund) => {
          // Converte o timestamp para data local
          const refundDate = convertTimestampToDate(refund.dates.created_at);
          
          // Usar o valor líquido calculado pelo backend que aplica as mesmas regras de transações
          const refundAmount = refund.calculation_details?.net_amount || 0;

          if (dailyDataMap[refundDate]) {
            dailyDataMap[refundDate].refund_amount += refundAmount;
            dailyDataMap[refundDate].refund_quantity += 1;
          } else {
            console.log(`Aviso: Reembolso com data ${refundDate} fora do intervalo definido`);
          }

          totalRefundAmount += refundAmount;
          totalRefundQuantity += 1;
        })
      }

      const chartData = Object.values(dailyDataMap)
      console.log('Dados processados:', chartData)
      console.log('Total de valor de afiliações:', totalAffiliateValue)
      console.log('Total de valor de reembolsos:', totalRefundAmount)

      setData({
        dailyData: chartData,
        totals: {
          total_transactions: transactionsResponse.data.totals.total_transactions,
          total_net_amount: transactionsResponse.data.totals.total_net_amount,
          total_net_affiliate_value: totalAffiliateValue,
        },
      })

      setRefundsData({
        total_refund_amount: totalRefundAmount,
        total_refund_quantity: totalRefundQuantity
      })

      setLoading(false)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(dateRange.start, dateRange.end)
  }, [dateRange, fetchData])

  const handleRefreshData = () => {
    fetchData(dateRange.start, dateRange.end)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00'); // Usar meio-dia para evitar problemas de fuso
    return date.toLocaleDateString('pt-BR')
  }

  const handleDateChange = (type, value) => {
    setDateRange((prev) => {
      const newRange = { ...prev, [type]: value }
      if (new Date(newRange.start) <= new Date(newRange.end)) {
        return newRange
      }
      return prev
    })
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-primary dark:text-secondary">
            Dashboard Diário de Vendas
          </h1>
          <button
            onClick={handleRefreshData}
            className="bg-secondary text-primary px-4 py-2 rounded hover:bg-primary hover:text-secondary transition-colors"
          >
            Atualizar Dados
          </button>
        </div>

        <div className="flex gap-4 items-center mb-8">
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Líquido Total
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(data?.totals?.total_net_amount || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Quantidade de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent3 dark:text-accent4">
              {data?.totals?.total_transactions || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(data?.totals?.total_net_affiliate_value || 0)}
            </p>
          </div>
          {/* Novo card de reembolsos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Reembolsos
            </h3>
            <p className="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">
              {formatCurrency(refundsData?.total_refund_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {refundsData?.total_refund_quantity || 0} reembolso(s)
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Dia
          </h3>
          <div className="h-96 relative">
            {loading && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="mt-4 text-text-light dark:text-text-dark">Carregando dados...</p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#404b62"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <YAxis yAxisId="right" orientation="right" stroke="#059669" />
                <Tooltip
                  formatter={(value, name) => {
                    if (
                      name === 'Valor Líquido' ||
                      name === 'Valor de Afiliação' ||
                      name === 'Valor de Reembolso'
                    )
                      return formatCurrency(value)
                    return `${value} vendas`
                  }}
                  labelFormatter={formatDate}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="net_amount"
                  name="Valor Líquido"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  yAxisId="right"
                  dataKey="quantity"
                  name="Quantidade"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  yAxisId="left"
                  dataKey="affiliate_value"
                  name="Valor de Afiliação"
                  fill="#F97316"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                {/* Nova barra para reembolsos */}
                <Bar
                  yAxisId="left"
                  dataKey="refund_amount"
                  name="Valor de Reembolso"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailyDashboard