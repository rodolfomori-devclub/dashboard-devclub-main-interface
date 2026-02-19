import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
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
  '#37E359',
  '#2563EB',
  '#EAB308',
  '#EF4444',
  '#8B5CF6',
  '#F59E0B',
]

function Today() {
  const initialDate = new Date()
  initialDate.setHours(12, 0, 0, 0)

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [displayDate, setDisplayDate] = useState(
    initialDate.toISOString().split('T')[0],
  )

  const [todayData, setTodayData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [asaasData, setAsaasData] = useState(null)
  const [categoryData, setCategoryData] = useState({ ia: {}, programacao: {} })
  const [loading, setLoading] = useState(true)
  const [loadingStates, setLoadingStates] = useState({
    transactions: true,
    refunds: true,
    boleto: true
  })

  // AbortController ref para cancelar requisições pendentes
  const abortControllerRef = useRef(null)

  // Function to categorize products by type
  const categorizeProduct = (productName) => {
    if (!productName) return 'programacao'
    
    const lowerName = productName.toLowerCase()
    
    // IA Club products - be very specific
    if (lowerName.includes('ia club') || 
        lowerName.includes('gestor de ia') ||
        lowerName.includes('formação gestor de ia')) {
      return 'ia'
    }
    
    // DevClub products (programming) - check these first to avoid conflicts
    if (lowerName.includes('devclub') || 
        lowerName.includes('full stack') ||
        lowerName.includes('vitalício') ||
        lowerName.includes('vitalicio')) {
      return 'programacao'
    }
    
    // Default to programming if not clearly IA
    return 'programacao'
  }

  const fetchDayData = useCallback(async (date) => {
    try {
      // Cancelar requisições anteriores se existirem
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Criar novo AbortController para esta requisição
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      setLoading(true)
      setLoadingStates({
        transactions: true,
        refunds: true,
        boleto: true
      })

      // Executar todas as chamadas em paralelo usando Promise.allSettled
      const [transactionsResult, refundsResult, boletoResult, asaasResult] = await Promise.allSettled([
        // Buscar transações aprovadas
        axios.post(
          `${import.meta.env.VITE_API_URL}/transactions`,
          {
            ordered_at_ini: date,
            ordered_at_end: date,
          },
          {
            timeout: 60000,
            signal,
          },
        ),
        // Buscar transações reembolsadas
        axios.post(
          `${import.meta.env.VITE_API_URL}/refunds`,
          {
            ordered_at_ini: date,
            ordered_at_end: date,
          },
          {
            timeout: 60000,
            signal,
          },
        ),
        // Buscar vendas de boleto (TMB)
        (async () => {
          const selectedDate = new Date(date)
          return await boletoService.getSalesByDate(selectedDate)
        })(),
        // Buscar vendas Asaas (boleto parcelado)
        axios.get(
          `${import.meta.env.VITE_API_URL}/boleto/asaas/vendas`,
          {
            params: { date },
            timeout: 30000,
            signal,
          },
        )
      ])

      // Processar resultado de transações
      let transactionsResponse = { data: { data: [] } }
      if (transactionsResult.status === 'fulfilled') {
        transactionsResponse = transactionsResult.value
        setLoadingStates(prev => ({ ...prev, transactions: false }))
      } else {
        const errorDetails = transactionsResult.reason

        // Ignorar erros de cancelamento (AbortController)
        if (errorDetails?.code === 'ERR_CANCELED' || errorDetails?.message === 'canceled') {
          setLoadingStates(prev => ({ ...prev, transactions: false }))
          return
        }

        // Mostrar mensagem mais específica baseada no erro
        if (errorDetails?.code === 'ECONNABORTED') {
          toast.error('Timeout ao carregar transações. A API está demorando muito.')
        } else if (errorDetails?.code === 'ERR_NETWORK' || errorDetails?.message?.includes('Network Error')) {
          toast.error('Erro de rede. Verifique se a API está rodando.')
        } else if (errorDetails?.response?.status === 404) {
          toast.error('Endpoint de transações não encontrado.')
        } else if (errorDetails?.response?.status >= 500) {
          toast.error('Erro no servidor da API ao carregar transações.')
        } else {
          toast.error('Erro ao carregar transações de cartão. Dados podem estar incompletos.')
        }

        setLoadingStates(prev => ({ ...prev, transactions: false }))
      }

      // Processar resultado de reembolsos
      let refundsResponse = { data: { data: [] } }
      if (refundsResult.status === 'fulfilled') {
        refundsResponse = refundsResult.value
        setLoadingStates(prev => ({ ...prev, refunds: false }))
      } else {
        const errorDetails = refundsResult.reason

        // Ignorar erros de cancelamento (AbortController)
        if (errorDetails?.code === 'ERR_CANCELED' || errorDetails?.message === 'canceled') {
          setLoadingStates(prev => ({ ...prev, refunds: false }))
        } else {
          toast.error('Erro ao carregar dados de reembolsos.')
          setLoadingStates(prev => ({ ...prev, refunds: false }))
        }
      }

      // Processar resultado de boleto
      let boletoSales = []
      if (boletoResult.status === 'fulfilled') {
        boletoSales = boletoResult.value
        setLoadingStates(prev => ({ ...prev, boleto: false }))
      } else {
        const errorDetails = boletoResult.reason

        // Ignorar erros de cancelamento (AbortController)
        if (errorDetails?.code === 'ERR_CANCELED' || errorDetails?.message === 'canceled') {
          setLoadingStates(prev => ({ ...prev, boleto: false }))
        } else {
          toast.error('Erro ao carregar vendas de boleto.')
          setLoadingStates(prev => ({ ...prev, boleto: false }))
        }
      }

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
          productSales: {},
        }))

      let totalSales = 0
      let totalValue = 0
      let totalAffiliateValue = 0
      let totalCommercialValue = 0
      let totalCommercialSales = 0
      let totalBoletoSales = 0
      let totalBoletoValue = 0
      const productSales = {}

      // Category tracking
      const categoryTotals = {
        ia: {
          totalValue: 0,
          totalQuantity: 0,
          cardValue: 0,
          cardQuantity: 0,
          boletoValue: 0,
          boletoQuantity: 0,
          commercialValue: 0,
          commercialQuantity: 0,
          affiliateValue: 0,
          sales: []
        },
        programacao: {
          totalValue: 0,
          totalQuantity: 0,
          cardValue: 0,
          cardQuantity: 0,
          boletoValue: 0,
          boletoQuantity: 0,
          commercialValue: 0,
          commercialQuantity: 0,
          affiliateValue: 0,
          sales: []
        }
      }

      transactionsResponse.data.data.forEach((transaction) => {
        const timestamp = transaction.dates.created_at * 1000
        const date = new Date(timestamp)
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

        const productName = transaction.product.name
        const productCategory = categorizeProduct(productName)
        
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

        // Update category totals
        categoryTotals[productCategory].totalValue += netAmount
        categoryTotals[productCategory].totalQuantity += 1
        categoryTotals[productCategory].cardValue += netAmount
        categoryTotals[productCategory].cardQuantity += 1
        categoryTotals[productCategory].affiliateValue += affiliateValue

        // Add individual sale to category
        categoryTotals[productCategory].sales.push({
          id: transaction.hash || `card-${Date.now()}-${Math.random()}`,
          productName: productName,
          value: netAmount,
          method: 'Cartão',
          timestamp: transaction.dates.created_at,
          isCommercial: isCommercial,
          affiliateValue: affiliateValue
        })

        if (isCommercial) {
          categoryTotals[productCategory].commercialValue += netAmount
          categoryTotals[productCategory].commercialQuantity += 1
        }

        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            category: productCategory,
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

        totalBoletoSales += 1
        totalBoletoValue += saleValue

        const productName = boletoSale.product
        const productCategory = categorizeProduct(productName)
        
        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            category: productCategory,
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

        // Update category totals for boleto
        categoryTotals[productCategory].totalValue += saleValue
        categoryTotals[productCategory].totalQuantity += 1
        categoryTotals[productCategory].boletoValue += saleValue
        categoryTotals[productCategory].boletoQuantity += 1
        
        // Add individual boleto sale to category
        categoryTotals[productCategory].sales.push({
          id: `boleto-${Date.now()}-${Math.random()}`,
          productName: productName,
          value: saleValue,
          method: 'Boleto',
          timestamp: Math.floor(date.getTime() / 1000),
          isCommercial: false,
          affiliateValue: 0
        })
      })

      // Processar dados de reembolsos
      let totalRefunds = 0
      let totalRefundAmount = 0
      const refundsByProduct = {}

      refundsResponse.data.data.forEach((refund) => {
        const productName = refund.product?.name || 'Produto não especificado'
        const refundAmount = Number(refund.calculation_details?.net_amount || 0)

        if (!refundsByProduct[productName]) {
          refundsByProduct[productName] = { count: 0, amount: 0 }
        }

        refundsByProduct[productName].count += 1
        refundsByProduct[productName].amount += refundAmount

        totalRefunds += 1
        totalRefundAmount += refundAmount
      })

      const refundProductData = Object.entries(refundsByProduct).map(
        ([name, data]) => ({
          name,
          refundCount: data.count,
          refundValue: data.amount,
        }),
      )

      hourlyData.forEach((hour, index) => {
        hourlyData[index].refundCount = 0
        hourlyData[index].refundValue = 0
      })

      const productData = Object.entries(productSales).map(([name, data]) => ({
        name,
        category: data.category,
        quantity: data.quantity,
        value: data.value,
        commercialQuantity: data.commercialQuantity || 0,
        commercialValue: data.commercialValue || 0,
        boletoQuantity: data.boletoQuantity || 0,
        boletoValue: data.boletoValue || 0,
      }))

      const hoursWithSales =
        hourlyData.filter((hour) => hour.sales > 0 || hour.boletoSales > 0)
          .length || 1
      // Extrair valor Asaas (já disponível pois Promise.allSettled resolveu)
      const asaasPurchaseValue =
        asaasResult.status === 'fulfilled' && asaasResult.value?.data?.success
          ? asaasResult.value.data.data?.totalPurchaseValue || 0
          : 0
      const asaasCount =
        asaasResult.status === 'fulfilled' && asaasResult.value?.data?.success
          ? asaasResult.value.data.data?.count || 0
          : 0

      const totalCardSales = totalSales
      totalSales += totalBoletoSales + asaasCount
      const totalCombinedValue = totalValue + totalBoletoValue + asaasPurchaseValue
      const averageSalesPerHour = totalSales / hoursWithSales

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

      // Processar dados do Asaas
      if (asaasResult.status === 'fulfilled' && asaasResult.value?.data?.success) {
        const asaas = asaasResult.value.data.data
        setAsaasData({
          totalGross: asaas.totalGross || 0,
          totalNet: asaas.totalNet || 0,
          totalFees: asaas.totalFees || 0,
          count: asaas.count || 0,
          totalPurchaseValue: asaas.totalPurchaseValue || 0,
        })
      } else {
        setAsaasData({ totalGross: 0, totalNet: 0, totalFees: 0, count: 0, totalPurchaseValue: 0 })
      }

      setCategoryData(categoryTotals)

      setLoading(false)
    } catch (error) {
      // Não mostrar erro se foi cancelamento intencional
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return
      }

      toast.error('Erro ao carregar dados do dia. Tente novamente.')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDayData(selectedDate)

    let interval
    if (selectedDate === new Date().toISOString().split('T')[0]) {
      interval = setInterval(() => fetchDayData(selectedDate), 5 * 60 * 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [fetchDayData, selectedDate])

  const handleDateChange = (e) => {
    const newDisplayDate = e.target.value
    setDisplayDate(newDisplayDate)

    const [year, month, day] = newDisplayDate
      .split('-')
      .map((num) => parseInt(num, 10))
    const correctedDate = new Date(year, month - 1, day, 12, 0, 0)

    setSelectedDate(correctedDate)
  }

  const getBarColor = (sales, averageSales) => {
    if (sales === 0) return '#EF4444'
    if (sales < averageSales * 0.5) return '#F97316'
    if (sales < averageSales) return '#FACC15'
    return '#22C55E'
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const hourData = payload[0].payload;

      const productSalesEntries = Object.entries(
        hourData.productSales || {},
      ).sort((a, b) => b[1] - a[1]);

      return (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-4 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-xl min-w-[200px]">
          <p className="font-bold text-text-light dark:text-text-dark text-lg border-b pb-2 mb-3">{`${label}:00h`}</p>
          <p className="text-text-light dark:text-text-dark font-medium">{`Vendas: ${hourData.sales}`}</p>
          <p className="text-text-light dark:text-text-dark mb-3">{`Valor: ${formatCurrency(
            hourData.value,
          )}`}</p>

          {hourData.commercialSales > 0 && (
            <p className="text-text-light dark:text-text-dark mb-2">{`Vendas Comercial: ${hourData.commercialSales}`}</p>
          )}

          {hourData.boletoSales > 0 && (
            <>
              <p className="text-text-light dark:text-text-dark mb-2">{`Vendas Boleto: ${hourData.boletoSales}`}</p>
              <p className="text-text-light dark:text-text-dark mb-2">{`Valor Boleto: ${formatCurrency(hourData.boletoValue || 0)}`}</p>
            </>
          )}

          {productSalesEntries.length > 0 && (
            <>
              <p className="font-medium text-text-light dark:text-text-dark border-t pt-2 mt-3">
                Vendas por produto:
              </p>
              <div className="mt-2 max-h-48 overflow-y-auto">
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
      );
    }
    return null;
  };

  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-start justify-center pt-32 z-50">
            <div className="flex flex-col items-center animate-fade-in">
              <div className="relative">
                <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary/20"></div>
                <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary border-t-transparent absolute top-0 left-0"></div>
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse"></div>
              </div>
              <p className="mt-6 text-xl text-text-light dark:text-text-dark font-medium animate-pulse">
                Carregando dados do dia...
              </p>
            </div>
          </div>
        )}

        {/* Header with gradient and glass effect */}
        <div className="mb-12 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 dark:from-primary/20 dark:via-blue-500/10 dark:to-purple-500/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/70 dark:bg-secondary/70 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-2">
                  Controle de Vendas Diário
                </h1>
                <p className="text-text-muted-light dark:text-text-muted-dark text-lg capitalize">
                  {formattedDate}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                <div className="relative">
                  <input
                    type="date"
                    value={displayDate}
                    onChange={handleDateChange}
                    className="px-4 py-3 border border-primary/20 rounded-xl text-text-light dark:text-text-dark bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                  />
                </div>
                <button
                  onClick={() => fetchDayData(selectedDate)}
                  className="p-3 flex justify-center items-center rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white hover:from-primary-dark hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
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
          </div>
        </div>

        {/* Cards principais */}
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
                {formatCurrency(todayData?.totalValue || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                {todayData?.totalSales || 0} vendas realizadas
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
                {formatCurrency((todayData?.totalValue || 0) - (boletoData?.totalBoletoValue || 0))}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {todayData?.totalCardSales || 0} transações
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
                {formatCurrency((boletoData?.totalBoletoValue || 0) + (asaasData?.totalPurchaseValue || 0))}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                {(boletoData?.totalBoletoSales || 0) + (asaasData?.count || 0)} boletos
              </p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted-light dark:text-text-muted-dark">TMB</span>
                  <span className="font-medium text-text-light dark:text-text-dark">{formatCurrency(boletoData?.totalBoletoValue || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted-light dark:text-text-muted-dark">Asaas (bruto total)</span>
                  <span className="font-medium text-text-light dark:text-text-dark">{formatCurrency(asaasData?.totalPurchaseValue || 0)}</span>
                </div>
                {asaasData?.totalPurchaseValue > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted-light dark:text-text-muted-dark">Asaas (recebido hoje)</span>
                    <span className="font-medium text-green-500">{formatCurrency(asaasData?.totalGross || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category summary cards - IA vs Programming */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* IA Club card */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.3s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                IA Club
              </h3>
              <p className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent mb-2">
                {formatCurrency(categoryData.ia?.totalValue || 0)}
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 py-2 border-t border-white/20">
                  <div className="text-center">
                    <div className="text-sm text-white/80 mb-1">💳 Cartão</div>
                    <div className="font-bold text-lg">{formatCurrency(categoryData.ia?.cardValue || 0)}</div>
                    <div className="text-xs text-white/70">{categoryData.ia?.cardQuantity || 0} vendas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-white/80 mb-1">📄 Boleto</div>
                    <div className="font-bold text-lg">{formatCurrency(categoryData.ia?.boletoValue || 0)}</div>
                    <div className="text-xs text-white/70">{categoryData.ia?.boletoQuantity || 0} vendas</div>
                  </div>
                </div>
                
                <div className="text-xs text-white/70 pt-2 border-t border-white/20">
                  💼 Comercial: {formatCurrency(categoryData.ia?.commercialValue || 0)} ({categoryData.ia?.commercialQuantity || 0} vendas)
                </div>
              </div>
            </div>
          </div>

          {/* DevClub card */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.4s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                DevClub
              </h3>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent mb-2">
                {formatCurrency(categoryData.programacao?.totalValue || 0)}
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 py-2 border-t border-white/20">
                  <div className="text-center">
                    <div className="text-sm text-white/80 mb-1">💳 Cartão</div>
                    <div className="font-bold text-lg">{formatCurrency(categoryData.programacao?.cardValue || 0)}</div>
                    <div className="text-xs text-white/70">{categoryData.programacao?.cardQuantity || 0} vendas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-white/80 mb-1">📄 Boleto</div>
                    <div className="font-bold text-lg">{formatCurrency(categoryData.programacao?.boletoValue || 0)}</div>
                    <div className="text-xs text-white/70">{categoryData.programacao?.boletoQuantity || 0} vendas</div>
                  </div>
                </div>
                
                <div className="text-xs text-white/70 pt-2 border-t border-white/20">
                  💼 Comercial: {formatCurrency(categoryData.programacao?.commercialValue || 0)} ({categoryData.programacao?.commercialQuantity || 0} vendas)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card Afiliações */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.5s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Valor de Afiliações
              </h3>
              <p className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
                {formatCurrency(todayData?.totalAffiliateValue || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Comissões de parceiros
              </p>
            </div>
          </div>

          {/* Card Reembolsos */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.6s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Reembolsos
              </h3>
              <p className="text-4xl font-bold text-red-500 mb-2">
                {formatCurrency(refundsData?.totalRefundAmount || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                {refundsData?.totalRefunds || 0} solicitações
              </p>
            </div>
          </div>

          {/* Card Vendas Comercial */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.7s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 112 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 112-2V6" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
                Vendas Comercial
              </h3>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent mb-2">
                {formatCurrency(commercialData?.totalCommercialValue || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                {commercialData?.totalCommercialSales || 0} vendas diretas
              </p>
            </div>
          </div>
        </div>


        {/* Detailed sales by category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* IA Club detailed sales */}
          <div className="group relative animate-slide-up" style={{animationDelay: '1.0s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-purple-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">
                    Vendas IA Club - Hoje
                  </h3>
                  <p className="text-text-muted-light dark:text-text-muted-dark">
                    {categoryData.ia?.sales?.length || 0} vendas realizadas
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 max-h-96 overflow-y-auto">
                {categoryData.ia?.sales?.length > 0 ? (
                  <div className="space-y-3">
                    {categoryData.ia.sales
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((sale, index) => (
                      <div key={sale.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50 hover:shadow-md transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                              {sale.productName}
                            </h4>
                            <div className="flex items-center space-x-3 text-xs">
                              <span className="flex items-center text-gray-600 dark:text-gray-400">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V9c0-.55.45-1 1-1zm0-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
                                </svg>
                                {new Date(sale.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                sale.method === 'Cartão' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {sale.method === 'Cartão' ? '💳' : '📄'} {sale.method}
                              </span>
                              {sale.isCommercial && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  💼 Comercial
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold text-lg text-purple-600 dark:text-purple-400">
                              {formatCurrency(sale.value)}
                            </div>
                            {sale.affiliateValue > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Afiliação: {formatCurrency(sale.affiliateValue)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <p className="text-lg font-medium mb-2">Nenhuma venda IA Club hoje</p>
                    <p className="text-sm">As vendas aparecerão aqui conforme forem realizadas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DevClub detailed sales */}
          <div className="group relative animate-slide-up" style={{animationDelay: '1.1s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-blue-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">
                    Vendas DevClub - Hoje
                  </h3>
                  <p className="text-text-muted-light dark:text-text-muted-dark">
                    {categoryData.programacao?.sales?.length || 0} vendas realizadas
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 max-h-96 overflow-y-auto">
                {categoryData.programacao?.sales?.length > 0 ? (
                  <div className="space-y-3">
                    {categoryData.programacao.sales
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((sale, index) => (
                      <div key={sale.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50 hover:shadow-md transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                              {sale.productName}
                            </h4>
                            <div className="flex items-center space-x-3 text-xs">
                              <span className="flex items-center text-gray-600 dark:text-gray-400">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V9c0-.55.45-1 1-1zm0-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
                                </svg>
                                {new Date(sale.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                sale.method === 'Cartão' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {sale.method === 'Cartão' ? '💳' : '📄'} {sale.method}
                              </span>
                              {sale.isCommercial && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  💼 Comercial
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                              {formatCurrency(sale.value)}
                            </div>
                            {sale.affiliateValue > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Afiliação: {formatCurrency(sale.affiliateValue)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <p className="text-lg font-medium mb-2">Nenhuma venda DevClub hoje</p>
                    <p className="text-sm">As vendas aparecerão aqui conforme forem realizadas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Gráfico de Progressão por Hora */}
          <div className="group relative animate-slide-up" style={{animationDelay: '1.2s'}}>
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
                      Progressão por Hora
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Média: {todayData?.averageSalesPerHour?.toFixed(1) || 0} vendas/hora
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={todayData?.hourlyData}
                    margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
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
                      {todayData?.hourlyData?.map((entry, index) => (
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
          </div>

          {/* Gráfico de Vendas por Produto */}
          <div className="group relative animate-slide-up" style={{animationDelay: '1.3s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-teal-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">
                      Vendas por Produto
                    </h3>
                    <p className="text-text-muted-light dark:text-text-muted-dark">
                      Distribuição por valor
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-background-light/50 to-slate-50/50 dark:from-background-dark/50 dark:to-gray-800/50 rounded-2xl p-6 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={todayData?.productData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={100}
                      fill="#8884d8"
                    >
                      {todayData?.productData?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      wrapperStyle={{
                        paddingTop: '20px',
                        fontSize: '14px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Today