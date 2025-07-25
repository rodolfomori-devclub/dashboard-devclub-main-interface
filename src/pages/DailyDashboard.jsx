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
import RefundDetailsModal from '../components/RefundDetailsModal'

function DailyDashboard() {
  const [data, setData] = useState(null)
  const [refundsData, setRefundsData] = useState(null)
  const [refundsDetails, setRefundsDetails] = useState([]) // Raw refund data
  const [showRefundsModal, setShowRefundsModal] = useState(false) // Modal visibility
  const [commercialData, setCommercialData] = useState(null)
  const [boletoData, setBoletoData] = useState(null)
  const [productData, setProductData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    // Get current date in local format
    const today = new Date()
    // Create date 7 days ago
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)

    // Format to YYYY-MM-DD in local timezone
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
      // For timestamps in seconds (Unix format)
      const date = new Date(timestamp * 1000)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    // For timestamps in milliseconds (JavaScript format)
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true)
      console.log(`Fetching data: From ${startDate} to ${endDate}`)

      // Fetch approved transactions
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        }
      )

      // Fetch refunds
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        }
      )

      // Store raw refund data for the modal
      setRefundsDetails(refundsResponse.data.data || [])

      // Fetch boleto sales
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59')
      const boletoSales = await boletoService.getSalesByDateRange(start, end)

      console.log('Transaction data received:', transactionsResponse.data)
      console.log('Refund data received:', refundsResponse.data)
      console.log('Boleto data received:', boletoSales)

      const dailyDataMap = {}
      let totalAffiliateValue = 0
      let totalCommercialValue = 0
      let totalCommercialQuantity = 0
      let totalBoletoValue = 0
      let totalBoletoQuantity = 0

      // Object to track product information
      const productSummary = {}

      // Initialize daily data map
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

      // Process transactions
      if (Array.isArray(transactionsResponse.data.data)) {
        transactionsResponse.data.data.forEach((transaction) => {
          // Convert timestamp to local date
          const transactionDate = convertTimestampToDate(
            transaction.dates.created_at,
          )

          // Debug log
          console.log(
            `Transaction: timestamp=${transaction.dates.created_at}, date=${transactionDate}`,
          )

          const netAmount = Number(
            transaction?.calculation_details?.net_amount || 0,
          )
          const affiliateValue = Number(
            transaction?.calculation_details?.net_affiliate_value || 0,
          )

          // Check if it's a commercial sale
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
              `Warning: Transaction with date ${transactionDate} outside defined range`,
            )
          }

          totalAffiliateValue += affiliateValue

          // Track product data
          const productName = transaction.product?.name || 'Unidentified product'
          
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
        })
      }

      // Process refunds
      let totalRefundAmount = 0
      let totalRefundQuantity = 0

      if (Array.isArray(refundsResponse.data.data)) {
        refundsResponse.data.data.forEach((refund) => {
          // Convert timestamp to local date
          const refundDate = convertTimestampToDate(refund.dates.created_at)

          // Use net amount calculated by backend which applies the same rules as transactions
          const refundAmount = refund.calculation_details?.net_amount || 0

          if (dailyDataMap[refundDate]) {
            dailyDataMap[refundDate].refund_amount += refundAmount
            dailyDataMap[refundDate].refund_quantity += 1
          } else {
            console.log(
              `Warning: Refund with date ${refundDate} outside defined range`,
            )
          }

          totalRefundAmount += refundAmount
          totalRefundQuantity += 1
        })
      }

      // Process boleto sales
      boletoSales.forEach((sale) => {
        if (!sale || !sale.timestamp) return

        // Convert to local date
        const saleDate = new Date(sale.timestamp)
        const dateStr = saleDate.toISOString().split('T')[0]
        const saleValue = sale.value || 0

        if (dailyDataMap[dateStr]) {
          dailyDataMap[dateStr].boleto_value += saleValue
          dailyDataMap[dateStr].boleto_quantity += 1
          // Also add to general totals
          dailyDataMap[dateStr].net_amount += saleValue
          dailyDataMap[dateStr].quantity += 1
        } else {
          console.log(
            `Boleto sale with date ${dateStr} outside defined range`,
          )
        }

        totalBoletoValue += saleValue
        totalBoletoQuantity += 1

        // Track boleto product data
        const productName = sale.product || 'Unidentified product'
        
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
      })

      const chartData = Object.values(dailyDataMap)
      console.log('Processed data:', chartData)
      console.log('Total affiliate value:', totalAffiliateValue)
      console.log('Total refund value:', totalRefundAmount)
      console.log('Total commercial sales value:', totalCommercialValue)
      console.log('Total boleto sales value:', totalBoletoValue)

      // Convert product summary to array and sort by value descending
      const productDataArray = Object.values(productSummary).sort((a, b) => b.value - a.value)
      
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

      // Store product data
      setProductData(productDataArray)

      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
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
    const date = new Date(dateStr + 'T12:00:00') // Use noon to avoid timezone issues
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

  // Function to open refund details modal
  const handleOpenRefundsModal = () => {
    setShowRefundsModal(true)
  }

  // Function to close refund details modal
  const handleCloseRefundsModal = () => {
    setShowRefundsModal(false)
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

        <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Main summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Líquido Total
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(data?.totals?.total_net_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total: {data?.totals?.total_transactions || 0} venda(s)
            </p>
          </div>

          {/* Card for card sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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

          {/* Card for boleto sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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

        {/* Second row of cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Affiliate value */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(data?.totals?.total_net_affiliate_value || 0)}
            </p>
          </div>

          {/* Refunds card - MODIFIED with "Ver Mais" button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                Reembolsos
              </h3>
              <button
                onClick={handleOpenRefundsModal}
                className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-800/50 transition-colors"
              >
                Ver Mais
              </button>
            </div>
            <p className="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">
              {formatCurrency(refundsData?.total_refund_amount || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {refundsData?.total_refund_quantity || 0} reembolso(s)
            </p>
          </div>

          {/* Commercial sales */}
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

        {/* Main chart - Sales by day */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
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
                {/* Bar for commercial sales */}
                <Bar
                  yAxisId="left"
                  dataKey="commercial_value"
                  name="Valor Comercial"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                {/* Bar for boleto sales */}
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

        {/* Comparison chart - Regular vs commercial sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
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

        {/* Comparison chart - Card vs boleto sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
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
                />
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

        {/* Product sales summary table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Resumo de Vendas por Produto
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
      </div>

      {/* Refund details modal */}
      <RefundDetailsModal 
        isOpen={showRefundsModal}
        onClose={handleCloseRefundsModal}
        refundsData={refundsDetails}
      />
    </div>
  )
}

export default DailyDashboard