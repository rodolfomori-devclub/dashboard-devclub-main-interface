import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from '../utils/currencyUtils'

function YearlyDashboard() {
  const [yearlyData, setYearlyData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState({
    meta: localStorage.getItem('yearlyMeta') || 'R$ 0,00',
    superMeta: localStorage.getItem('yearlySuperMeta') || 'R$ 0,00',
    ultraMeta: localStorage.getItem('yearlyUltraMeta') || 'R$ 0,00',
  })
  const [editingGoal, setEditingGoal] = useState(null)
  const [error, setError] = useState(null)

  // Definir o primeiro e último dia do ano atual
  const currentYear = new Date().getFullYear()
  const firstDayOfYear = `${currentYear}-01-01`
  const lastDayOfYear = `${currentYear}-12-31`

  // Calcular progresso baseado nos dias do ano
  const calculateProgress = useCallback(
    (currentAmount, goalAmount) => {
      const today = new Date()
      const startOfYear = new Date(currentYear, 0, 1)
      const endOfYear = new Date(currentYear, 11, 31)

      const totalDaysInYear =
        Math.ceil((endOfYear - startOfYear) / (1000 * 60 * 60 * 24)) + 1
      const elapsedDays = Math.ceil(
        (today - startOfYear) / (1000 * 60 * 60 * 24),
      )

      const expectedProgressPercentage = (elapsedDays / totalDaysInYear) * 100
      const actualProgressPercentage =
        goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 0

      const difference = actualProgressPercentage - expectedProgressPercentage

      return {
        expectedProgress: expectedProgressPercentage.toFixed(2),
        actualProgress: actualProgressPercentage.toFixed(2),
        difference: difference.toFixed(2),
      }
    },
    [currentYear],
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
      `yearly${type.charAt(0).toUpperCase() + type.slice(1)}`,
      goals[type],
    )
    setEditingGoal(null)
  }

  const fetchYearlyData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Buscando transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: firstDayOfYear,
          ordered_at_end: lastDayOfYear,
        },
        {
          timeout: 30000,
          headers: {
            'X-Debug-Request': 'YearlyDashboard',
          },
        },
      )

      // Buscando reembolsos
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: firstDayOfYear,
          ordered_at_end: lastDayOfYear,
        },
        {
          timeout: 30000,
          headers: {
            'X-Debug-Request': 'YearlyDashboard-Refunds',
          },
        },
      )
      
      // Buscar vendas de boleto do ano
      const boletoSales = await boletoService.getSalesByYear(currentYear)

      // Processar dados similar ao código anterior
      const monthlyDataMap = {}
      for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0')
        monthlyDataMap[monthStr] = {
          month: monthStr,
          net_amount: 0,
          quantity: 0,
          affiliate_value: 0,
          refund_amount: 0,
          refund_quantity: 0,
          commercial_value: 0,
          commercial_quantity: 0,
          boleto_value: 0,
          boleto_quantity: 0
        }
      }

      // Processar transações
      let totalCommercialValue = 0
      let totalCommercialQuantity = 0
      let totalBoletoValue = 0
      let totalBoletoQuantity = 0
      
      transactionsResponse.data.data.forEach((transaction) => {
        const fullDate = new Date(transaction.dates.created_at * 1000)
        const monthStr = String(fullDate.getMonth() + 1).padStart(2, '0')

        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0,
        )
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0,
        )
        
        // Verificar se é uma venda do comercial
        const isCommercial = transaction.trackings?.utm_source === 'comercial'

        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].net_amount += netAmount
          monthlyDataMap[monthStr].quantity += 1
          monthlyDataMap[monthStr].affiliate_value += affiliateValue
          
          if (isCommercial) {
            monthlyDataMap[monthStr].commercial_value += netAmount
            monthlyDataMap[monthStr].commercial_quantity += 1
            totalCommercialValue += netAmount
            totalCommercialQuantity += 1
          }
        }
      })

      // Processar reembolsos
      refundsResponse.data.data.forEach((refund) => {
        const fullDate = new Date(refund.dates.created_at * 1000)
        const monthStr = String(fullDate.getMonth() + 1).padStart(2, '0')

        // Usar o valor líquido calculado pelo backend que aplica as mesmas regras de transações
        const refundAmount = Number(refund.calculation_details?.net_amount || 0)

        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].refund_amount += refundAmount
          monthlyDataMap[monthStr].refund_quantity += 1
        }
      })
      
      // Processar vendas de boleto
      boletoSales.forEach((boletoSale) => {
        const date = new Date(boletoSale.timestamp);
        const monthStr = String(date.getMonth() + 1).padStart(2, '0');
        const saleValue = Number(boletoSale.value || 0);
        
        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].boleto_value += saleValue;
          monthlyDataMap[monthStr].boleto_quantity += 1;
          // Adicionar às vendas totais
          monthlyDataMap[monthStr].net_amount += saleValue;
          monthlyDataMap[monthStr].quantity += 1;
          
          totalBoletoValue += saleValue;
          totalBoletoQuantity += 1;
        }
      });

      // Converter para array e ordenar
      const chartData = Object.values(monthlyDataMap).sort((a, b) =>
        a.month.localeCompare(b.month),
      )

      // Calcular totais
      const totalNetAmount = chartData.reduce(
        (sum, month) => sum + month.net_amount,
        0,
      )
      const totalQuantity = chartData.reduce(
        (sum, month) => sum + month.quantity,
        0,
      )
      const totalAffiliateValue = chartData.reduce(
        (sum, month) => sum + month.affiliate_value,
        0,
      )
      const totalRefundAmount = chartData.reduce(
        (sum, month) => sum + month.refund_amount,
        0,
      )
      const totalRefundQuantity = chartData.reduce(
        (sum, month) => sum + month.refund_quantity,
        0,
      )
      const totalCardAmount = totalNetAmount - totalBoletoValue;
      const totalCardTransactions = totalQuantity - totalBoletoQuantity;

      setYearlyData({
        monthlyData: chartData,
        totals: {
          total_transactions: totalQuantity,
          total_net_amount: totalNetAmount,
          total_net_affiliate_value: totalAffiliateValue,
          total_card_transactions: totalCardTransactions,
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

      setLoading(false)
    } catch (error) {
      console.error('Erro na requisição:', error)
      setError(error)
      setLoading(false)
    }
  }, [firstDayOfYear, lastDayOfYear])

  // Buscar dados quando o componente monta
  useEffect(() => {
    fetchYearlyData()
  }, [fetchYearlyData])

  // Calcular progresso das metas
  const metaProgress = useMemo(() => {
    const currentAmount = yearlyData?.totals?.total_net_amount || 0
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
  }, [yearlyData, goals, calculateProgress])

  // Renderização dos dados
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary dark:text-secondary mb-4">
            Dashboard de Metas Anuais
          </h1>

          {/* Resumo de Vendas */}
          <div className="grid grid-cols-1 md:grid-cols-9 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                Valor Total de Vendas
              </h3>
              <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
                {formatCurrency(yearlyData?.totals?.total_net_amount || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cartão + Boleto <br/>
                {yearlyData?.totals?.total_transactions || 0} venda(s)
              </p>
            </div>

            
            {/* Card vendas cartão */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-3">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                Vendas Cartão
              </h3>
              <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
                {formatCurrency(yearlyData?.totals?.total_card_amount || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {yearlyData?.totals?.total_card_transactions || 0} venda(s)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:hidden">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                Valor Total de Afiliações
              </h3>
              <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
                {formatCurrency(
                  yearlyData?.totals?.total_net_affiliate_value || 0,
                )}
              </p>
            </div>

            {/* Valor de afiliações */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hidden md:block">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                Valor Total de Afiliações
              </h3>
              <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
                {formatCurrency(
                  yearlyData?.totals?.total_net_affiliate_value || 0,
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

          {/* Metas */}
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

          {/* Gráfico de Barras Mensal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative mb-8">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Vendas Mensais
            </h3>
            <div className="h-96 relative">
              {loading && (
                <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-secondary"></div>
                    <p className="mt-4 text-text-light dark:text-text-dark">
                      Carregando dados...
                    </p>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(monthStr) => {
                      const monthNames = [
                        'Jan',
                        'Fev',
                        'Mar',
                        'Abr',
                        'Mai',
                        'Jun',
                        'Jul',
                        'Ago',
                        'Set',
                        'Out',
                        'Nov',
                        'Dez',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
                  />
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
                    labelFormatter={(monthStr) => {
                      const monthNames = [
                        'Janeiro',
                        'Fevereiro',
                        'Março',
                        'Abril',
                        'Maio',
                        'Junho',
                        'Julho',
                        'Agosto',
                        'Setembro',
                        'Outubro',
                        'Novembro',
                        'Dezembro',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
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
                  <Bar
                    yAxisId="left"
                    dataKey="commercial_value"
                    name="Valor Comercial"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
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
          
          {/* Gráfico comparativo comercial vs total */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Comparativo Mensal: Vendas Totais vs Comercial
            </h3>
            <div className="h-96 relative">
              {loading && (
                <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-secondary"></div>
                    <p className="mt-4 text-text-light dark:text-text-dark">
                      Carregando dados...
                    </p>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(monthStr) => {
                      const monthNames = [
                        'Jan',
                        'Fev',
                        'Mar',
                        'Abr',
                        'Mai',
                        'Jun',
                        'Jul',
                        'Ago',
                        'Set',
                        'Out',
                        'Nov',
                        'Dez',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(monthStr) => {
                      const monthNames = [
                        'Janeiro',
                        'Fevereiro',
                        'Março',
                        'Abril',
                        'Maio',
                        'Junho',
                        'Julho',
                        'Agosto',
                        'Setembro',
                        'Outubro',
                        'Novembro',
                        'Dezembro',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="net_amount"
                    name="Valor Total"
                    fill="#2563EB"
                  />
                  <Bar
                    dataKey="commercial_value"
                    name="Valor Comercial"
                    fill="#3B82F6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Gráfico comparativo cartão vs boleto */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative mt-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Comparativo Mensal: Vendas Cartão vs Boleto
            </h3>
            <div className="h-96 relative">
              {loading && (
                <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-secondary"></div>
                    <p className="mt-4 text-text-light dark:text-text-dark">
                      Carregando dados...
                    </p>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(monthStr) => {
                      const monthNames = [
                        'Jan',
                        'Fev',
                        'Mar',
                        'Abr',
                        'Mai',
                        'Jun',
                        'Jul',
                        'Ago',
                        'Set',
                        'Out',
                        'Nov',
                        'Dez',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(monthStr) => {
                      const monthNames = [
                        'Janeiro',
                        'Fevereiro',
                        'Março',
                        'Abril',
                        'Maio',
                        'Junho',
                        'Julho',
                        'Agosto',
                        'Setembro',
                        'Outubro',
                        'Novembro',
                        'Dezembro',
                      ]
                      return monthNames[parseInt(monthStr) - 1]
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey={(entry) => entry.net_amount - entry.boleto_value}
                    name="Vendas Cartão" 
                    fill="#2563EB" 
                  />
                  <Bar dataKey="boleto_value" name="Vendas Boleto" fill="#EAB308" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YearlyDashboard