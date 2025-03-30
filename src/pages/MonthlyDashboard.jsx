import React, { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import boletoService from '../services/boletoService'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from '../utils/currencyUtils'

function MonthlyDashboard() {
  const [monthlyData, setMonthlyData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState({
    meta: localStorage.getItem('monthlyMeta') || 'R$ 0,00',
    superMeta: localStorage.getItem('monthlySuperMeta') || 'R$ 0,00',
    ultraMeta: localStorage.getItem('monthlyUltraMeta') || 'R$ 0,00',
  })
  const [editingGoal, setEditingGoal] = useState(null)
  const [error, setError] = useState(null)

  // Definir o primeiro e último dia do mês atual
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(
    2,
    '0',
  )}-01`
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0)
    .toISOString()
    .split('T')[0]

  // Calcular progresso baseado nos dias do mês
  const calculateProgress = useCallback(
    (currentAmount, goalAmount) => {
      const today = new Date()
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
      const endOfMonth = new Date(currentYear, currentMonth, 0)

      const totalDaysInMonth =
        Math.ceil((endOfMonth - startOfMonth) / (1000 * 60 * 60 * 24)) + 1
      const elapsedDays = Math.ceil(
        (today - startOfMonth) / (1000 * 60 * 60 * 24),
      )

      const expectedProgressPercentage = (elapsedDays / totalDaysInMonth) * 100
      const actualProgressPercentage =
        goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 0

      const difference = actualProgressPercentage - expectedProgressPercentage

      return {
        expectedProgress: expectedProgressPercentage.toFixed(2),
        actualProgress: actualProgressPercentage.toFixed(2),
        difference: difference.toFixed(2),
      }
    },
    [currentYear, currentMonth],
  )

  // Handlers para edição de metas
  const handleGoalChange = (type, value) => {
    setGoals((prev) => ({
      ...prev,
      [type]: formatCurrencyInput(value),
    }))
  }

  const saveGoal = (type) => {
    localStorage.setItem(
      `monthly${type.charAt(0).toUpperCase() + type.slice(1)}`,
      goals[type],
    )
    setEditingGoal(null)
  }

  const fetchMonthlyData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Buscando transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: firstDayOfMonth,
          ordered_at_end: lastDayOfMonth,
        },
        {
          timeout: 30000,
          headers: {
            'X-Debug-Request': 'MonthlyDashboard',
          },
        },
      )

      // Buscando reembolsos
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: firstDayOfMonth,
          ordered_at_end: lastDayOfMonth,
        },
        {
          timeout: 30000,
          headers: {
            'X-Debug-Request': 'MonthlyDashboard-Refunds',
          },
        },
      )
      
      // Buscar vendas de boleto do mês
      const boletoSales = await boletoService.getSalesByMonth(currentYear, currentMonth - 1)

      // Criar mapa de dados diários
      const dailyDataMap = {} // Inicializar todos os dias do mês com zeros
      const start = new Date(firstDayOfMonth)
      const end = new Date(lastDayOfMonth)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
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
          card_amount: 0,
          card_quantity: 0
        }
      }

      // Processar transações de cartão
      let totalCardAmount = 0;
      let totalCardQuantity = 0;
      let totalCommercialValue = 0;
      let totalCommercialQuantity = 0;
      let totalBoletoValue = 0;
      let totalBoletoQuantity = 0;
      
      transactionsResponse.data.data.forEach((transaction) => {
        const fullDate = new Date(transaction.dates.created_at * 1000)
        const transactionDate = fullDate.toISOString().split('T')[0]

        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0,
        )
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0,
        )
        
        // Verificar se é uma venda do comercial
        const isCommercial = transaction.trackings?.utm_source === 'comercial'

        if (dailyDataMap[transactionDate]) {
          // Adicionar aos valores totais
          dailyDataMap[transactionDate].net_amount += netAmount
          dailyDataMap[transactionDate].quantity += 1
          dailyDataMap[transactionDate].affiliate_value += affiliateValue
          
          // Adicionar específicamente aos dados de cartão
          dailyDataMap[transactionDate].card_amount += netAmount
          dailyDataMap[transactionDate].card_quantity += 1
          totalCardAmount += netAmount
          totalCardQuantity += 1
          
          if (isCommercial) {
            dailyDataMap[transactionDate].commercial_value += netAmount
            dailyDataMap[transactionDate].commercial_quantity += 1
            totalCommercialValue += netAmount
            totalCommercialQuantity += 1
          }
        }
      })

      // Processar reembolsos
      refundsResponse.data.data.forEach((refund) => {
        const fullDate = new Date(refund.dates.created_at * 1000)
        const refundDate = fullDate.toISOString().split('T')[0]

        // Usar o valor líquido calculado pelo backend que aplica as mesmas regras de transações
        const refundAmount = Number(refund.calculation_details?.net_amount || 0)

        if (dailyDataMap[refundDate]) {
          dailyDataMap[refundDate].refund_amount += refundAmount
          dailyDataMap[refundDate].refund_quantity += 1
        }
      })
      
      // Processar vendas de boleto
      boletoSales.forEach((boletoSale) => {
        const saleDate = new Date(boletoSale.timestamp);
        const transactionDate = saleDate.toISOString().split('T')[0];
        
        const saleValue = Number(boletoSale.value || 0);
        
        if (dailyDataMap[transactionDate]) {
          // Adicionar aos boletos
          dailyDataMap[transactionDate].boleto_value += saleValue;
          dailyDataMap[transactionDate].boleto_quantity += 1;
          
          // Adicionar às vendas totais
          dailyDataMap[transactionDate].net_amount += saleValue;
          dailyDataMap[transactionDate].quantity += 1;
          
          totalBoletoValue += saleValue;
          totalBoletoQuantity += 1;
        }
      });

      // Converter para array e ordenar
      const chartData = Object.values(dailyDataMap)
        .filter(
          (day) =>
            day.net_amount > 0 || day.quantity > 0 || 
            day.affiliate_value > 0 || day.refund_amount > 0 ||
            day.commercial_value > 0 || day.boleto_value > 0
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date))

      // Calcular totais
      const totalNetAmount = chartData.reduce(
        (sum, day) => sum + day.net_amount,
        0,
      )
      const totalQuantity = chartData.reduce(
        (sum, day) => sum + day.quantity,
        0,
      )
      const totalAffiliateValue = chartData.reduce(
        (sum, day) => sum + day.affiliate_value,
        0,
      )
      const totalRefundAmount = chartData.reduce(
        (sum, day) => sum + day.refund_amount,
        0,
      )
      const totalRefundQuantity = chartData.reduce(
        (sum, day) => sum + day.refund_quantity,
        0,
      )

      setMonthlyData({
        dailyData: chartData,
        totals: {
          total_transactions: totalQuantity,
          total_net_amount: totalNetAmount,
          total_net_affiliate_value: totalAffiliateValue,
          total_card_transactions: totalCardQuantity,
          total_card_amount: totalCardAmount
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

      // Forçar atualização do estado de carregamento
      setLoading(false)
    } catch (error) {
      console.error('Erro na requisição:', error)
      setError(error)
      setLoading(false)
    }
  }, [firstDayOfMonth, lastDayOfMonth])

  // Buscar dados quando o componente monta
  useEffect(() => {
    fetchMonthlyData()
  }, [fetchMonthlyData])

  // Calcular progresso das metas
  const metaProgress = useMemo(() => {
    const currentAmount = monthlyData?.totals?.total_net_amount || 0
    return {
      meta: calculateProgress(currentAmount, parseCurrencyInput(goals.meta)),
      superMeta: calculateProgress(
        currentAmount,
        parseCurrencyInput(goals.superMeta),
      ),
      ultraMeta: calculateProgress(
        currentAmount,
        parseCurrencyInput(goals.ultraMeta),
      ),
    }
  }, [monthlyData, goals, calculateProgress])

  // Componente de carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary dark:border-secondary"></div>
          <p className="mt-4 text-xl text-primary-dark dark:text-primary font-medium">Carregando dados do mês...</p>
        </div>
      </div>
    )
  }

  // Tela de erro
  if (error) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-7xl mx-auto bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">Erro ao carregar dados</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">
            Ocorreu um erro ao buscar os dados do mês. Por favor, tente novamente mais tarde.
          </p>
          <button
            onClick={fetchMonthlyData}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // Renderização dos dados
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            Consolidade Mensal de Vendas
          </h1>
          <button
            onClick={fetchMonthlyData}
            className="p-2 flex justify-center rounded-md bg-primary text-white dark:bg-primary-dark dark:text-white hover:bg-primary-dark hover:shadow-md dark:hover:bg-primary transition-all duration-200 ease-in-out transform hover:scale-105"
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

        {/* Resumo Mensal */}
        <div className="grid grid-cols-1 md:grid-cols-9 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Total de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(monthlyData?.totals?.total_net_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cartão + Boleto <br/>
              {monthlyData?.totals?.total_transactions || 0} venda(s)
            </p>
          </div>

          
          {/* Card vendas cartão */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Cartão
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(monthlyData?.totals?.total_card_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {monthlyData?.totals?.total_card_transactions || 0} venda(s)
            </p>
          </div>
          
          {/* Card vendas boleto */}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:hidden">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Ticket Médio
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent4 dark:text-accent3">
              {formatCurrency(
                monthlyData?.totals?.total_net_amount &&
                  monthlyData?.totals?.total_transactions
                  ? monthlyData.totals.total_net_amount /
                      monthlyData.totals.total_transactions
                  : 0,
              )}
            </p>
          </div>
          {/* Ticket médio */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hidden md:block">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Ticket Médio
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent4 dark:text-accent3">
              {formatCurrency(
                monthlyData?.totals?.total_net_amount &&
                  monthlyData?.totals?.total_transactions
                  ? monthlyData.totals.total_net_amount /
                      monthlyData.totals.total_transactions
                  : 0,
              )}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(
                monthlyData?.totals?.total_net_affiliate_value || 0,
              )}
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

        {/* Metas e Progresso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {['meta', 'superMeta', 'ultraMeta'].map((metaType) => (
            <div
              key={metaType}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  {metaType === 'meta'
                    ? 'Meta'
                    : metaType === 'superMeta'
                    ? 'Super Meta'
                    : 'Ultra Meta'}
                </h3>
                {editingGoal !== metaType ? (
                  <button
                    onClick={() => setEditingGoal(metaType)}
                    className="text-primary dark:text-secondary hover:text-secondary dark:hover:text-primary"
                  >
                    Editar
                  </button>
                ) : (
                  <button
                    onClick={() => saveGoal(metaType)}
                    className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                  >
                    OK
                  </button>
                )}
              </div>
              {editingGoal === metaType ? (
                <input
                  type="text"
                  value={goals[metaType]}
                  onChange={(e) => handleGoalChange(metaType, e.target.value)}
                  className="w-full border rounded px-2 py-1 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              ) : (
                <p className="text-2xl font-bold text-accent1 dark:text-accent2">
                  {goals[metaType]}
                </p>
              )}
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-primary dark:bg-secondary h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(
                        metaProgress[metaType].actualProgress,
                        100,
                      )}%`,
                    }}
                  ></div>
                </div>
                <p
                  className={`text-sm mt-1 ${
                    metaProgress[metaType].difference >= 0
                      ? 'text-green-500 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {metaProgress[metaType].difference >= 0 ? '+' : ''}
                  {metaProgress[metaType].difference}%
                  {metaProgress[metaType].difference >= 0
                    ? ' adiantado'
                    : ' atrasado'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gráfico de Barras */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Vendas Diárias
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData?.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(dateStr) => new Date(dateStr).getDate()}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#404b62"
                    tickFormatter={formatCurrency}
                  />
                  <YAxis yAxisId="right" orientation="right" stroke="#059669" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (
                        name === 'Valor Líquido' ||
                        name === 'Valor de Afiliação' ||
                        name === 'Valor de Reembolso' ||
                        name === 'Valor Comercial' ||
                        name === 'Valor Boleto' ||
                        name === 'Valor Cartão'
                      )
                        return formatCurrency(value)
                      return `${value} vendas`
                    }}
                    labelFormatter={(dateStr) =>
                      new Date(dateStr).toLocaleDateString('pt-BR')
                    }
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="net_amount"
                    name="Valor Líquido"
                    fill="#2563EB"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="quantity"
                    name="Quantidade"
                    fill="#059669"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="affiliate_value"
                    name="Valor de Afiliação"
                    fill="#F97316"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="refund_amount"
                    name="Valor de Reembolso"
                    fill="#EF4444"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="commercial_value"
                    name="Valor Comercial"
                    fill="#3B82F6"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="boleto_value"
                    name="Valor Boleto"
                    fill="#EAB308"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Linha */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Progressão Mensal
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData?.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(dateStr) => new Date(dateStr).getDate()}
                  />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(dateStr) =>
                      new Date(dateStr).toLocaleDateString('pt-BR')
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="net_amount"
                    name="Valor Total"
                    stroke="#2563EB"
                  />
                  <Line
                    type="monotone"
                    dataKey="card_amount"
                    name="Valor Cartão"
                    stroke="#22C55E"
                  />
                  <Line
                    type="monotone"
                    dataKey="boleto_value"
                    name="Valor Boleto"
                    stroke="#EAB308"
                  />
                  <Line
                    type="monotone"
                    dataKey="affiliate_value"
                    name="Valor de Afiliação"
                    stroke="#F97316"
                  />
                  <Line
                    type="monotone"
                    dataKey="refund_amount"
                    name="Valor de Reembolso"
                    stroke="#EF4444"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Gráfico comparativo cartão vs boleto */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Comparativo: Vendas Cartão vs Boleto
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData?.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(dateStr) => new Date(dateStr).getDate()}
                  />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(dateStr) =>
                      new Date(dateStr).toLocaleDateString('pt-BR')
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="card_amount"
                    name="Vendas Cartão" 
                    fill="#22C55E"
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
          
          {/* Quantidade de vendas por tipo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Quantidade de Vendas por Tipo
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData?.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(dateStr) => new Date(dateStr).getDate()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(dateStr) =>
                      new Date(dateStr).toLocaleDateString('pt-BR')
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="card_quantity"
                    name="Vendas Cartão" 
                    fill="#22C55E"
                  />
                  <Bar
                    dataKey="boleto_quantity"
                    name="Vendas Boleto"
                    fill="#EAB308"
                  />
                  <Bar
                    dataKey="commercial_quantity"
                    name="Vendas Comercial"
                    fill="#3B82F6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthlyDashboard