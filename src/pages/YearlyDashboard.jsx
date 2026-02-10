import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
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
  const currentYearNow = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYearNow)
  const [yearConfirmed, setYearConfirmed] = useState(false)
  const [yearlyData, setYearlyData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [asaasData, setAsaasData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 12 })
  const [loadingStates, setLoadingStates] = useState({
    transactions: true,
    refunds: true,
    commercial: true,
    boleto: true
  })
  const [partialTotals, setPartialTotals] = useState({
    cardValue: 0,
    cardQuantity: 0,
    boletoValue: 0,
    boletoQuantity: 0
  })
  const [goals, setGoals] = useState({
    meta: localStorage.getItem('yearlyMeta') || 'R$ 0,00',
    superMeta: localStorage.getItem('yearlySuperMeta') || 'R$ 0,00',
    ultraMeta: localStorage.getItem('yearlyUltraMeta') || 'R$ 0,00',
  })
  const [editingGoal, setEditingGoal] = useState(null)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  // Definir o primeiro e último dia do ano selecionado
  const firstDayOfYear = `${selectedYear}-01-01`
  const lastDayOfYear = `${selectedYear}-12-31`

  // Calcular progresso baseado nos dias do ano
  const calculateProgress = useCallback(
    (currentAmount, goalAmount) => {
      const today = new Date()
      const startOfYear = new Date(selectedYear, 0, 1)
      const endOfYear = new Date(selectedYear, 11, 31)

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
    [selectedYear],
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
      // Cancel previous requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      setLoading(true)
      setError(null)
      setLoadingStates({ transactions: true, refunds: true, commercial: true, boleto: true })
      setPartialTotals({ cardValue: 0, cardQuantity: 0, boletoValue: 0, boletoQuantity: 0 })

      // Criar todas as promises para executar em paralelo
      const allPromises = []

      // Para cada mês, criar as 3 promises (transactions, refunds, commercial)
      for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0')
        const firstDayOfMonth = `${selectedYear}-${monthStr}-01`
        const lastDay = new Date(selectedYear, month, 0).getDate()
        const lastDayOfMonth = `${selectedYear}-${monthStr}-${lastDay}`

        allPromises.push({
          type: 'transactions',
          month: month,
          promise: axios.post(
            `${import.meta.env.VITE_API_URL}/transactions`,
            {
              ordered_at_ini: firstDayOfMonth,
              ordered_at_end: lastDayOfMonth,
            },
            {
              timeout: 60000,
              signal,
              headers: {
                'X-Debug-Request': `YearlyDashboard-Month-${monthStr}`,
              },
            },
          )
        })

        allPromises.push({
          type: 'refunds',
          month: month,
          promise: axios.post(
            `${import.meta.env.VITE_API_URL}/refunds`,
            {
              ordered_at_ini: firstDayOfMonth,
              ordered_at_end: lastDayOfMonth,
            },
            {
              timeout: 60000,
              signal,
              headers: {
                'X-Debug-Request': `YearlyDashboard-Refunds-${monthStr}`,
              },
            },
          )
        })

        allPromises.push({
          type: 'commercial',
          month: month,
          promise: axios.post(
            `${import.meta.env.VITE_API_URL}/commercial`,
            {
              ordered_at_ini: firstDayOfMonth,
              ordered_at_end: lastDayOfMonth,
            },
            {
              timeout: 60000,
              signal,
              headers: {
                'X-Debug-Request': `YearlyDashboard-Commercial-${monthStr}`,
              },
            },
          )
        })
      }

      // Adicionar a promise do boleto (ano todo)
      allPromises.push({
        type: 'boleto',
        month: 0,
        promise: boletoService.getSalesByYear(selectedYear)
      })

      // Adicionar a promise do Asaas (ano todo)
      allPromises.push({
        type: 'asaas',
        month: 0,
        promise: axios.get(
          `${import.meta.env.VITE_API_URL}/boleto/asaas/vendas`,
          {
            params: { data_inicio: firstDayOfYear, data_final: lastDayOfYear },
            timeout: 60000,
            signal,
          }
        )
      })

      // Processar resultados conforme vão chegando (em tempo real)
      const allTransactions = []
      const allRefunds = []
      const allCommercial = []
      let boletoSales = []

      const monthsProcessed = new Set()
      let runningCardValue = 0
      let runningCardQuantity = 0

      // Criar promises com handlers para atualização em tempo real
      const promisesWithHandlers = allPromises.map(async (promiseInfo, index) => {
        try {
          const result = await promiseInfo.promise

          // Processar resultado imediatamente quando chegar
          if (promiseInfo.type === 'transactions') {
            const data = result.data.data || []
            allTransactions.push(...data)

            // Calcular valores incrementalmente
            data.forEach(transaction => {
              const netAmount = Number(transaction?.calculation_details?.net_amount || 0)
              runningCardValue += netAmount
              runningCardQuantity += 1
            })

            monthsProcessed.add(promiseInfo.month)

            // Atualizar UI em tempo real
            setLoadingProgress({ current: monthsProcessed.size, total: 12 })
            setPartialTotals(prev => ({
              ...prev,
              cardValue: runningCardValue,
              cardQuantity: runningCardQuantity
            }))
          }
          else if (promiseInfo.type === 'refunds') {
            const data = result.data.data || []
            allRefunds.push(...data)
          }
          else if (promiseInfo.type === 'commercial') {
            const data = result.data.data || []
            allCommercial.push(...data)
          }
          else if (promiseInfo.type === 'boleto') {
            boletoSales = result || []

            // Calcular totais de boleto
            let boletoValue = 0
            let boletoQuantity = 0
            boletoSales.forEach(sale => {
              const saleValue = Number(sale.value || 0)
              boletoValue += saleValue
              boletoQuantity += 1
            })

            // Atualizar UI em tempo real
            setPartialTotals(prev => ({
              ...prev,
              boletoValue: boletoValue,
              boletoQuantity: boletoQuantity
            }))
          }
          else if (promiseInfo.type === 'asaas') {
            if (result?.data?.success) {
              const asaas = result.data.data
              setAsaasData({
                totalGross: asaas.totalGross || 0,
                totalNet: asaas.totalNet || 0,
                totalFees: asaas.totalFees || 0,
                count: asaas.count || 0,
                totalPurchaseValue: asaas.totalPurchaseValue || 0,
              })
            }
          }

          return { success: true, type: promiseInfo.type, month: promiseInfo.month }
        } catch (error) {
          if (error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
            return { success: false, canceled: true }
          }

          // Silenciar erros 404 do endpoint commercial (não implementado na API)
          if (promiseInfo.type === 'commercial' && (error?.response?.status === 404 || error?.message?.includes('404'))) {
            return { success: false, error: error, silent: true }
          }

          return { success: false, error: error }
        }
      })

      // Aguardar todas terminarem
      await Promise.all(promisesWithHandlers)

      setLoadingStates({ transactions: false, refunds: false, commercial: false, boleto: false })
      setLoadingProgress({ current: 12, total: 12 })

      const transactions = allTransactions
      const refunds = allRefunds
      const commercial = allCommercial

      // Calcular totais de vendas comerciais
      let totalCommercialValue = 0
      let totalCommercialQuantity = 0

      commercial.forEach((sale) => {
        const saleValue = Number(sale.calculation_details?.net_amount || 0)
        totalCommercialValue += saleValue
        totalCommercialQuantity += 1
      })

      // Processar dados mensais
      const monthlyDataMap = {}
      let totalBoletoValue = 0
      let totalBoletoQuantity = 0

      // Inicializar todos os meses
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
          boleto_quantity: 0,
        }
      }

      // Processar transações
      transactions.forEach((transaction) => {
        const date = new Date(transaction.dates.created_at * 1000)
        const monthStr = String(date.getMonth() + 1).padStart(2, '0')
        const netAmount = Number(transaction.calculation_details?.net_amount || 0)
        const affiliateValue = Number(
          transaction.calculation_details?.net_affiliate_value || 0,
        )

        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].net_amount += netAmount
          monthlyDataMap[monthStr].quantity += 1
          monthlyDataMap[monthStr].affiliate_value += affiliateValue
        }
      })

      // Processar reembolsos
      refunds.forEach((refund) => {
        const date = new Date(refund.dates.created_at * 1000)
        const monthStr = String(date.getMonth() + 1).padStart(2, '0')
        const refundAmount = Number(refund.calculation_details?.net_amount || 0)

        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].refund_amount += refundAmount
          monthlyDataMap[monthStr].refund_quantity += 1
        }
      })

      // Processar vendas comerciais
      commercial.forEach((sale) => {
        const date = new Date(sale.dates.created_at * 1000)
        const monthStr = String(date.getMonth() + 1).padStart(2, '0')
        const saleValue = Number(sale.calculation_details?.net_amount || 0)

        if (monthlyDataMap[monthStr]) {
          monthlyDataMap[monthStr].commercial_value += saleValue
          monthlyDataMap[monthStr].commercial_quantity += 1
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
      // Handle abort errors - don't show error toast for cancellations
      if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return
      }

      toast.error('Erro ao carregar dados do ano. Tente novamente.')
      setError(error)
      setLoading(false)
    }
  }, [selectedYear, firstDayOfYear, lastDayOfYear])

  // Buscar dados apenas quando o ano for confirmado
  useEffect(() => {
    if (yearConfirmed) {
      fetchYearlyData()

      // Cleanup: abort pending requests when component unmounts or year changes
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }
  }, [yearConfirmed, fetchYearlyData])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto relative">
        {/* Year selection screen */}
        {!yearConfirmed && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="bg-white dark:bg-secondary rounded-3xl p-12 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-4">
                  Consolidado Anual
                </h1>
                <p className="text-text-muted-light dark:text-text-muted-dark text-lg">
                  Selecione o ano que deseja visualizar
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                    Ano de Referência
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-all text-lg"
                  >
                    {Array.from({ length: 5 }, (_, i) => currentYearNow - i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    setYearConfirmed(true)
                    setLoading(true)
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Carregar Dados de {selectedYear}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading screen with partial totals */}
        {yearConfirmed && loading && (
          <div className="absolute inset-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-start justify-center pt-32 z-50">
            <div className="flex flex-col items-center animate-fade-in max-w-xl w-full">
              <div className="relative">
                <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary/20"></div>
                <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary border-t-transparent absolute top-0 left-0"></div>
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse"></div>
              </div>
              <p className="mt-6 text-xl text-text-light dark:text-text-dark font-medium">
                Carregando dados de {selectedYear}...
              </p>
              <p className="mt-2 text-sm text-text-muted-light dark:text-text-muted-dark">
                37 requisições em paralelo (12 meses × 3 APIs + boleto)
              </p>

              {/* Progress bar */}
              <div className="mt-4 w-full max-w-md">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-text-muted-light dark:text-text-muted-dark text-center">
                  {loadingProgress.current} de {loadingProgress.total} meses processados
                </p>
              </div>

              {/* Partial totals */}
              <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
                <div className="bg-white dark:bg-secondary rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-1">
                    Vendas Cartão
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {partialTotals.cardValue > 0
                      ? formatCurrency(partialTotals.cardValue)
                      : 'Processando...'}
                  </p>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                    {partialTotals.cardQuantity > 0
                      ? `${partialTotals.cardQuantity} transações`
                      : 'Carregando em paralelo'}
                  </p>
                </div>

                <div className="bg-white dark:bg-secondary rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-1">
                    Vendas Boleto
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {partialTotals.boletoValue > 0
                      ? formatCurrency(partialTotals.boletoValue)
                      : 'Processando...'}
                  </p>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                    {partialTotals.boletoQuantity > 0
                      ? `${partialTotals.boletoQuantity} vendas`
                      : 'Carregando em paralelo'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-12 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 dark:from-primary/20 dark:via-blue-500/10 dark:to-purple-500/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/70 dark:bg-secondary/70 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-2">
                  Consolidado Anual de Vendas
                </h1>
                <p className="text-text-muted-light dark:text-text-muted-dark text-lg">
                  Análise completa do desempenho anual
                </p>
              </div>
              <div className="flex items-center gap-6">
                {/* Year Selector */}
                <div className="flex flex-col">
                  <label className="text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
                    Ano de Referência
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    disabled={loading}
                  >
                    {Array.from({ length: 5 }, (_, i) => currentYearNow - i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden md:flex items-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="group relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Valor Total de Vendas
              </h3>
              <p className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent mb-2">
                {formatCurrency(yearlyData?.totals?.total_net_amount || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                {yearlyData?.totals?.total_transactions || 0} vendas realizadas
              </p>
            </div>
          </div>

          <div className="group relative animate-slide-up" style={{animationDelay: '0.1s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Vendas Cartão
              </h3>
              <p className="text-4xl font-bold text-green-500 mb-2">
                {formatCurrency(yearlyData?.totals?.total_card_amount || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {yearlyData?.totals?.total_card_transactions || 0} transações
              </p>
            </div>
          </div>
          
          <div className="group relative animate-slide-up" style={{animationDelay: '0.2s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Vendas Boleto
              </h3>
              <p className="text-4xl font-bold text-yellow-500 mb-2">
                {formatCurrency((boletoData?.total_boleto_value || 0) + (asaasData?.totalPurchaseValue || 0))}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                {(boletoData?.total_boleto_quantity || 0) + (asaasData?.count || 0)} boletos
              </p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted-light dark:text-text-muted-dark">TMB</span>
                  <span className="font-medium text-text-light dark:text-text-dark">{formatCurrency(boletoData?.total_boleto_value || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted-light dark:text-text-muted-dark">Asaas (bruto total)</span>
                  <span className="font-medium text-text-light dark:text-text-dark">{formatCurrency(asaasData?.totalPurchaseValue || 0)}</span>
                </div>
                {asaasData?.totalPurchaseValue > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted-light dark:text-text-muted-dark">Asaas (recebido)</span>
                    <span className="font-medium text-green-500">{formatCurrency(asaasData?.totalGross || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="group relative animate-slide-up mb-12" style={{animationDelay: '0.9s'}}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-primary/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">
                    Vendas Mensais
                  </h3>
                  <p className="text-text-muted-light dark:text-text-muted-dark">
                    Análise detalhada por mês do ano
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
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