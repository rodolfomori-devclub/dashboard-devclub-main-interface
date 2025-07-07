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
  const [loading, setLoading] = useState(true)

  const fetchDayData = useCallback(async (date) => {
    try {
      setLoading(true)

      // Buscar transações aprovadas
      let transactionsResponse = { data: { data: [] } }
      try {
        transactionsResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/transactions`,
          {
            ordered_at_ini: date,
            ordered_at_end: date,
          },
          {
            timeout: 60000,
          },
        )
      } catch (error) {
        console.warn('Erro ao buscar transações:', error.message)
      }

      // Buscar transações reembolsadas
      let refundsResponse = { data: { data: [] } }
      try {
        refundsResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/refunds`,
          {
            ordered_at_ini: date,
            ordered_at_end: date,
          },
          {
            timeout: 60000,
          },
        )
      } catch (error) {
        console.warn('Erro ao buscar reembolsos:', error.message)
      }

      // Buscar vendas de boleto (TMB)
      let boletoSales = []
      try {
        const selectedDate = new Date(date)
        boletoSales = await boletoService.getSalesByDate(selectedDate)
      } catch (error) {
        console.warn('Erro ao buscar vendas de boleto:', error.message)
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

        totalBoletoSales += 1
        totalBoletoValue += saleValue

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
      const totalCardSales = totalSales
      totalSales += totalBoletoSales
      const totalCombinedValue = totalValue + totalBoletoValue
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

      setLoading(false)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
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
                {formatCurrency(boletoData?.totalBoletoValue || 0)}
              </p>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                {boletoData?.totalBoletoSales || 0} boletos
              </p>
            </div>
          </div>
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card Afiliações */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.3s'}}>
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
          <div className="group relative animate-slide-up" style={{animationDelay: '0.4s'}}>
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
          <div className="group relative animate-slide-up" style={{animationDelay: '0.5s'}}>
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

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Gráfico de Progressão por Hora */}
          <div className="group relative animate-slide-up" style={{animationDelay: '0.6s'}}>
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
          <div className="group relative animate-slide-up" style={{animationDelay: '0.7s'}}>
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
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      label
                    >
                      {todayData?.productData?.map((entry, index) => (
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Today