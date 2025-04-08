import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import boletoService from '../services/boletoService'
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
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    // Obter data atual em formato local
    const today = new Date()
    // Criar data de 7 dias atrás
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)

    // Formatar para YYYY-MM-DD em fuso horário local
    const formatLocalDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return {
      start: formatLocalDate(sevenDaysAgo),
      end: formatLocalDate(today),
    }
  })

  const convertTimestampToDate = (timestamp) => {
    if (timestamp > 1700000000) {
      // Para timestamps em segundos (formato Unix)
      const date = new Date(timestamp * 1000)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    // Para timestamps em milissegundos (formato JavaScript)
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true)
      console.log(`Buscando dados: De ${startDate} até ${endDate}`)

      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        },
      )

      // Buscar reembolsos
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        },
      )

      // Buscar vendas de boleto
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59')
      const boletoSales = await boletoService.getSalesByDateRange(start, end)

      console.log('Dados de transações recebidos:', transactionsResponse.data)
      console.log('Dados de reembolsos recebidos:', refundsResponse.data)
      console.log('Dados de boleto recebidos:', boletoSales)

      const dailyDataMap = {}
      let totalAffiliateValue = 0
      let totalCommercialValue = 0
      let totalCommercialQuantity = 0
      let totalBoletoValue = 0
      let totalBoletoQuantity = 0

      // Inicializar o mapa de dados diários
      const start_date = new Date(startDate + 'T00:00:00')
      const end_date = new Date(endDate + 'T23:59:59')
      for (
        let d = new Date(start_date);
        d <= end_date;
        d.setDate(d.getDate() + 1)
      ) {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`

        dailyDataMap[dateStr] = {
          date: dateStr,
          net_amount: 0,
          quantity: 0,
          affiliate_value: 0,
          refund_amount: 0,
          refund_quantity: 0,
          commercial_value: 0,
          commercial_quantity: 0,
          boleto_value: 0,
          boleto_quantity: 0,
        }
      }

      // Processar transações
      if (Array.isArray(transactionsResponse.data.data)) {
        transactionsResponse.data.data.forEach((transaction) => {
          // Converte o timestamp para data local
          const transactionDate = convertTimestampToDate(
            transaction.dates.created_at,
          )

          // Log para debug
          console.log(
            `Transação: timestamp=${transaction.dates.created_at}, data=${transactionDate}`,
          )

          const netAmount = Number(
            transaction.calculation_details?.net_amount || 0,
          )
          const affiliateValue = Number(
            transaction.calculation_details?.net_affiliate_value || 0,
          )

          // Verificar se é uma venda do comercial
          const isCommercial = transaction.trackings?.utm_source === 'comercial'

          if (dailyDataMap[transactionDate]) {
            dailyDataMap[transactionDate].net_amount += netAmount
            dailyDataMap[transactionDate].quantity += 1
            dailyDataMap[transactionDate].affiliate_value += affiliateValue

            if (isCommercial) {
              dailyDataMap[transactionDate].commercial_value += netAmount
              dailyDataMap[transactionDate].commercial_quantity += 1
              totalCommercialValue += netAmount
              totalCommercialQuantity += 1
            }
          } else {
            console.log(
              `Aviso: Transação com data ${transactionDate} fora do intervalo definido`,
            )
          }

          totalAffiliateValue += affiliateValue
        })
      }

      // Processar reembolsos
      let totalRefundAmount = 0
      let totalRefundQuantity = 0

      if (Array.isArray(refundsResponse.data.data)) {
        refundsResponse.data.data.forEach((refund) => {
          // Converte o timestamp para data local
          const refundDate = convertTimestampToDate(refund.dates.created_at)

          // Usar o valor líquido calculado pelo backend que aplica as mesmas regras de transações
          const refundAmount = refund.calculation_details?.net_amount || 0

          if (dailyDataMap[refundDate]) {
            dailyDataMap[refundDate].refund_amount += refundAmount
            dailyDataMap[refundDate].refund_quantity += 1
          } else {
            console.log(
              `Aviso: Reembolso com data ${refundDate} fora do intervalo definido`,
            )
          }

          totalRefundAmount += refundAmount
          totalRefundQuantity += 1
        })
      }

      // Processar vendas de boleto
      boletoSales.forEach((sale) => {
        if (!sale || !sale.timestamp) return

        // Converte para data local
        const saleDate = new Date(sale.timestamp)
        const dateStr = saleDate.toISOString().split('T')[0]
        const saleValue = sale.value || 0

        if (dailyDataMap[dateStr]) {
          dailyDataMap[dateStr].boleto_value += saleValue
          dailyDataMap[dateStr].boleto_quantity += 1
          // Adicionar também aos totais gerais
          dailyDataMap[dateStr].net_amount += saleValue
          dailyDataMap[dateStr].quantity += 1
        } else {
          console.log(
            `Venda de boleto com data ${dateStr} fora do intervalo definido`,
          )
        }

        totalBoletoValue += saleValue
        totalBoletoQuantity += 1
      })

      const chartData = Object.values(dailyDataMap)
      console.log('Dados processados:', chartData)
      console.log('Total de valor de afiliações:', totalAffiliateValue)
      console.log('Total de valor de reembolsos:', totalRefundAmount)
      console.log('Total de valor de vendas comercial:', totalCommercialValue)
      console.log('Total de valor de vendas boleto:', totalBoletoValue)

      setData({
        dailyData: chartData,
        totals: {
          total_transactions:
            transactionsResponse.data.totals.total_transactions +
            totalBoletoQuantity,
          total_net_amount:
            transactionsResponse.data.totals.total_net_amount +
            totalBoletoValue,
          total_net_affiliate_value: totalAffiliateValue,
          total_card_transactions:
            transactionsResponse.data.totals.total_transactions,
          total_card_amount: transactionsResponse.data.totals.total_net_amount,
        },
      })

      setRefundsData({
        total_refund_amount: totalRefundAmount,
        total_refund_quantity: totalRefundQuantity,
      })

      setCommercialData({
        total_commercial_value: totalCommercialValue,
        total_commercial_quantity: totalCommercialQuantity,
      })

      setBoletoData({
        total_boleto_value: totalBoletoValue,
        total_boleto_quantity: totalBoletoQuantity,
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
    const date = new Date(dateStr + 'T12:00:00') // Usar meio-dia para evitar problemas de fuso
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
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
          Controle de Vendas Global


          </h1>
          <button
            onClick={handleRefreshData}
            className="p-2 flex items-center justify-center rounded-md bg-primary text-white dark:bg-primary-dark dark:text-white hover:bg-primary-dark hover:shadow-md dark:hover:bg-primary transition-all duration-200 ease-in-out transform hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5"
              >
                <path
                  d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                  fill="currentColor"
                />
              </svg>
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

        <div className="grid grid-cols-1 md:grid-cols-9 gap-2 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Líquido Total
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(data?.totals?.total_net_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total <br/>
              {data?.totals?.total_transactions || 0} venda(s)
            </p>
          </div>
    

          {/* Card para vendas por cartão */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Cartão
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(data?.totals?.total_card_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.totals?.total_card_transactions || 0} venda(s)
            </p>
          </div>

          {/* Card para vendas por boleto */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Boleto
            </h3>
            <p className="mt-2 text-3xl font-bold text-yellow-500 dark:text-yellow-400">
              {formatCurrency(boletoData?.total_boleto_value || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {boletoData?.total_boleto_quantity || 0} venda(s)
            </p>
          </div>
        </div>

        {/* Segunda linha de cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:hidden">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(data?.totals?.total_net_affiliate_value || 0)}
            </p>
          </div>
          {/* Valor de afiliações */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hidden md:block">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(data?.totals?.total_net_affiliate_value || 0)}
            </p>
          </div>

          {/* Card de reembolsos */}
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

          {/* Vendas do comercial */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Comercial
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-500 dark:text-blue-400">
              {formatCurrency(commercialData?.total_commercial_value || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {commercialData?.total_commercial_quantity || 0} venda(s)
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
                  <p className="mt-4 text-text-light dark:text-text-dark">
                    Carregando dados...
                  </p>
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
                      name === 'Valor de Reembolso' ||
                      name === 'Valor Comercial' ||
                      name === 'Valor Boleto'
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
                <Bar
                  yAxisId="left"
                  dataKey="refund_amount"
                  name="Valor de Reembolso"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                {/* Barra para vendas do comercial */}
                <Bar
                  yAxisId="left"
                  dataKey="commercial_value"
                  name="Valor Comercial"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                {/* Nova barra para vendas de boleto */}
                <Bar
                  yAxisId="left"
                  dataKey="boleto_value"
                  name="Valor Boleto"
                  fill="#EAB308"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Novo gráfico para comparar vendas normais vs comercial */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative mt-6">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Comparativo: Vendas Normais vs Comercial
          </h3>
          <div className="h-96 relative">
            {loading && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="mt-4 text-text-light dark:text-text-dark">
                    Carregando dados...
                  </p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={formatDate}
                />
                <Legend />
                <Bar
                  dataKey="net_amount"
                  name="Valor Total"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  dataKey="commercial_value"
                  name="Valor Comercial"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Novo gráfico para comparar vendas por tipo (cartão vs boleto) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative mt-6">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Comparativo: Vendas Cartão vs Boleto
          </h3>
          <div className="h-96 relative">
            {loading && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="mt-4 text-text-light dark:text-text-dark">
                    Carregando dados...
                  </p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => date.slice(5)}
                />{' '}
                {/* Exibe mês-dia */}
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Vendas Cartão' || name === 'Vendas Boleto')
                      return formatCurrency(value)
                    return value
                  }}
                  labelFormatter={(date) =>
                    new Date(date).toLocaleDateString('pt-BR')
                  }
                />
                <Legend />
                <Bar
                  dataKey={(entry) => entry.net_amount - entry.boleto_value}
                  name="Vendas Cartão"
                  fill="#2563EB"
                />
                <Bar
                  dataKey="boleto_value"
                  name="Vendas Boleto"
                  fill="#EAB308"
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
