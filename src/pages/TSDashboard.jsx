import React, { useState, useEffect, useCallback } from 'react'
import { getSales, getAllData } from '../services/tsApiService.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { formatCurrency } from '../utils/currencyUtils'

// Cores para os gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300']

function TSDashboard() {
  const [data, setData] = useState(null)
  const [tsData, setTsData] = useState(null)
  const [generalData, setGeneralData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeTab, setActiveTab] = useState('vendas') // 'vendas' ou 'dados_gerais'
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

    return {
      start: formatLocalDate(today),
      end: formatLocalDate(today),
    }
  })
  const [filterType, setFilterType] = useState('hoje') // 'hoje', 'ultimo_mes', 'vendas_por_mes' ou 'periodo'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  })

  const fetchGeneralData = useCallback(async () => {
    try {
      setLoadingGeneral(true)
      console.log('Fetching dados gerais...')

      const response = await getAllData()
      
      if (response.success) {
        setGeneralData(response)
        setLastUpdate(new Date())
        console.log('Dados gerais carregados:', response)
      } else {
        console.error('Erro ao carregar dados gerais')
      }

      setLoadingGeneral(false)
    } catch (error) {
      console.error('Error fetching dados gerais:', error)
      setLoadingGeneral(false)
    }
  }, [])

  const fetchTSData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true)
      console.log(`Fetching T$ data: From ${startDate} to ${endDate}`)
      const startTime = performance.now()

      const response = await getSales()
      
      if (response.success) {
        const salesData = response.data
        const summary = response.summary

        // Filter data by date range - sempre aplicar filtro baseado nas datas
        let filteredData = salesData.filter(sale => {
          return sale.date >= startDate && sale.date <= endDate
        })
        
        const endTime = performance.now()
        console.log(`Dados carregados em ${Math.round(endTime - startTime)}ms`)
        console.log(`Dados originais: ${salesData.length}, Dados filtrados: ${filteredData.length}`)
        console.log(`Filtro aplicado: ${startDate} até ${endDate}`)
        
        if (filteredData.length > 0) {
          console.log('Primeiro registro filtrado:', filteredData[0])
        }

        // Process data for charts
        const dailyDataMap = {}
        let totalGuruValue = 0
        let totalTMBValue = 0
        let totalValue = 0
        let totalGuruQuantity = 0
        let totalTMBQuantity = 0
        let totalQuantity = 0

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
            total_value: 0,
            total_quantity: 0,
            guru_value: 0,
            guru_quantity: 0,
            tmb_value: 0,
            tmb_quantity: 0,
          }
        }

        // Process sales data usando os campos específicos da planilha
        filteredData.forEach((sale) => {
          const saleDate = sale.date
          
          // Usar os campos específicos da planilha
          const valorTotal = Number(sale.valor_vendas_realizadas || 0)
          const vendasRealizadas = Number(sale.vendas_realizadas || 0)
          const vendaGuru = Number(sale.venda_guru || 0)
          const vendaTMB = Number(sale.venda_tmb || 0)

          if (dailyDataMap[saleDate]) {
            // Total
            dailyDataMap[saleDate].total_value += valorTotal
            dailyDataMap[saleDate].total_quantity += vendasRealizadas

            // Guru (cartão)
            dailyDataMap[saleDate].guru_quantity += vendaGuru
            // Estimar valor do Guru baseado na proporção (evitar divisão por zero)
            const valorGuru = vendaGuru > 0 && vendasRealizadas > 0 ? 
              (valorTotal * vendaGuru) / vendasRealizadas : 0
            dailyDataMap[saleDate].guru_value += valorGuru
            totalGuruValue += valorGuru
            totalGuruQuantity += vendaGuru

            // TMB (boleto)
            dailyDataMap[saleDate].tmb_quantity += vendaTMB
            // Estimar valor do TMB baseado na proporção (evitar divisão por zero)
            const valorTMB = vendaTMB > 0 && vendasRealizadas > 0 ? 
              (valorTotal * vendaTMB) / vendasRealizadas : 0
            dailyDataMap[saleDate].tmb_value += valorTMB
            totalTMBValue += valorTMB
            totalTMBQuantity += vendaTMB
          }

          totalValue += valorTotal
          totalQuantity += vendasRealizadas
        })

        const chartData = Object.values(dailyDataMap)
        console.log('Processed T$ data:', chartData)

        setData({
          dailyData: chartData,
          totals: {
            total_value: totalValue,
            total_quantity: totalQuantity,
            guru_value: totalGuruValue,
            guru_quantity: totalGuruQuantity,
            tmb_value: totalTMBValue,
            tmb_quantity: totalTMBQuantity,
          },
        })

        setTsData({
          summary: summary,
          rawData: filteredData
        })
      } else {
        // Fallback para dados mockados
        const mockData = generateMockData(startDate, endDate)
        setData(mockData)
        setTsData({
          summary: { totalToday: 5000, totalMonth: 25000, productsCount: 3 },
          rawData: []
        })
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching T$ data:', error)
      
      // Usar dados mockados em caso de erro
      const mockData = generateMockData(startDate, endDate)
      setData(mockData)
      setTsData({
        summary: { totalToday: 5000, totalMonth: 25000, productsCount: 3 },
        rawData: []
      })
      setLoading(false)
    }
  }, [filterType])

  const generateMockData = (startDate, endDate) => {
    const dailyDataMap = {}
    
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

      // Gerar dados fictícios realistas
      const vendaGuruQty = Math.floor(Math.random() * 3) + 1
      const vendaTMBQty = Math.floor(Math.random() * 2) + 1
      const totalQty = vendaGuruQty + vendaTMBQty
      const valorTotal = Math.random() * 5000 + 2000
      
      // Calcular valores proporcionais
      const guruValue = totalQty > 0 ? (valorTotal * vendaGuruQty) / totalQty : 0
      const tmbValue = totalQty > 0 ? (valorTotal * vendaTMBQty) / totalQty : 0

      dailyDataMap[dateStr] = {
        date: dateStr,
        total_value: valorTotal,
        total_quantity: totalQty,
        guru_value: guruValue,
        guru_quantity: vendaGuruQty,
        tmb_value: tmbValue,
        tmb_quantity: vendaTMBQty,
      }
    }

    const chartData = Object.values(dailyDataMap)
    const totals = chartData.reduce((acc, day) => ({
      total_value: acc.total_value + day.total_value,
      total_quantity: acc.total_quantity + day.total_quantity,
      guru_value: acc.guru_value + day.guru_value,
      guru_quantity: acc.guru_quantity + day.guru_quantity,
      tmb_value: acc.tmb_value + day.tmb_value,
      tmb_quantity: acc.tmb_quantity + day.tmb_quantity,
    }), {
      total_value: 0,
      total_quantity: 0,
      guru_value: 0,
      guru_quantity: 0,
      tmb_value: 0,
      tmb_quantity: 0,
    })

    return {
      dailyData: chartData,
      totals: totals
    }
  }

  useEffect(() => {
    // Carregar dados de vendas
    if (filterType === 'hoje') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      console.log('Modo HOJE - Data atual:', todayStr)
      fetchTSData(todayStr, todayStr)
    } else if (filterType === 'ultimo_mes') {
      const today = new Date()
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]
      console.log('Modo ÚLTIMO MÊS - Datas:', firstDayStr, 'até', todayStr)
      fetchTSData(firstDayStr, todayStr)
    } else if (filterType === 'vendas_por_mes') {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
      console.log('Modo VENDAS POR MÊS - Datas:', startDate, 'até', endDate)
      fetchTSData(startDate, endDate)
    } else {
      console.log('Modo PERÍODO - Datas:', dateRange.start, 'até', dateRange.end)
      fetchTSData(dateRange.start, dateRange.end)
    }

    // Carregar dados gerais quando a aba estiver ativa
    if (activeTab === 'dados_gerais') {
      fetchGeneralData()
    }
  }, [dateRange, filterType, selectedMonth, activeTab, fetchTSData, fetchGeneralData])

  // Auto refresh para dados gerais a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh || activeTab !== 'dados_gerais') return

    const interval = setInterval(() => {
      fetchGeneralData()
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [autoRefresh, activeTab, fetchGeneralData])

  const handleRefreshData = () => {
    if (activeTab === 'dados_gerais') {
      fetchGeneralData()
    } else {
      if (filterType === 'hoje') {
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        fetchTSData(todayStr, todayStr)
      } else if (filterType === 'ultimo_mes') {
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]
        const todayStr = today.toISOString().split('T')[0]
        fetchTSData(firstDayStr, todayStr)
      } else if (filterType === 'vendas_por_mes') {
        const [year, month] = selectedMonth.split('-')
        const startDate = `${year}-${month}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
        fetchTSData(startDate, endDate)
      } else {
        fetchTSData(dateRange.start, dateRange.end)
      }
    }
  }

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
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

  const handleMonthChange = (monthValue) => {
    setSelectedMonth(monthValue)
    // Auto-fetch data when month changes
    const [year, month] = monthValue.split('-')
    const startDate = `${year}-${month}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
    
    console.log(`Mês selecionado: ${monthValue} (${startDate} até ${endDate})`)
    fetchTSData(startDate, endDate)
  }

  const handleFilterTypeChange = (type) => {
    setFilterType(type)
    if (type === 'hoje') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      setDateRange({ start: todayStr, end: todayStr })
    } else if (type === 'ultimo_mes') {
      const today = new Date()
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]
      setDateRange({ start: firstDayStr, end: todayStr })
    } else if (type === 'vendas_por_mes') {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
      setDateRange({ start: startDate, end: endDate })
    }
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            T$ - Toca o Sino Dashboard
          </h1>
          <div className="flex items-center gap-4">
            {/* Auto-refresh toggle - só mostra na aba de dados gerais */}
            {activeTab === 'dados_gerais' && (
              <>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={toggleAutoRefresh}
                    className="mr-2"
                  />
                  <span className="text-sm text-text-light dark:text-text-dark">
                    Auto-refresh (30s)
                  </span>
                </label>
                
                {/* Last update */}
                {lastUpdate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </>
            )}
            
            {/* Refresh button */}
            <button
              onClick={handleRefreshData}
              disabled={loading || loadingGeneral}
              className="p-2 flex items-center justify-center rounded-md bg-primary text-white dark:bg-primary-dark dark:text-white hover:bg-primary-dark hover:shadow-md dark:hover:bg-primary transition-all duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50"
            >
              {(loading || loadingGeneral) ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
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
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('vendas')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'vendas'
                ? 'bg-primary text-white dark:bg-primary-dark shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Dados de Vendas
          </button>
          <button
            onClick={() => setActiveTab('dados_gerais')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'dados_gerais'
                ? 'bg-primary text-white dark:bg-primary-dark shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Dados Gerais da Planilha
          </button>
        </div>

        {/* Conteúdo da aba de vendas */}
        {activeTab === 'vendas' && (
          <>
            {/* Loading de tela inteira para vendas quando carregando pela primeira vez */}
            {loading && !data ? (
              <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-40 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-6 text-xl font-semibold text-text-light dark:text-text-dark">
                    Carregando dados de vendas TMB...
                  </p>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                    Conectando com TMB API e carregando vendas dos últimos meses. 
                    Primeira carga pode levar até 2 minutos.
                  </p>
                  <div className="mt-4 flex items-center text-xs text-gray-400 dark:text-gray-500">
                    <div className="animate-pulse w-2 h-2 bg-primary rounded-full mr-2"></div>
                    Processando dados de 19 produtos...
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* Filter Type Selection */}
            <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => handleFilterTypeChange('hoje')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              filterType === 'hoje'
                ? 'bg-primary text-white dark:bg-primary-dark'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Hoje ({new Date().toLocaleDateString('pt-BR')})
          </button>
          <button
            onClick={() => handleFilterTypeChange('ultimo_mes')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              filterType === 'ultimo_mes'
                ? 'bg-primary text-white dark:bg-primary-dark'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Último Mês
          </button>
          <button
            onClick={() => handleFilterTypeChange('vendas_por_mes')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              filterType === 'vendas_por_mes'
                ? 'bg-primary text-white dark:bg-primary-dark'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Vendas por Mês
          </button>
          <button
            onClick={() => handleFilterTypeChange('periodo')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              filterType === 'periodo'
                ? 'bg-primary text-white dark:bg-primary-dark'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Período Específico
          </button>
        </div>

        {/* Month Selector - Only show when "Vendas por Mês" is selected */}
        {filterType === 'vendas_por_mes' && (
          <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                Selecionar Mês
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="w-full md:w-auto flex items-end">
              <button
                onClick={handleRefreshData}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors duration-200"
              >
                Buscar Vendas
              </button>
            </div>
          </div>
        )}

        {/* Date Range Filters - Only show when period is selected */}
        {filterType === 'periodo' && (
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
        )}

        {/* Info message for today with no sales */}
        {filterType === 'hoje' && data?.totals?.total_value === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-yellow-800 dark:text-yellow-200">
                Não há vendas registradas para hoje. Use "Último Mês" para ver dados com vendas.
              </p>
            </div>
          </div>
        )}

        {/* Main summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Total Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(data?.totals?.total_value || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total: {data?.totals?.total_quantity || 0} venda(s)
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas Guru
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(data?.totals?.guru_value || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.totals?.guru_quantity || 0} venda(s)
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Vendas TMB
            </h3>
            <p className="mt-2 text-3xl font-bold text-yellow-500 dark:text-yellow-400">
              {formatCurrency(data?.totals?.tmb_value || 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.totals?.tmb_quantity || 0} venda(s)
            </p>
          </div>
        </div>

        {/* Main chart - Sales by day */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Dia
          </h3>
          <div className="h-96 relative">
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
                      name === 'Total' ||
                      name === 'Guru' ||
                      name === 'TMB'
                    )
                      return formatCurrency(value)
                    return `${value} vendas`
                  }}
                  labelFormatter={formatDate}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="total_value"
                  name="Total"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  yAxisId="left"
                  dataKey="guru_value"
                  name="Guru"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  yAxisId="left"
                  dataKey="tmb_value"
                  name="TMB"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  yAxisId="right"
                  dataKey="total_quantity"
                  name="Quantidade Total"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comparison chart - Guru vs TMB */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Comparativo: Guru vs TMB
          </h3>
          <div className="h-96 relative">
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
                  dataKey="guru_value"
                  name="Vendas Guru"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  dataKey="tmb_value"
                  name="Vendas TMB"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
              </>
            )}
          </>
        )}

        {/* Conteúdo da aba de dados gerais */}
        {activeTab === 'dados_gerais' && (
          <>
            {loadingGeneral && !generalData ? (
              <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-40 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-6 text-xl font-semibold text-text-light dark:text-text-dark">
                    Carregando dados da API TMB...
                  </p>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                    Conectando com TMB API e processando dados de 19 produtos. 
                    Isso pode levar até 2 minutos na primeira carga.
                  </p>
                  <div className="mt-4 flex items-center text-xs text-gray-400 dark:text-gray-500">
                    <div className="animate-pulse w-2 h-2 bg-primary rounded-full mr-2"></div>
                    Processando vendas e métricas...
                  </div>
                </div>
              </div>
            ) : generalData ? (
              <>
                {/* Preparar dados para gráficos */}
                {(() => {
                  // Filtrar apenas dados até hoje
                  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
                  const currentData = generalData.data?.filter(record => record.date <= today) || []

                  const leadsData = currentData.map(record => ({
                    date: record.date,
                    name: formatDate(record.date),
                    leads_formulario: record.leads_formulrio || 0,
                    leads_devclub: record.leads_devclub || 0,
                    leads_totais: record.leads_recebidos_totais || 0,
                  }))

                  const salesFunnelData = currentData.map(record => ({
                    date: record.date,
                    name: formatDate(record.date),
                    leads: record.leads_recebidos_totais || 0,
                    ligacoes: record.ligaes_realizadas_totais || 0,
                    atendimentos: record.ligaes_atendidadas_totais || 0,
                    qualificacoes: record.qualificaes_totais || 0,
                    reunioes_agendadas: record.reunies_agendadas_totais || 0,
                    reunioes_realizadas: record.reunies_realizadas_ || 0,
                    vendas: record.vendas_realizadas || 0,
                  }))

                  const revenueData = currentData.map(record => ({
                    date: record.date,
                    name: formatDate(record.date),
                    valor_vendas: record.valor_vendas_realizadas || 0,
                    ticket_medio: record.ticket_mdio_total || 0,
                    vendas_guru: record.venda_guru_carto || 0,
                    vendas_tmb: record.venda_tmbboleto || 0,
                  }))

                  const conversionData = currentData.map(record => ({
                    date: record.date,
                    name: formatDate(record.date),
                    taxa_atendimento: record._ligao_x_atendida || 0,
                    leads_qualificacao: record._leads_x_qualificao_total || 0,
                    leads_agendamento: record._leads_x_agendamento_total || 0,
                    reunioes_vendas: record._reunies_realizadas_x_vendas_realizadas || 0,
                  }))

                  // Recalcular totais apenas com dados até hoje
                  const todaySummary = {
                    totalLeads: currentData.reduce((sum, record) => sum + (record.leads_recebidos_totais || 0), 0),
                    totalCalls: currentData.reduce((sum, record) => sum + (record.ligaes_realizadas_totais || 0), 0),
                    totalSales: currentData.reduce((sum, record) => sum + (record.vendas_realizadas || 0), 0),
                    totalRevenue: currentData.reduce((sum, record) => sum + (record.valor_vendas_realizadas || 0), 0),
                    totalGuruSales: currentData.reduce((sum, record) => sum + (record.venda_guru_carto || 0), 0),
                    totalTmbSales: currentData.reduce((sum, record) => sum + (record.venda_tmbboleto || 0), 0),
                    averageTicket: currentData.reduce((sum, record) => sum + (record.ticket_mdio_total || 0), 0) / currentData.filter(r => r.ticket_mdio_total > 0).length || 0,
                    conversionRates: {
                      callAnswerRate: currentData.reduce((sum, record) => sum + (record._ligao_x_atendida || 0), 0) / currentData.length || 0
                    }
                  }

                  // Dados para gráfico de pizza - distribuição de vendas
                  const salesDistribution = [
                    { name: 'GURU (Cartão)', value: todaySummary.totalGuruSales || 0, color: '#10B981' },
                    { name: 'TMB (Boleto)', value: todaySummary.totalTmbSales || 0, color: '#F59E0B' }
                  ]

                  return (
                    <>
                      {/* KPIs principais */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                            Total de Leads
                          </h3>
                          <p className="mt-2 text-3xl font-bold text-blue-500">
                            {todaySummary.totalLeads || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {currentData.length || 0} dias de dados
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                            Total de Ligações
                          </h3>
                          <p className="mt-2 text-3xl font-bold text-green-500">
                            {todaySummary.totalCalls || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Taxa média: {todaySummary.conversionRates?.callAnswerRate?.toFixed(1) || 0}%
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                            Total de Vendas
                          </h3>
                          <p className="mt-2 text-3xl font-bold text-purple-500">
                            {todaySummary.totalSales || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            GURU: {todaySummary.totalGuruSales || 0} | TMB: {todaySummary.totalTmbSales || 0}
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                            Faturamento Total
                          </h3>
                          <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
                            {formatCurrency(todaySummary.totalRevenue || 0)}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ticket médio: {formatCurrency(todaySummary.averageTicket || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Gráfico de Leads */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                          Leads Diários
                        </h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={leadsData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="leads_devclub"
                                stackId="1"
                                stroke="#0088FE"
                                fill="#0088FE"
                                name="Leads DevClub"
                              />
                              <Area
                                type="monotone"
                                dataKey="leads_formulario"
                                stackId="1"
                                stroke="#00C49F"
                                fill="#00C49F"
                                name="Leads Formulário"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráficos do Funil de Vendas divididos */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Leads e Ligações */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Leads e Ligações
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={salesFunnelData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="leads"
                                  stroke="#8884d8"
                                  name="Leads"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="ligacoes"
                                  stroke="#82ca9d"
                                  name="Ligações"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="atendimentos"
                                  stroke="#00C49F"
                                  name="Atendimentos"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Qualificações e Reuniões */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Qualificações e Reuniões
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={salesFunnelData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="qualificacoes"
                                  stroke="#ffc658"
                                  name="Qualificações"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="reunioes_agendadas"
                                  stroke="#ff7300"
                                  name="Reuniões Agendadas"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="reunioes_realizadas"
                                  stroke="#e67e22"
                                  name="Reuniões Realizadas"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Gráfico final de vendas */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                          Vendas Realizadas
                        </h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesFunnelData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar
                                dataKey="vendas"
                                name="Vendas"
                                fill="#e74c3c"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráficos lado a lado */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Distribuição de Vendas */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Distribuição de Vendas
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={salesDistribution}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({name, value, percent}) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {salesDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Faturamento Diário */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Faturamento Diário
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Bar
                                  dataKey="valor_vendas"
                                  name="Faturamento"
                                  fill="#2563EB"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Taxas de Conversão divididas */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Taxa de Atendimento */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Taxa de Atendimento (%)
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={conversionData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="taxa_atendimento"
                                  stroke="#8884d8"
                                  strokeWidth={2}
                                  name="Taxa Atendimento"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Conversão de Leads */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                            Conversão de Leads (%)
                          </h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={conversionData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="leads_qualificacao"
                                  stroke="#82ca9d"
                                  name="Leads → Qualificação"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="leads_agendamento"
                                  stroke="#ffc658"
                                  name="Leads → Agendamento"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Taxa de Conversão Final */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                          Taxa de Conversão Final: Reuniões → Vendas (%)
                        </h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={conversionData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                              <Legend />
                              <Bar
                                dataKey="reunioes_vendas"
                                name="Reuniões → Vendas"
                                fill="#ff7300"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Tabela de dados detalhados */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                          Dados Detalhados dos Últimos 10 Dias (até hoje)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Leads</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ligações</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qualificações</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reuniões</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vendas</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Faturamento</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {(() => {
                                // Filtrar apenas dados até hoje e pegar os últimos 10
                                const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
                                const filteredData = generalData.data?.filter(record => record.date <= today) || []
                                return filteredData.slice(-10).reverse()
                              })().map((record, index) => (
                                <tr key={record.date} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {formatDate(record.date)}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-blue-600 dark:text-blue-400">
                                    {record.leads_recebidos_totais || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-green-600 dark:text-green-400">
                                    {record.ligaes_realizadas_totais || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-yellow-600 dark:text-yellow-400">
                                    {record.qualificaes_totais || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-purple-600 dark:text-purple-400">
                                    {record.reunies_realizadas_ || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-red-600 dark:text-red-400">
                                    {record.vendas_realizadas || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(record.valor_vendas_realizadas || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </>
            ) : (
              <div className="text-center py-20">
                <p className="text-text-light dark:text-text-dark">
                  Erro ao carregar dados gerais. Tente atualizar a página.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TSDashboard