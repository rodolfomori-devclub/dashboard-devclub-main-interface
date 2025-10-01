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
  const [offerData, setOfferData] = useState([])
  const [selectedOffers, setSelectedOffers] = useState([])
  const [availableOffers, setAvailableOffers] = useState([])
  const [categoryData, setCategoryData] = useState({ ia: {}, programacao: {} })
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    // Get current date in local format
    const today = new Date()
    
    // Format to YYYY-MM-DD in local timezone
    const formatLocalDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = today.getDay()
    
    let startDate, endDate
    
    if (dayOfWeek === 1) {
      // If today is Monday, get from last Monday to last Sunday
      const lastMonday = new Date(today)
      lastMonday.setDate(today.getDate() - 7)
      
      const lastSunday = new Date(today)
      lastSunday.setDate(today.getDate() - 1)
      
      startDate = lastMonday
      endDate = lastSunday
    } else {
      // For any other day, get from last Monday to today
      const lastMonday = new Date(today)
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // If Sunday (0), go back 6 days to Monday
      lastMonday.setDate(today.getDate() - daysToSubtract)
      
      startDate = lastMonday
      endDate = today
    }

    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(endDate),
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
          sales: [] // Array of individual sales
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
          sales: [] // Array of individual sales
        }
      }

      // Object to track product information
      const productSummary = {}
      
      // Object to track offer information
      const offerSummary = {}

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
        // Debug: log first transaction to see structure (desativado em produção)
        // if (transactionsResponse.data.data.length > 0) {
        //   console.log('Sample transaction structure:', transactionsResponse.data.data[0])
        // }
        
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
          const productCategory = categorizeProduct(productName)
          
          if (!productSummary[productName]) {
            productSummary[productName] = {
              name: productName,
              category: productCategory,
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
            productSummary[productName].commercialQuantity += 1
            productSummary[productName].commercialValue += netAmount
            categoryTotals[productCategory].commercialValue += netAmount
            categoryTotals[productCategory].commercialQuantity += 1
          }
          
          // Track offer data (Guru/Cartão)
          // Debug: log offer fields to understand structure (desativado em produção)
          // if (Math.random() < 0.01) { // Log 1% of transactions
          //   console.log('Transaction offer fields:', {
          //     utm_campaign: transaction.trackings?.utm_campaign,
          //     utm_content: transaction.trackings?.utm_content,
          //     utm_term: transaction.trackings?.utm_term,
          //     offer_code: transaction.trackings?.offer_code,
          //     order_offer: transaction.order?.offer_code,
          //     offer_name: transaction.offer?.name,
          //     product_offer: transaction.product?.offer,
          //     full_transaction: transaction
          //   })
          // }
          
          // Para o Guru, a oferta pode estar em diferentes campos
          // Vamos tentar identificar a oferta corretamente
          const offerName = transaction.offer?.name || 
                          transaction.product?.offer?.name ||
                          transaction.trackings?.utm_campaign || 
                          transaction.trackings?.utm_content ||
                          transaction.trackings?.offer_code || 
                          transaction.order?.offer_code ||
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
      // Debug: log first boleto sale to see structure
      if (boletoSales.length > 0) {
        console.log('Sample boleto sale structure:', boletoSales[0])
        console.log('Boleto raw data:', boletoSales[0].raw)
      }
      
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
        const productNameBoleto = sale.product || sale.raw?.produto || 'Produto não identificado'
        const productCategoryBoleto = categorizeProduct(productNameBoleto)
        
        if (!productSummary[productNameBoleto]) {
          productSummary[productNameBoleto] = {
            name: productNameBoleto,
            category: productCategoryBoleto,
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
        
        productSummary[productNameBoleto].quantity += 1
        productSummary[productNameBoleto].boletoQuantity += 1
        productSummary[productNameBoleto].value += saleValue
        productSummary[productNameBoleto].boletoValue += saleValue
        
        // Update category totals for boleto
        categoryTotals[productCategoryBoleto].totalValue += saleValue
        categoryTotals[productCategoryBoleto].totalQuantity += 1
        categoryTotals[productCategoryBoleto].boletoValue += saleValue
        categoryTotals[productCategoryBoleto].boletoQuantity += 1
        
        // Add individual boleto sale to category
        categoryTotals[productCategoryBoleto].sales.push({
          id: sale.id || `boleto-${Date.now()}-${Math.random()}`,
          productName: productNameBoleto,
          value: saleValue,
          method: 'Boleto',
          timestamp: sale.timestamp ? Math.floor(sale.timestamp / 1000) : Date.now() / 1000,
          isCommercial: false,
          affiliateValue: 0
        })
        
        // Track offer data (TMB/Boleto)
        // Debug para entender estrutura da oferta no TMB
        if (Math.random() < 0.1) { // Log 10% das vendas TMB
          console.log('TMB Sale Debug:', {
            product: productNameBoleto,
            raw: sale.raw,
            fullSale: sale
          })
        }
        
        // Para o TMB, vamos tentar extrair a oferta do campo produto
        // Assumindo que o formato pode ser algo como "Produto - Oferta" ou similar
        let offerNameBoleto = productNameBoleto
        
        // Verificar se existe um padrão no nome do produto que indique a oferta
        // Por exemplo: "DevClub - Black Friday" ou "DevClub (Oferta X)"
        if (productNameBoleto.includes(' - ')) {
          // Se tiver " - ", pegar a parte após o hífen como oferta
          const parts = productNameBoleto.split(' - ')
          offerNameBoleto = parts.length > 1 ? `TMB - ${parts[1]}` : `TMB - ${productNameBoleto}`
        } else if (productNameBoleto.includes('(') && productNameBoleto.includes(')')) {
          // Se tiver parênteses, extrair o conteúdo como oferta
          const match = productNameBoleto.match(/\(([^)]+)\)/)
          offerNameBoleto = match ? `TMB - ${match[1]}` : `TMB - ${productNameBoleto}`
        } else {
          // Se não houver padrão, usar o produto completo
          offerNameBoleto = `TMB - ${productNameBoleto}`
        }
        
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
        if (!offerSummary[offerNameBoleto].products[productNameBoleto]) {
          offerSummary[offerNameBoleto].products[productNameBoleto] = {
            quantity: 0,
            value: 0
          }
        }
        offerSummary[offerNameBoleto].products[productNameBoleto].quantity += 1
        offerSummary[offerNameBoleto].products[productNameBoleto].value += saleValue
      })

      const chartData = Object.values(dailyDataMap)
      console.log('Processed data:', chartData)
      console.log('Total affiliate value:', totalAffiliateValue)
      console.log('Total refund value:', totalRefundAmount)
      console.log('Total commercial sales value:', totalCommercialValue)
      console.log('Total boleto sales value:', totalBoletoValue)

      // Convert product summary to array and sort by value descending
      const productDataArray = Object.values(productSummary).sort((a, b) => b.value - a.value)
      
      // Convert offer summary to array and sort by value descending
      const offerDataArray = Object.values(offerSummary).sort((a, b) => b.value - a.value)
      
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
      
      // Store offer data
      setOfferData(offerDataArray)
      
      // Store category data
      setCategoryData(categoryTotals)
      
      // Extract unique offer names for filter
      const uniqueOffers = [...new Set(offerDataArray.map(offer => offer.name))]
      setAvailableOffers(uniqueOffers)

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

  // Function to handle offer selection
  const handleOfferChange = (offerName) => {
    setSelectedOffers(prev => {
      if (prev.includes(offerName)) {
        return prev.filter(o => o !== offerName)
      } else {
        return [...prev, offerName]
      }
    })
  }

  // Function to clear all offer filters
  const clearOfferFilters = () => {
    setSelectedOffers([])
  }

  // Filter data based on selected offers
  const getFilteredData = () => {
    if (selectedOffers.length === 0) {
      return {
        dailyData: data?.dailyData || [],
        productData: productData,
        offerData: offerData
      }
    }

    // Filter offer data
    const filteredOffers = offerData.filter(offer => selectedOffers.includes(offer.name))
    
    // Get products from filtered offers
    const productsInOffers = new Set()
    filteredOffers.forEach(offer => {
      Object.keys(offer.products).forEach(productName => {
        productsInOffers.add(productName)
      })
    })
    
    // Filter product data
    const filteredProducts = productData.filter(product => productsInOffers.has(product.name))
    
    // Recalculate daily data based on filtered offers
    // This is a simplified version - in production you might want to recalculate from raw transactions
    const filteredDailyData = data?.dailyData?.map(day => {
      const totalValue = filteredOffers.reduce((sum, offer) => sum + offer.value, 0)
      const totalQuantity = filteredOffers.reduce((sum, offer) => sum + offer.quantity, 0)
      const ratio = data.totals.total_net_amount > 0 ? totalValue / data.totals.total_net_amount : 0
      
      return {
        ...day,
        net_amount: day.net_amount * ratio,
        quantity: Math.round(day.quantity * ratio),
        affiliate_value: day.affiliate_value * ratio,
        commercial_value: day.commercial_value * ratio,
        boleto_value: day.boleto_value * ratio
      }
    }) || []
    
    return {
      dailyData: filteredDailyData,
      productData: filteredProducts,
      offerData: filteredOffers
    }
  }

  const filteredData = getFilteredData()

  // Calculate filtered totals
  const getFilteredTotals = () => {
    if (selectedOffers.length === 0) {
      return {
        total_net_amount: data?.totals?.total_net_amount || 0,
        total_transactions: data?.totals?.total_transactions || 0,
        total_card_amount: data?.totals?.total_card_amount || 0,
        total_card_transactions: data?.totals?.total_card_transactions || 0,
        total_net_affiliate_value: data?.totals?.total_net_affiliate_value || 0,
        total_boleto_value: boletoData?.total_boleto_value || 0,
        total_boleto_quantity: boletoData?.total_boleto_quantity || 0,
        total_refund_amount: refundsData?.total_refund_amount || 0,
        total_refund_quantity: refundsData?.total_refund_quantity || 0,
        total_commercial_value: commercialData?.total_commercial_value || 0,
        total_commercial_quantity: commercialData?.total_commercial_quantity || 0
      }
    }

    // Calculate totals from filtered data
    const filteredOffers = offerData.filter(offer => selectedOffers.includes(offer.name))
    const totalFilteredValue = filteredOffers.reduce((sum, offer) => sum + offer.value, 0)
    const totalFilteredQuantity = filteredOffers.reduce((sum, offer) => sum + offer.quantity, 0)
    
    // Separate by source
    const tmbOffers = filteredOffers.filter(o => o.source === 'TMB')
    const guruOffers = filteredOffers.filter(o => o.source === 'Guru')
    
    const tmbValue = tmbOffers.reduce((sum, offer) => sum + offer.value, 0)
    const tmbQuantity = tmbOffers.reduce((sum, offer) => sum + offer.quantity, 0)
    const guruValue = guruOffers.reduce((sum, offer) => sum + offer.value, 0)
    const guruQuantity = guruOffers.reduce((sum, offer) => sum + offer.quantity, 0)

    // For simplified calculation, assume proportional distribution of other metrics
    const ratio = data?.totals?.total_net_amount > 0 ? totalFilteredValue / data.totals.total_net_amount : 0

    return {
      total_net_amount: totalFilteredValue,
      total_transactions: totalFilteredQuantity,
      total_card_amount: guruValue, // Guru = Card
      total_card_transactions: guruQuantity,
      total_net_affiliate_value: (data?.totals?.total_net_affiliate_value || 0) * ratio,
      total_boleto_value: tmbValue, // TMB = Boleto
      total_boleto_quantity: tmbQuantity,
      total_refund_amount: (refundsData?.total_refund_amount || 0) * ratio,
      total_refund_quantity: Math.round((refundsData?.total_refund_quantity || 0) * ratio),
      total_commercial_value: (commercialData?.total_commercial_value || 0) * ratio,
      total_commercial_quantity: Math.round((commercialData?.total_commercial_quantity || 0) * ratio)
    }
  }

  const filteredTotals = getFilteredTotals()

  // Function to open refund details modal
  const handleOpenRefundsModal = () => {
    setShowRefundsModal(true)
  }

  // Function to close refund details modal
  const handleCloseRefundsModal = () => {
    setShowRefundsModal(false)
  }

  // Full screen loading overlay
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-xl font-medium text-text-light dark:text-text-dark mb-2">
            Carregando Dashboard
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aguarde enquanto buscamos os dados...
          </p>
        </div>
      </div>
    )
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

        {/* Category summary cards - IA vs Programming */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* IA Club card */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">IA Club</h3>
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Faturamento Total:</span>
                <span className="text-2xl font-bold">{formatCurrency(categoryData.ia?.totalValue || 0)}</span>
              </div>
              
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

          {/* DevClub card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">DevClub</h3>
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Faturamento Total:</span>
                <span className="text-2xl font-bold">{formatCurrency(categoryData.programacao?.totalValue || 0)}</span>
              </div>
              
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

        {/* Main summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Líquido Total
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(filteredTotals.total_net_amount)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total: {filteredTotals.total_transactions} venda(s)
            </p>
          </div>

          {/* Card for card sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Cartão
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(filteredTotals.total_card_amount)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTotals.total_card_transactions} venda(s)
            </p>
          </div>

          {/* Card for boleto sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Boleto
            </h3>
            <p className="mt-2 text-3xl font-bold text-yellow-500 dark:text-yellow-400">
              {formatCurrency(filteredTotals.total_boleto_value)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTotals.total_boleto_quantity} venda(s)
            </p>
          </div>
        </div>

        {/* Second row of cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor de Afiliações
            </h3>
            <p className="mt-2 text-3xl font-bold text-secondary dark:text-primary">
              {formatCurrency(filteredTotals.total_net_affiliate_value)}
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
              {formatCurrency(filteredTotals.total_refund_amount)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTotals.total_refund_quantity} reembolso(s)
            </p>
          </div>

          {/* Commercial sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Comercial
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-500 dark:text-blue-400">
              {formatCurrency(filteredTotals.total_commercial_value)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTotals.total_commercial_quantity} venda(s)
            </p>
          </div>
        </div>

        {/* Offer Filter Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Filtrar por Ofertas
            </h3>
            {selectedOffers.length > 0 && (
              <button
                onClick={clearOfferFilters}
                className="text-sm px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Limpar Filtros ({selectedOffers.length})
              </button>
            )}
          </div>
          
          {availableOffers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Carregando ofertas disponíveis...
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableOffers.map((offerName, index) => {
                const offer = offerData.find(o => o.name === offerName)
                const isSelected = selectedOffers.includes(offerName)
                
                return (
                  <div
                    key={index}
                    onClick={() => handleOfferChange(offerName)}
                    className={`
                      relative p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/10 dark:border-primary-dark dark:bg-primary-dark/10' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isSelected 
                            ? 'text-primary dark:text-primary-dark' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {offerName.length > 30 ? offerName.substring(0, 30) + '...' : offerName}
                        </p>
                        {offer && (
                          <>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {offer.quantity} vendas
                            </p>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {formatCurrency(offer.value)}
                            </p>
                            <span className={`inline-flex mt-1 px-1.5 py-0.5 text-xs font-semibold rounded ${{
                              'TMB': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                              'Guru': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }[offer.source] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'}`}>
                              {offer.source}
                            </span>
                          </>
                        )}
                      </div>
                      <div className={`
                        ml-2 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected 
                          ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark' 
                          : 'bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                        }
                      `}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {selectedOffers.length > 0 && (
            <div className="mt-4 p-3 bg-primary/5 dark:bg-primary-dark/5 rounded-lg">
              <p className="text-sm text-primary dark:text-primary-dark">
                <strong>Filtros ativos:</strong> Mostrando dados de {selectedOffers.length} oferta(s) selecionada(s)
              </p>
            </div>
          )}
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
                    Categoria
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
                {filteredData.productData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum produto encontrado no período selecionado
                    </td>
                  </tr>
                ) : (
                  filteredData.productData.map((product, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.category === 'ia' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {product.category === 'ia' ? 'IA Club' : 'DevClub'}
                        </span>
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
                {filteredData.productData.length > 0 && (
                  <tr className="bg-gray-100 dark:bg-gray-600 font-bold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex justify-center gap-2">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          IA: {filteredData.productData.filter(p => p.category === 'ia').length}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Dev: {filteredData.productData.filter(p => p.category === 'programacao').length}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {filteredData.productData.reduce((sum, product) => sum + product.quantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {filteredData.productData.reduce((sum, product) => sum + product.cardQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {filteredData.productData.reduce((sum, product) => sum + product.boletoQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                      {filteredData.productData.reduce((sum, product) => sum + product.commercialQuantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                      {formatCurrency(filteredData.productData.reduce((sum, product) => sum + product.value, 0))}
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
            Resumo de Vendas por Oferta
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
                {filteredData.offerData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma oferta encontrada no período selecionado
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredData.offerData.map((offer, index) => (
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
                            TMB: {filteredData.offerData.filter(o => o.source === 'TMB').length}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Guru: {filteredData.offerData.filter(o => o.source === 'Guru').length}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900 dark:text-white">
                        {filteredData.offerData.reduce((sum, offer) => sum + offer.quantity, 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(filteredData.offerData.reduce((sum, offer) => sum + offer.value, 0))}
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

        {/* Detailed sales by category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* IA Club detailed sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4 flex items-center">
              <div className="w-6 h-6 bg-purple-500 rounded-full mr-3 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              Vendas IA Club - Detalhamento ({categoryData.ia?.sales?.length || 0} vendas)
            </h3>
            <div className="max-h-96 overflow-y-auto">
              {categoryData.ia?.sales?.length > 0 ? (
                <div className="space-y-2">
                  {categoryData.ia.sales
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((sale, index) => (
                    <div key={sale.id} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {sale.productName}
                          </h4>
                          <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span className="flex items-center">
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
                        <div className="text-right">
                          <div className="font-bold text-purple-600 dark:text-purple-400">
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
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Nenhuma venda de IA Club no período selecionado
                </div>
              )}
            </div>
          </div>

          {/* DevClub detailed sales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4 flex items-center">
              <div className="w-6 h-6 bg-blue-500 rounded-full mr-3 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                </svg>
              </div>
              Vendas DevClub - Detalhamento ({categoryData.programacao?.sales?.length || 0} vendas)
            </h3>
            <div className="max-h-96 overflow-y-auto">
              {categoryData.programacao?.sales?.length > 0 ? (
                <div className="space-y-2">
                  {categoryData.programacao.sales
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((sale, index) => (
                    <div key={sale.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {sale.productName}
                          </h4>
                          <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span className="flex items-center">
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
                        <div className="text-right">
                          <div className="font-bold text-blue-600 dark:text-blue-400">
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
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Nenhuma venda de DevClub no período selecionado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main chart - Sales by day */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Dia
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.dailyData}>
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
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.dailyData}>
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
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.dailyData}>
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