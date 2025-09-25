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
  const [productData, setProductData] = useState([])
  const [offerData, setOfferData] = useState([])
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState({
    meta: localStorage.getItem('monthlyMeta') || 'R$ 0,00',
    superMeta: localStorage.getItem('monthlySuperMeta') || 'R$ 0,00',
    ultraMeta: localStorage.getItem('monthlyUltraMeta') || 'R$ 0,00',
  })
  const [editingGoal, setEditingGoal] = useState(null)
  const [error, setError] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // Definir o primeiro e último dia do mês selecionado
  const firstDayOfMonth = `${selectedYear}-${String(selectedMonth).padStart(
    2,
    '0',
  )}-01`
  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0)
    .toISOString()
    .split('T')[0]

  // Calcular progresso baseado nos dias do mês
  const calculateProgress = useCallback(
    (currentAmount, goalAmount) => {
      const today = new Date()
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1)
      const endOfMonth = new Date(selectedYear, selectedMonth, 0)

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
    [selectedYear, selectedMonth],
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
      let transactionsResponse = { data: { data: [] } }
      try {
        transactionsResponse = await axios.post(
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
      } catch (error) {
        console.warn('Erro ao buscar transações:', error.message)
      }

      // Buscando reembolsos
      let refundsResponse = { data: { data: [] } }
      try {
        refundsResponse = await axios.post(
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
      } catch (error) {
        console.warn('Erro ao buscar reembolsos:', error.message)
      }
      
      // Buscar vendas de boleto do mês
      let boletoSales = []
      try {
        boletoSales = await boletoService.getSalesByMonth(selectedYear, selectedMonth - 1)
      } catch (error) {
        console.warn('Erro ao buscar vendas de boleto:', error.message)
      }

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

      // Object to track product information
      const productSummary = {}
      
      // Object to track offer information
      const offerSummary = {}
      
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
        
        // Track product data
        const productName = transaction.product?.name || 'Produto não identificado'
        
        if (!productSummary[productName]) {
          productSummary[productName] = {
            name: productName,
            quantity: 0,
            cardQuantity: 0,
            boletoQuantity: 0,
            value: 0,
            cardValue: 0,
            boletoValue: 0,
            commercialQuantity: 0,
            commercialValue: 0
          }
        }
        
        productSummary[productName].quantity += 1
        productSummary[productName].cardQuantity += 1
        productSummary[productName].value += netAmount
        productSummary[productName].cardValue += netAmount
        
        if (isCommercial) {
          productSummary[productName].commercialQuantity += 1
          productSummary[productName].commercialValue += netAmount
        }
        
        // Track offer data (Guru/Cartão)
        const offerName = transaction.trackings?.utm_campaign || 
                        transaction.trackings?.offer_code || 
                        transaction.order?.offer_code ||
                        transaction.offer?.name ||
                        'Oferta não identificada'
        
        if (!offerSummary[offerName]) {
          offerSummary[offerName] = {
            name: offerName,
            quantity: 0,
            value: 0,
            source: 'Guru',
            products: {}
          }
        }
        
        offerSummary[offerName].quantity += 1
        offerSummary[offerName].value += netAmount
        
        // Track product within offer
        if (!offerSummary[offerName].products[productName]) {
          offerSummary[offerName].products[productName] = {
            quantity: 0,
            value: 0
          }
        }
        offerSummary[offerName].products[productName].quantity += 1
        offerSummary[offerName].products[productName].value += netAmount
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
        
        // Track boleto product data
        const productName = boletoSale.product || 'Produto não identificado'
        
        if (!productSummary[productName]) {
          productSummary[productName] = {
            name: productName,
            quantity: 0,
            cardQuantity: 0,
            boletoQuantity: 0,
            value: 0,
            cardValue: 0,
            boletoValue: 0,
            commercialQuantity: 0,
            commercialValue: 0
          }
        }
        
        productSummary[productName].quantity += 1
        productSummary[productName].boletoQuantity += 1
        productSummary[productName].value += saleValue
        productSummary[productName].boletoValue += saleValue
        
        // Track offer data (TMB/Boleto)
        const offerNameBoleto = boletoSale.raw?.oferta || 
                               boletoSale.raw?.campanha ||
                               boletoSale.offer ||
                               boletoSale.campaign ||
                               'TMB - Oferta não identificada'
        
        if (!offerSummary[offerNameBoleto]) {
          offerSummary[offerNameBoleto] = {
            name: offerNameBoleto,
            quantity: 0,
            value: 0,
            source: 'TMB',
            products: {}
          }
        }
        
        offerSummary[offerNameBoleto].quantity += 1
        offerSummary[offerNameBoleto].value += saleValue
        
        // Track product within offer
        if (!offerSummary[offerNameBoleto].products[productName]) {
          offerSummary[offerNameBoleto].products[productName] = {
            quantity: 0,
            value: 0
          }
        }
        offerSummary[offerNameBoleto].products[productName].quantity += 1
        offerSummary[offerNameBoleto].products[productName].value += saleValue
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
      
      // Convert product summary to array and sort by value descending
      const productDataArray = Object.values(productSummary).sort((a, b) => b.value - a.value)
      setProductData(productDataArray)
      
      // Convert offer summary to array and sort by value descending
      const offerDataArray = Object.values(offerSummary).sort((a, b) => b.value - a.value)
      setOfferData(offerDataArray)

      // Forçar atualização do estado de carregamento
      setLoading(false)
    } catch (error) {
      console.error('Erro na requisição:', error)
      setError(error)
      setLoading(false)
    }
  }, [firstDayOfMonth, lastDayOfMonth, selectedYear, selectedMonth])

  // Buscar dados quando o componente monta ou quando mês/ano muda
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
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-4 text-xl text-text-light dark:text-text-dark font-medium">Carregando dados do mês...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header moderno com glassmorphism */}
        <div className="mb-12 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 dark:from-primary/20 dark:via-blue-500/10 dark:to-purple-500/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/70 dark:bg-secondary/70 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-2">
                    Consolidado Mensal de Vendas
                  </h1>
                  <p className="text-text-muted-light dark:text-text-muted-dark text-lg">
                    Análise detalhada do desempenho mensal
                  </p>
                </div>
              </div>
              
              <button
                onClick={fetchMonthlyData}
                className="group p-4 flex justify-center items-center rounded-2xl bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500"
                >
                  <path
                    d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Seletor de Período Moderno */}
        <div className="group relative animate-fade-in mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-500/10 via-gray-500/5 to-zinc-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">
                  Selecionar Período
                </h3>
                <p className="text-text-muted-light dark:text-text-muted-dark">
                  Escolha o mês e ano para análise
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-text-light dark:text-text-dark">
                  Ano
                </label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all duration-200 appearance-none cursor-pointer font-medium text-lg shadow-sm hover:shadow-md"
                  >
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-text-muted-light dark:text-text-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-text-light dark:text-text-dark">
                  Mês
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all duration-200 appearance-none cursor-pointer font-medium text-lg shadow-sm hover:shadow-md"
                  >
                    <option value={1}>Janeiro</option>
                    <option value={2}>Fevereiro</option>
                    <option value={3}>Março</option>
                    <option value={4}>Abril</option>
                    <option value={5}>Maio</option>
                    <option value={6}>Junho</option>
                    <option value={7}>Julho</option>
                    <option value={8}>Agosto</option>
                    <option value={9}>Setembro</option>
                    <option value={10}>Outubro</option>
                    <option value={11}>Novembro</option>
                    <option value={12}>Dezembro</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-text-muted-light dark:text-text-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Resumo Modernos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card Total de Vendas */}
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
                {formatCurrency(monthlyData?.totals?.total_net_amount || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                {monthlyData?.totals?.total_transactions || 0} vendas realizadas
              </p>
            </div>
          </div>

          
          {/* Card Vendas Cartão */}
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
                {formatCurrency(monthlyData?.totals?.total_card_amount || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {monthlyData?.totals?.total_card_transactions || 0} transações
              </p>
            </div>
          </div>
          
          {/* Card Vendas Boleto */}
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
                {formatCurrency(boletoData?.total_boleto_value || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                {boletoData?.total_boleto_quantity || 0} boletos
              </p>
            </div>
          </div>
        </div>
        
        {/* Segunda linha de cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="group relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 md:hidden">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Ticket Médio
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary">
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
          <div className="group relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hidden md:block">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Ticket Médio
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary">
              {formatCurrency(
                monthlyData?.totals?.total_net_amount &&
                  monthlyData?.totals?.total_transactions
                  ? monthlyData.totals.total_net_amount /
                      monthlyData.totals.total_transactions
                  : 0,
              )}
            </p>
          </div>
          
          <div className="group relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary">
              {formatCurrency(
                monthlyData?.totals?.total_net_affiliate_value || 0,
              )}
            </p>
          </div>
          
          {/* Card de reembolsos */}
          <div className="group relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Reembolsos
            </h3>
            <p className="mt-2 text-3xl font-bold text-red-500">
              {formatCurrency(refundsData?.total_refund_amount || 0)}
            </p>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
              {refundsData?.total_refund_quantity || 0} reembolso(s)
            </p>
          </div>
          
          {/* Vendas do comercial */}
          <div className="group relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Comercial
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-500">
              {formatCurrency(commercialData?.total_commercial_value || 0)}
            </p>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
              {commercialData?.total_commercial_quantity || 0} venda(s)
            </p>
          </div>
        </div>

        {/* Metas e Progresso Modernizadas */}
        <div className="mb-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-4">
              Acompanhamento de Metas Mensais
            </h2>
            <p className="text-text-muted-light dark:text-text-muted-dark text-lg">
              Monitore o progresso em relação aos objetivos do mês
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {['meta', 'superMeta', 'ultraMeta'].map((metaType) => (
            <div
              key={metaType}
              className="bg-white dark:bg-secondary rounded-lg shadow p-6"
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
                    className="text-primary hover:text-primary-dark transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <button
                    onClick={() => saveGoal(metaType)}
                    className="text-green-500 hover:text-green-600 transition-colors"
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
                <p className="text-2xl font-bold text-primary">
                  {goals[metaType]}
                </p>
              )}
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full"
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
                      ? 'text-green-500'
                      : 'text-red-500'
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
        </div>

        {/* Gráficos Modernos */}
        <div className="space-y-12">
          {/* Gráfico de Barras */}
          <div className="group relative animate-slide-up">
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
                      Vendas Diárias
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Performance dia a dia do mês
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-80">
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
          </div>

          {/* Gráfico de Linha */}
          <div className="group relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-blue-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-0">
                      Progressão Mensal
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Evolução das vendas ao longo do mês
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-80">
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
          </div>
          
          {/* Gráfico comparativo cartão vs boleto */}
          <div className="group relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-blue-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-0">
                      Cartão vs Boleto
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Comparativo por método de pagamento
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-80">
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
          </div>
          
          {/* Quantidade de vendas por tipo */}
          <div className="group relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-blue-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-0">
                      Quantidade por Tipo
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Volume de vendas por categoria
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-80">
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

        {/* Product sales summary table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Resumo de Vendas por Produto - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Produto
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Vendas
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cartão
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Boleto
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Comercial
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Faturamento Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum produto encontrado no período selecionado
                    </td>
                  </tr>
                ) : (
                  productData.map((product, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-500 dark:text-green-400">
                        {product.cardQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-500 dark:text-yellow-400">
                        {product.boletoQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-500 dark:text-blue-400">
                        {product.commercialQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(product.value)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Totals row */}
                {productData.length > 0 && (
                  <tr className="bg-gray-100 dark:bg-gray-600 font-bold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {productData.reduce((sum, product) => sum + product.quantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {productData.reduce((sum, product) => sum + product.cardQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {productData.reduce((sum, product) => sum + product.boletoQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {productData.reduce((sum, product) => sum + product.commercialQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                      {formatCurrency(productData.reduce((sum, product) => sum + product.value, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Offer sales summary table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Resumo de Vendas por Oferta - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Oferta
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Origem
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Faturamento
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Produtos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {offerData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma oferta encontrada no período selecionado
                    </td>
                  </tr>
                ) : (
                  <>
                    {offerData.map((offer, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {offer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            offer.source === 'TMB' 
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {offer.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                          {offer.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(offer.value)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="max-w-xs">
                            {Object.entries(offer.products).map(([productName, productInfo], pIndex) => (
                              <div key={pIndex} className="text-xs">
                                <span className="font-medium">{productName}:</span> {productInfo.quantity}x
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Totals row for offers */}
                    <tr className="bg-gray-100 dark:bg-gray-600 font-bold">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                        TOTAL
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex justify-center gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            TMB: {offerData.filter(o => o.source === 'TMB').length}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Guru: {offerData.filter(o => o.source === 'Guru').length}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                        {offerData.reduce((sum, offer) => sum + offer.quantity, 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(offerData.reduce((sum, offer) => sum + offer.value, 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                        -
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthlyDashboard