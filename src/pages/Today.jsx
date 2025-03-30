import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import boletoService from '../services/boletoService'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  LabelList,
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
  // Inicializar com a data atual como objeto Date
  const initialDate = new Date()
  initialDate.setHours(12, 0, 0, 0) // Meio-dia para evitar problemas de fuso

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [displayDate, setDisplayDate] = useState(
    initialDate.toISOString().split('T')[0],
  )

  const [todayData, setTodayData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDayData = useCallback(async (date) => {
    try {
      setLoading(true)

      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          // Define timezone para Brasília (GMT-3)
          ordered_at_ini: date,
          ordered_at_end: date,
        },
      )

      // Buscar transações reembolsadas
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: date,
          ordered_at_end: date,
        },
      )

      // Buscar vendas de boleto (TMB)
      const selectedDate = new Date(date)
      const boletoSales = await boletoService.getSalesByDate(selectedDate)

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
          boletoSales: 0,
          boletoValue: 0,
          productSales: {}, // Armazenar vendas por produto por hora
        }))

      let totalSales = 0
      let totalValue = 0
      let totalAffiliateValue = 0
      let totalCommercialValue = 0
      let totalCommercialSales = 0
      let totalBoletoSales = 0
      let totalBoletoValue = 0
      const productSales = {}

      transactionsResponse.data.data.forEach((transaction) => {
        // Ajuste para fuso horário de Brasília (GMT-3)
        const timestamp = transaction.dates.created_at * 1000
        const date = new Date(timestamp)
        // Ajusta para o fuso horário local (Brasília)
        const hour = date.getHours()

        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0,
        )
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0,
        )

        const isCommercial = transaction.trackings?.utm_source === 'comercial'

        hourlyData[hour].sales += 1
        hourlyData[hour].value += netAmount
        hourlyData[hour].affiliateValue += affiliateValue

        // Registro das vendas por produto por hora
        const productName = transaction.product.name
        if (!hourlyData[hour].productSales[productName]) {
          hourlyData[hour].productSales[productName] = 0
        }
        hourlyData[hour].productSales[productName] += 1

        if (isCommercial) {
          hourlyData[hour].commercialSales += 1
          hourlyData[hour].commercialValue += netAmount
          totalCommercialSales += 1
          totalCommercialValue += netAmount
        }

        totalSales += 1
        totalValue += netAmount
        totalAffiliateValue += affiliateValue

        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          }
        }
        productSales[productName].quantity += 1
        productSales[productName].value += netAmount

        if (isCommercial) {
          productSales[productName].commercialQuantity += 1
          productSales[productName].commercialValue += netAmount
        }
      })

      // Processar vendas de boleto
      boletoSales.forEach((boletoSale) => {
        const date = new Date(boletoSale.timestamp)
        const hour = date.getHours()

        const saleValue = boletoSale.value || 0

        hourlyData[hour].boletoSales += 1
        hourlyData[hour].boletoValue += saleValue

        // Adicionar às vendas totais
        totalBoletoSales += 1
        totalBoletoValue += saleValue

        // Adicionar às vendas por produto
        const productName = boletoSale.product
        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          }
        }

        productSales[productName].boletoQuantity =
          (productSales[productName].boletoQuantity || 0) + 1
        productSales[productName].boletoValue =
          (productSales[productName].boletoValue || 0) + saleValue
        productSales[productName].quantity += 1
        productSales[productName].value += saleValue
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
        commercialValue: data.commercialValue || 0,
        boletoQuantity: data.boletoQuantity || 0,
        boletoValue: data.boletoValue || 0,
      }))

      // Calcular média de vendas por hora (apenas para horas com vendas)
      const hoursWithSales =
        hourlyData.filter((hour) => hour.sales > 0 || hour.boletoSales > 0)
          .length || 1
      // Agora totalSales inclui vendas de cartão (da API) + vendas de boleto
      const totalCardSales = totalSales
      totalSales += totalBoletoSales
      const totalCombinedValue = totalValue + totalBoletoValue
      const averageSalesPerHour = totalSales / hoursWithSales

      // Adicionar informação sobre a média para uso no gráfico
      const processedHourlyData = hourlyData.map((hour) => ({
        ...hour,
        averageSales: averageSalesPerHour,
      }))

      setTodayData({
        hourlyData: processedHourlyData,
        totalSales,
        totalCardSales,
        totalValue: totalCombinedValue,
        totalAffiliateValue,
        productData,
        refundProductData,
        averageSalesPerHour,
      })

      setRefundsData({
        totalRefunds,
        totalRefundAmount,
      })

      setCommercialData({
        totalCommercialSales,
        totalCommercialValue,
      })

      setBoletoData({
        totalBoletoSales,
        totalBoletoValue,
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

  // Replace your current handleDateChange function with this:
  const handleDateChange = (e) => {
    const newDisplayDate = e.target.value
    setDisplayDate(newDisplayDate)

    // Automatically handle the date change without requiring a button click
    // Parse the date components to create a proper Date object
    const [year, month, day] = newDisplayDate
      .split('-')
      .map((num) => parseInt(num, 10))
    // Create date ensuring the day is correct (based on components)
    const correctedDate = new Date(year, month - 1, day, 12, 0, 0)

    console.log(
      `Data selecionada: ${newDisplayDate}, convertida para: ${correctedDate.toLocaleDateString()}`,
    )
    setSelectedDate(correctedDate)

    // No need for the user to click "Pesquisar" anymore
    // fetchDayData will be called automatically via the useEffect that watches selectedDate
  }

  // SUBSTITUA POR:
  const handleSearch = () => {
    // Corrigir problema de fuso horário ao criar data a partir da string
    // Formato da string: YYYY-MM-DD
    const [year, month, day] = displayDate
      .split('-')
      .map((num) => parseInt(num, 10))
    // Criar data garantindo que o dia seja correto (baseado nos componentes)
    const correctedDate = new Date(year, month - 1, day, 12, 0, 0)

    console.log(
      `Data selecionada: ${displayDate}, convertida para: ${correctedDate.toLocaleDateString()}`,
    )
    setSelectedDate(correctedDate)
  }

  const handleToday = () => {
    const now = new Date()
    const today = new Date()
    setDisplayDate(today)

    // Inicializar com objetos Date em vez de strings para evitar problemas de formatação

    // Criar objeto Date com o dia correto para o filtro
    const todayObj = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    )
    console.log(`Hoje: ${today}, objeto data: ${todayObj.toLocaleDateString()}`)
    setSelectedDate(todayObj)
  }

  // Função para determinar a cor da barra com base nas vendas
  const getBarColor = (sales, averageSales) => {
    if (sales === 0) return '#EF4444' // Vermelho para zero vendas
    if (sales < averageSales * 0.5) return '#F97316' // Laranja para abaixo da média
    if (sales < averageSales) return '#FACC15' // Amarelo para próximo da média
    return '#22C55E' // Verde para acima da média
  }

  // Configuração do tooltip personalizado para mostrar informações adicionais
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const hourData = payload[0].payload

      // Organizar vendas por produto por ordem decrescente de quantidade
      const productSalesEntries = Object.entries(
        hourData.productSales || {},
      ).sort((a, b) => b[1] - a[1])

      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg min-w-[200px]">
          <p className="font-bold text-text-light dark:text-text-dark text-lg border-b pb-1 mb-2">{`${label}:00h`}</p>
          <p className="text-text-light dark:text-text-dark font-medium">{`Vendas: ${hourData.sales}`}</p>
          <p className="text-text-light dark:text-text-dark mb-2">{`Valor: ${formatCurrency(
            hourData.value,
          )}`}</p>

          {hourData.commercialSales > 0 && (
            <p className="text-text-light dark:text-text-dark mb-2">{`Vendas Comercial: ${hourData.commercialSales}`}</p>
          )}

          {hourData.boletoSales > 0 && (
            <p className="text-text-light dark:text-text-dark mb-2">{`Vendas Boleto: ${hourData.boletoSales}`}</p>
          )}

          {productSalesEntries.length > 0 && (
            <>
              <p className="font-medium text-text-light dark:text-text-dark border-t pt-1 mt-2">
                Vendas por produto:
              </p>
              <div className="mt-1 max-h-48 overflow-y-auto">
                {productSalesEntries.map(([product, count], index) => (
                  <div
                    key={index}
                    className="flex justify-between text-text-light dark:text-text-dark text-sm py-1"
                  >
                    <span className="mr-2 truncate">{product}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary"></div>
      </div>
    )
  }

  // Formatação da data para exibição mais amigável
  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  console.log(selectedDate)
  console.log(formattedDate)

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
          Controle de Vendas Diário

          </h1>

          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
            <input
              type="date"
              value={displayDate}
              onChange={handleDateChange}
              className="px-4 py-2 border rounded-lg text-text-light dark:text-text-dark bg-white dark:bg-gray-700"
            />
            <button
              onClick={() => fetchDayData(selectedDate)}
              className="p-2 flex justify-center rounded-md bg-primary text-white dark:bg-primary-dark dark:text-white hover:bg-primary-dark hover:shadow-md dark:hover:bg-primary transition-all duration-200 ease-in-out transform hover:scale-105"
              aria-label="Refresh data"
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
        </div>

        <h2 className="text-xl text-text-light dark:text-text-dark mb-6 capitalize">
          {formattedDate}
        </h2>

        {/* PRIMEIRA LINHA DE RESUMO - Principais indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-9 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Total de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary-dark dark:text-primary">
              {formatCurrency(todayData?.totalValue)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cartão + Boleto <br />
              {todayData?.totalSales} venda(s)
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Cartão
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(
                todayData?.totalValue - (boletoData?.totalBoletoValue || 0),
              )}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {todayData?.totalCardSales || 0} venda(s)
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Boleto
            </h3>
            <p className="mt-2 text-3xl font-bold text-yellow-500 dark:text-yellow-400">
              {formatCurrency(boletoData?.totalBoletoValue || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {boletoData?.totalBoletoSales || 0} venda(s)
            </p>
          </div>
        </div>

        {/* SEGUNDA LINHA DE RESUMO - Indicadores adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary-light dark:text-secondary-light">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Progressão por Hora - Barras verticais */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Progressão por Hora
            </h3>
            <div className="mt-2 mb-4 text-sm text-text-light dark:text-text-dark flex items-center">
              <span className="w-4 h-4 inline-block bg-red-500 mr-1 rounded"></span>{' '}
              Baixo
              <span className="w-4 h-4 inline-block bg-yellow-400 mx-3 rounded"></span>{' '}
              Médio
              <span className="w-4 h-4 inline-block bg-green-500 mx-1 rounded"></span>{' '}
              Alto
              <span className="ml-4">
                Média: {todayData?.averageSalesPerHour.toFixed(1)} vendas/hora
              </span>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={todayData?.hourlyData}
                  margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="hour"
                    type="category"
                    tickFormatter={(hour) => `${hour}h`}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="sales"
                    name="Vendas Cartão"
                    minPointSize={3}
                    barSize={20}
                  >
                    {todayData?.hourlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(
                          entry.sales,
                          todayData.averageSalesPerHour,
                        )}
                      />
                    ))}
                    <LabelList
                      dataKey="sales"
                      position="right"
                      fill="currentColor"
                      className="text-text-light dark:text-text-dark"
                      formatter={(value) => (value > 0 ? value : '')}
                    />
                  </Bar>
                  <Bar
                    dataKey="boletoSales"
                    name="Vendas Boleto"
                    fill="#EAB308"
                    barSize={20}
                  >
                    <LabelList
                      dataKey="boletoSales"
                      position="right"
                      fill="currentColor"
                      className="text-text-light dark:text-text-dark"
                      formatter={(value) => (value > 0 ? value : '')}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparativo: Vendas por Tipo (Cartão x Boleto) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Comparativo: Vendas Cartão vs Boleto
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todayData?.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(hour) => `${hour}:00h`}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Valor Cartão" fill="#2563EB" />
                  <Bar
                    dataKey="boletoValue"
                    name="Valor Boleto"
                    fill="#EAB308"
                  />
                </BarChart>
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
                  <Bar dataKey="quantity" name="Total" fill="#37E359" />
                  <Bar
                    dataKey="commercialQuantity"
                    name="Comercial"
                    fill="#3B82F6"
                  />
                  <Bar dataKey="boletoQuantity" name="Boleto" fill="#EAB308" />
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
                  <Bar dataKey="value" name="Total" fill="#37E359" />
                  <Bar
                    dataKey="commercialValue"
                    name="Comercial"
                    fill="#3B82F6"
                  />
                  <Bar dataKey="boletoValue" name="Boleto" fill="#EAB308" />
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
