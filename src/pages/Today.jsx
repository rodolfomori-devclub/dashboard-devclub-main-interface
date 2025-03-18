import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../utils/currencyUtils'

const COLORS = [
  '#8A2BE2',
  '#00FF00',
  '#FF4500',
  '#1E90FF',
  '#FFD700',
  '#FF1493',
]

function Today() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [displayDate, setDisplayDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [todayData, setTodayData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDayData = useCallback(async (date) => {
    try {
      setLoading(true)

      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        'https://dash.launchcontrol.com.br/api/transactions',
        {
          // const transactionsResponse = await axios.post('http://localhost:3000/api/transactions', {
          ordered_at_ini: date,
          ordered_at_end: date,
        },
      )

      // Buscar transações reembolsadas
      const refundsResponse = await axios.post(
        // 'http://localhost:3000/api/refunds',
        'https://dash.launchcontrol.com.br/api/refunds',
        {
          ordered_at_ini: date,
          ordered_at_end: date,
        },
      )

      // Processar dados de transações
      const hourlyData = Array(24)
        .fill()
        .map((_, index) => ({
          hour: index,
          sales: 0,
          value: 0,
          affiliateValue: 0,
          refundCount: 0,
          refundValue: 0,
          commercialSales: 0,
          commercialValue: 0,
        }))

      let totalSales = 0
      let totalValue = 0
      let totalAffiliateValue = 0
      let totalCommercialValue = 0
      let totalCommercialSales = 0
      const productSales = {}

      transactionsResponse.data.data.forEach((transaction) => {
        const hour = new Date(transaction.dates.created_at * 1000).getHours()
        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0,
        )
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0,
        )
        
        // Verificar se é uma venda do comercial - CORRIGIDO
        const isCommercial = transaction.trackings?.utm_source === 'comercial'

        hourlyData[hour].sales += 1
        hourlyData[hour].value += netAmount
        hourlyData[hour].affiliateValue += affiliateValue
        
        if (isCommercial) {
          hourlyData[hour].commercialSales += 1
          hourlyData[hour].commercialValue += netAmount
          totalCommercialSales += 1
          totalCommercialValue += netAmount
        }

        totalSales += 1
        totalValue += netAmount
        totalAffiliateValue += affiliateValue

        const productName = transaction.product.name
        if (!productSales[productName]) {
          productSales[productName] = { 
            quantity: 0, 
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0 
          }
        }
        productSales[productName].quantity += 1
        productSales[productName].value += netAmount
        
        if (isCommercial) {
          productSales[productName].commercialQuantity += 1
          productSales[productName].commercialValue += netAmount
        }
      })

      // Processar dados de reembolsos
      let totalRefunds = 0
      let totalRefundAmount = 0
      const refundsByProduct = {}

      refundsResponse.data.data.forEach((refund) => {
        const productName = refund.product?.name || 'Produto não especificado'
        // Usar o valor líquido calculado pelo backend que aplica as mesmas regras de transações
        const refundAmount = Number(refund.calculation_details?.net_amount || 0)

        if (!refundsByProduct[productName]) {
          refundsByProduct[productName] = { count: 0, amount: 0 }
        }

        refundsByProduct[productName].count += 1
        refundsByProduct[productName].amount += refundAmount

        totalRefunds += 1
        totalRefundAmount += refundAmount
      })

      // Converter para array para o gráfico
      const refundProductData = Object.entries(refundsByProduct).map(
        ([name, data]) => ({
          name,
          refundCount: data.count,
          refundValue: data.amount,
        }),
      )

      // Adicionar reembolsos aos dados por hora para manter compatibilidade
      hourlyData.forEach((hour, index) => {
        hourlyData[index].refundCount = 0
        hourlyData[index].refundValue = 0
      })

      const productData = Object.entries(productSales).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        value: data.value,
        commercialQuantity: data.commercialQuantity || 0,
        commercialValue: data.commercialValue || 0
      }))

      setTodayData({
        hourlyData,
        totalSales,
        totalValue,
        totalAffiliateValue,
        productData,
        refundProductData,
      })

      setRefundsData({
        totalRefunds,
        totalRefundAmount,
      })
      
      setCommercialData({
        totalCommercialSales,
        totalCommercialValue
      })

      setLoading(false)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDayData(selectedDate)

    // Se estiver exibindo o dia atual, atualiza a cada 5 minutos
    let interval
    if (selectedDate === new Date().toISOString().split('T')[0]) {
      interval = setInterval(() => fetchDayData(selectedDate), 5 * 60 * 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [fetchDayData, selectedDate])

  const handleDateChange = (e) => {
    setDisplayDate(e.target.value)
  }

  const handleSearch = () => {
    setSelectedDate(displayDate)
  }

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setDisplayDate(today)
    setSelectedDate(today)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-secondary"></div>
      </div>
    )
  }

  // Formatação da data para exibição mais amigável
  const formattedDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <h1 className="text-3xl font-bold text-primary dark:text-secondary">
            Dashboard
          </h1>

          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
            <input
              type="date"
              value={displayDate}
              onChange={handleDateChange}
              className="px-4 py-2 border rounded-lg text-text-light dark:text-text-dark bg-white dark:bg-gray-700"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-gray-800 rounded-lg hover:bg-opacity-90"
            >
              Pesquisar
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-accent1 text-white dark:bg-accent2 dark:text-gray-800 rounded-lg hover:bg-opacity-90"
            >
              Hoje
            </button>
          </div>
        </div>

        <h2 className="text-xl text-text-light dark:text-text-dark mb-6 capitalize">
          {formattedDate}
        </h2>

        {/* Resumo do dia */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Total de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(todayData?.totalValue)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Quantidade de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent3 dark:text-accent4">
              {todayData?.totalSales}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(todayData?.totalAffiliateValue)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Reembolsos
            </h3>
            <p className="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">
              {formatCurrency(refundsData?.totalRefundAmount)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {refundsData?.totalRefunds} reembolso(s)
            </p>
          </div>
          {/* Novo card para vendas do comercial */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Comercial
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-500 dark:text-blue-400">
              {formatCurrency(commercialData?.totalCommercialValue)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {commercialData?.totalCommercialSales} venda(s)
            </p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Progressão por Hora */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Progressão por Hora
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={todayData?.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="value"
                    name="Valor (R$)"
                    stroke="#8884d8"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sales"
                    name="Vendas"
                    stroke="#82ca9d"
                  />
                  {/* Nova linha para vendas do comercial */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="commercialValue"
                    name="Valor Comercial (R$)"
                    stroke="#3B82F6"
                    strokeDasharray="5 5"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="commercialSales"
                    name="Vendas Comercial"
                    stroke="#60A5FA"
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vendas por Produto */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Vendas por Produto
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={todayData?.productData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >
                    {todayData?.productData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quantidade de Vendas por Produto */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Quantidade de Vendas por Produto
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todayData?.productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" name="Total" fill="#8884d8" />
                  <Bar dataKey="commercialQuantity" name="Comercial" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Valor de Vendas por Produto (incluindo comercial) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Valor de Vendas por Produto
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todayData?.productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="value" name="Total" fill="#8884d8" />
                  <Bar dataKey="commercialValue" name="Comercial" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Today