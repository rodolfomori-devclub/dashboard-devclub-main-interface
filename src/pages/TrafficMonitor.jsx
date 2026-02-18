import React, { useState, useEffect } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  FaChartLine,
  FaDollarSign,
  FaEye,
  FaMousePointer,
  FaUsers,
  FaPercent,
  FaBullseye,
  FaSync,
  FaPause,
  FaPlay,
  FaClock,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendar,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
} from 'react-icons/fa'
import trafficSheetsService from '../services/trafficSheetsService'

// Helpers de formatação
const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(val)

const formatPercent = (val) => `${parseFloat(val).toFixed(2)}%`

const formatNumber = (val) =>
  typeof val === 'number' ? val.toLocaleString('pt-BR') : val

// Tooltip customizado para os gráficos
const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg p-4 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-2xl min-w-[220px]">
      <p className="font-bold text-text-light dark:text-text-dark text-base border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-1">
          <span className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-text-muted-light dark:text-text-muted-dark">
              {entry.name}
            </span>
          </span>
          <span className="font-semibold text-sm text-text-light dark:text-text-dark">
            {['Investimento', 'CPC', 'CPL', 'CPM'].includes(entry.name)
              ? formatCurrency(entry.value)
              : ['CTR', 'Conversão'].includes(entry.name)
                ? formatPercent(entry.value)
                : formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// Card de métrica reutilizável
const MetricCard = ({ icon: Icon, title, value, subtitle, gradientFrom, gradientTo, iconGradientFrom, iconGradientTo, delay = '0s' }) => (
  <div className="group relative animate-slide-up" style={{ animationDelay: delay }}>
    <div
      className="absolute inset-0 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300 opacity-60"
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}33, ${gradientTo}33)`,
      }}
    />
    <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${iconGradientFrom}, ${iconGradientTo})`,
          }}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: iconGradientFrom }} />
      </div>
      <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark mb-2">
        {title}
      </h3>
      <p className="text-3xl font-bold bg-clip-text text-transparent mb-1" style={{
        backgroundImage: `linear-gradient(135deg, ${iconGradientFrom}, ${iconGradientTo})`,
      }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-text-muted-light dark:text-text-muted-dark flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: iconGradientFrom }} />
          {subtitle}
        </p>
      )}
    </div>
  </div>
)

const TrafficMonitor = () => {
  const [trafficData, setTrafficData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(60000)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [updateIntervalId, setUpdateIntervalId] = useState(null)

  // Estados para filtros de período
  const [selectedPeriod, setSelectedPeriod] = useState('last7days')
  const [customDateRange, setCustomDateRange] = useState({
    start: null,
    end: null,
  })
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Busca inicial de dados
  useEffect(() => {
    loadData()
  }, [])

  // Aplica filtro quando período muda
  useEffect(() => {
    if (trafficData.length > 0) {
      applyPeriodFilter()
    }
  }, [selectedPeriod, customDateRange, trafficData])

  // Configura auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const intervalId = trafficSheetsService.startRealTimeUpdates(
        handleDataUpdate,
        refreshInterval
      )
      setUpdateIntervalId(intervalId)

      return () => {
        trafficSheetsService.stopRealTimeUpdates(intervalId)
      }
    } else {
      if (updateIntervalId) {
        trafficSheetsService.stopRealTimeUpdates(updateIntervalId)
        setUpdateIntervalId(null)
      }
    }
  }, [autoRefresh, refreshInterval])

  // Aplica filtro de período nos dados
  const applyPeriodFilter = () => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    let startDate = new Date()
    let filtered = [...trafficData]

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        break
      case 'last7days':
        startDate = new Date()
        startDate.setDate(today.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'last30days':
        startDate = new Date()
        startDate.setDate(today.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start)
          const endDate = new Date(customDateRange.end)
          filtered = trafficData.filter((row) => {
            if (!row.DATA) return false
            const [day, month, year] = row.DATA.split('/')
            const rowDate = new Date(year || today.getFullYear(), month - 1, day)
            return rowDate >= startDate && rowDate <= endDate
          })
          setFilteredData(filtered)
          const newMetrics = trafficSheetsService.calculateMetrics(filtered)
          setMetrics(newMetrics)
          return
        }
        break
      default:
        startDate = new Date()
        startDate.setDate(today.getDate() - 7)
    }

    filtered = trafficData.filter((row) => {
      if (!row.DATA) return false
      const [day, month, year] = row.DATA.split('/')
      const rowDate = new Date(year || today.getFullYear(), month - 1, day)
      return rowDate >= startDate && rowDate <= today
    })

    setFilteredData(filtered)
    const newMetrics = trafficSheetsService.calculateMetrics(filtered)
    setMetrics(newMetrics)
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await trafficSheetsService.fetchTrafficData()
      setTrafficData(data)
      setLastUpdate(new Date())
    } catch (err) {
      setError('Erro ao carregar dados da planilha. Verifique a conexão.')
    } finally {
      setLoading(false)
    }
  }

  const handleDataUpdate = ({ data, metrics: m, error: err }) => {
    if (err) {
      setError('Erro na atualização automática')
      return
    }
    setTrafficData(data || [])
    setLastUpdate(new Date())
  }

  const handlePeriodChange = (period) => {
    if (period === 'custom') {
      setDatePickerOpen(true)
    } else {
      setSelectedPeriod(period)
    }
  }

  const handleCustomDateConfirm = () => {
    if (customDateRange.start && customDateRange.end) {
      setSelectedPeriod('custom')
      setDatePickerOpen(false)
    }
  }

  const handleManualRefresh = () => {
    loadData()
  }

  const handleIntervalChange = (value) => {
    setRefreshInterval(value)
  }

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today':
        return 'Hoje'
      case 'last7days':
        return 'Últimos 7 dias'
      case 'last30days':
        return 'Últimos 30 dias'
      case 'custom':
        return `${customDateRange.start?.toLocaleDateString('pt-BR')} - ${customDateRange.end?.toLocaleDateString('pt-BR')}`
      default:
        return ''
    }
  }

  // Preparar dados para os gráficos
  const chartData = filteredData
    .map((row) => {
      const [day, month] = (row.DATA || '').split('/')
      const impressoes = row['Nº IMPRESSÕES'] || 0
      const cliques = row['Nº CLIQUES'] || 0
      const pageviews = row['Nº PAGEVIEW'] || 0
      const leads = row['Nº LEADS'] || 0
      return {
        date: `${day}/${month}`,
        fullDate: row.DATA,
        investimento: row.INVESTIMENTO || 0,
        impressoes,
        cliques,
        pageviews,
        leads,
        cpl: row['(CPL)'] || 0,
        ctr: impressoes > 0 ? parseFloat(((cliques / impressoes) * 100).toFixed(2)) : 0,
        conversao: pageviews > 0 ? parseFloat(((leads / pageviews) * 100).toFixed(2)) : 0,
      }
    })
    .sort((a, b) => {
      const [dA, mA, yA] = (a.fullDate || '').split('/')
      const [dB, mB, yB] = (b.fullDate || '').split('/')
      const dateA = new Date(yA || 2024, (mA || 1) - 1, dA || 1)
      const dateB = new Date(yB || 2024, (mB || 1) - 1, dB || 1)
      return dateA - dateB
    })

  const totals = metrics?.totals || {}
  const averages = metrics?.averages || {}

  // Loading state
  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto flex items-start justify-center pt-32">
          <div className="flex flex-col items-center animate-fade-in">
            <div className="relative">
              <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary/20" />
              <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary border-t-transparent absolute top-0 left-0" />
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
            </div>
            <p className="mt-6 text-xl text-text-light dark:text-text-dark font-medium animate-pulse">
              Carregando dados de tráfego...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto relative">
        {/* Loading bar sutil durante atualizações */}
        {loading && metrics && (
          <div className="fixed top-0 left-0 right-0 h-1 z-[9999] bg-primary/20">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        {/* ===== HEADER ===== */}
        <div className="mb-10 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 dark:from-primary/20 dark:via-blue-500/10 dark:to-purple-500/20 rounded-3xl blur-xl" />
          <div className="relative bg-white/70 dark:bg-secondary/70 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent mb-2">
                  Monitor de Tráfego
                </h1>
                <p className="text-text-muted-light dark:text-text-muted-dark text-lg">
                  Acompanhe as métricas de performance em tempo real
                </p>
              </div>

              <div className="flex items-center gap-3">
                {lastUpdate && (
                  <span className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-sm text-text-muted-light dark:text-text-muted-dark border border-white/20 dark:border-gray-700/50">
                    <FaClock className="w-3.5 h-3.5" />
                    {lastUpdate.toLocaleTimeString('pt-BR')}
                  </span>
                )}

                <button
                  onClick={toggleAutoRefresh}
                  className={`p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
                    autoRefresh
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 text-primary'
                      : 'bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700/50 text-text-muted-light dark:text-text-muted-dark'
                  }`}
                  title={autoRefresh ? 'Pausar atualização' : 'Iniciar atualização'}
                >
                  {autoRefresh ? <FaPause className="w-4 h-4" /> : <FaPlay className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleManualRefresh}
                  className="p-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 transform hover:scale-105"
                  title="Atualizar agora"
                >
                  <FaSync className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filtros de período */}
            <div className="mt-6 pt-6 border-t border-white/10 dark:border-gray-700/30">
              <div className="flex flex-wrap gap-3">
                {/* Botão HOJE - proeminente */}
                <button
                  onClick={() => handlePeriodChange('today')}
                  className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 ${
                    selectedPeriod === 'today'
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                      : 'bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary/30 hover:bg-primary/20 dark:hover:bg-primary/30'
                  }`}
                >
                  <FaCalendarDay className="w-4 h-4" />
                  HOJE
                </button>

                {/* 7 dias */}
                <button
                  onClick={() => handlePeriodChange('last7days')}
                  className={`px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    selectedPeriod === 'last7days'
                      ? 'bg-white dark:bg-gray-700 text-text-light dark:text-text-dark shadow-lg border border-primary/30'
                      : 'bg-white/50 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                >
                  <FaCalendarWeek className="w-3.5 h-3.5" />
                  7 dias
                </button>

                {/* 30 dias */}
                <button
                  onClick={() => handlePeriodChange('last30days')}
                  className={`px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    selectedPeriod === 'last30days'
                      ? 'bg-white dark:bg-gray-700 text-text-light dark:text-text-dark shadow-lg border border-primary/30'
                      : 'bg-white/50 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                >
                  <FaCalendar className="w-3.5 h-3.5" />
                  30 dias
                </button>

                {/* Personalizado */}
                <button
                  onClick={() => handlePeriodChange('custom')}
                  className={`px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    selectedPeriod === 'custom'
                      ? 'bg-white dark:bg-gray-700 text-text-light dark:text-text-dark shadow-lg border border-primary/30'
                      : 'bg-white/50 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                >
                  <FaCalendarAlt className="w-3.5 h-3.5" />
                  Personalizado
                </button>
              </div>

              {/* Auto-refresh indicator + interval selector */}
              {autoRefresh && (
                <div className="mt-4 flex items-center gap-4 text-sm text-text-muted-light dark:text-text-muted-dark">
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                    </span>
                    Auto-refresh ativo
                  </span>
                  <div className="flex gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1">
                    {[
                      { label: '30s', value: 30000 },
                      { label: '1m', value: 60000 },
                      { label: '5m', value: 300000 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleIntervalChange(opt.value)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                          refreshInterval === opt.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            {error}
          </div>
        )}

        {/* ===== INDICADORES PRINCIPAIS (4 cards) ===== */}
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <FaChartLine className="text-primary" />
          Indicadores Principais
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          <MetricCard
            icon={FaDollarSign}
            title="Investimento Total"
            value={formatCurrency(totals.investimento || 0)}
            subtitle={getPeriodLabel()}
            gradientFrom="#37E359"
            gradientTo="#10B981"
            iconGradientFrom="#37E359"
            iconGradientTo="#2BC348"
            delay="0s"
          />
          <MetricCard
            icon={FaEye}
            title="Impressões"
            value={formatNumber(totals.impressoes || 0)}
            subtitle={getPeriodLabel()}
            gradientFrom="#3B82F6"
            gradientTo="#06B6D4"
            iconGradientFrom="#3B82F6"
            iconGradientTo="#2563EB"
            delay="0.1s"
          />
          <MetricCard
            icon={FaMousePointer}
            title="Cliques"
            value={formatNumber(totals.cliques || 0)}
            subtitle={getPeriodLabel()}
            gradientFrom="#8B5CF6"
            gradientTo="#6366F1"
            iconGradientFrom="#8B5CF6"
            iconGradientTo="#7C3AED"
            delay="0.2s"
          />
          <MetricCard
            icon={FaUsers}
            title="Leads Gerados"
            value={formatNumber(totals.leads || 0)}
            subtitle={getPeriodLabel()}
            gradientFrom="#F59E0B"
            gradientTo="#F97316"
            iconGradientFrom="#F59E0B"
            iconGradientTo="#D97706"
            delay="0.3s"
          />
          <MetricCard
            icon={FaDollarSign}
            title="CPM"
            value={formatCurrency(averages.cpm || 0)}
            subtitle="Custo por Mil"
            gradientFrom="#EF4444"
            gradientTo="#F87171"
            iconGradientFrom="#EF4444"
            iconGradientTo="#DC2626"
            delay="0.4s"
          />
        </div>

        {/* ===== PERFORMANCE & CONVERSÃO (4 cards) ===== */}
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <FaBullseye className="text-blue-500" />
          Performance e Conversão
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <MetricCard
            icon={FaPercent}
            title="CTR Médio"
            value={formatPercent(averages.ctr || 0)}
            subtitle="Click-Through Rate"
            gradientFrom="#8B5CF6"
            gradientTo="#A78BFA"
            iconGradientFrom="#8B5CF6"
            iconGradientTo="#7C3AED"
            delay="0.1s"
          />
          <MetricCard
            icon={FaDollarSign}
            title="CPC Médio"
            value={formatCurrency(averages.cpc || 0)}
            subtitle="Custo por Clique"
            gradientFrom="#10B981"
            gradientTo="#34D399"
            iconGradientFrom="#10B981"
            iconGradientTo="#059669"
            delay="0.2s"
          />
          <MetricCard
            icon={FaUsers}
            title="CPL Médio"
            value={formatCurrency(averages.cpl || 0)}
            subtitle="Custo por Lead"
            gradientFrom="#F59E0B"
            gradientTo="#FBBF24"
            iconGradientFrom="#F59E0B"
            iconGradientTo="#D97706"
            delay="0.3s"
          />
          <MetricCard
            icon={FaBullseye}
            title="Conversão Página"
            value={formatPercent(averages.conversaoPagina || 0)}
            subtitle="Lead / Pageview"
            gradientFrom="#3B82F6"
            gradientTo="#60A5FA"
            iconGradientFrom="#3B82F6"
            iconGradientTo="#2563EB"
            delay="0.4s"
          />
        </div>

        {/* ===== GRÁFICO PRINCIPAL - MÉTRICAS DIÁRIAS ===== */}
        <div className="group relative animate-slide-up mb-10">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-amber-500/10 dark:from-primary/15 dark:via-blue-500/10 dark:to-amber-500/15 rounded-3xl blur-xl" />
          <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
              <div>
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark flex items-center gap-3">
                  <FaChartLine className="text-primary" />
                  Métricas Diárias
                </h2>
                <p className="text-text-muted-light dark:text-text-muted-dark mt-1 text-sm">
                  {getPeriodLabel()} — Investimento, Leads, CPL, CTR e Conversão por dia
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {chartData.length} {chartData.length === 1 ? 'dia' : 'dias'}
              </span>
            </div>

            {chartData.length > 0 ? (
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 70, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#94A3B8' }}
                      stroke="#CBD5E1"
                      tickLine={false}
                    />
                    {/* Eixo esquerdo: Investimento + CPL (R$) */}
                    <YAxis
                      yAxisId="currency"
                      orientation="left"
                      tick={{ fontSize: 11, fill: '#37E359' }}
                      stroke="#37E359"
                      strokeOpacity={0.3}
                      tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                      tickLine={false}
                    />
                    {/* Eixo direito: Leads (quantidade) */}
                    <YAxis
                      yAxisId="count"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#F59E0B' }}
                      stroke="#F59E0B"
                      strokeOpacity={0.3}
                      tickLine={false}
                    />
                    {/* Eixo direito 2: CTR e Conversão (%) */}
                    <YAxis
                      yAxisId="percent"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#8B5CF6' }}
                      stroke="#8B5CF6"
                      strokeOpacity={0.3}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      dx={40}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar
                      yAxisId="currency"
                      dataKey="investimento"
                      name="Investimento"
                      fill="#37E359"
                      fillOpacity={0.85}
                      radius={[6, 6, 0, 0]}
                      barSize={chartData.length > 14 ? 18 : chartData.length > 7 ? 28 : 40}
                    />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#F59E0B"
                      strokeWidth={2.5}
                      dot={{ fill: '#F59E0B', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      yAxisId="currency"
                      type="monotone"
                      dataKey="cpl"
                      name="CPL"
                      stroke="#EF4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#EF4444', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="ctr"
                      name="CTR"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      dot={{ fill: '#8B5CF6', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="conversao"
                      name="Conversão"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: '#10B981', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
                <div className="text-center">
                  <FaChartLine className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Sem dados para o período selecionado</p>
                  <p className="text-sm mt-1">Tente selecionar outro período</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== RESUMO DO PERÍODO ===== */}
        <div className="group relative animate-slide-up mb-10">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-500/10 via-gray-500/5 to-zinc-500/10 dark:from-slate-500/15 dark:via-gray-500/10 dark:to-zinc-500/15 rounded-3xl blur-xl" />
          <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <FaCalendar className="text-primary text-xl" />
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
                Resumo do Período
              </h2>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {getPeriodLabel()}
              </span>
            </div>

            <div className="border-t border-white/10 dark:border-gray-700/30 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna esquerda */}
                <div>
                  <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-4">
                    Dados do Período
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">Total de dias analisados</span>
                      <span className="font-bold text-text-light dark:text-text-dark text-lg">{metrics?.dataCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">ROI estimado</span>
                      <span className="font-bold text-primary text-lg">
                        {totals.leads > 0 ? ((totals.leads * 100 / (totals.investimento || 1))).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">Custo por mil (CPM)</span>
                      <span className="font-bold text-text-light dark:text-text-dark text-lg">
                        {formatCurrency(averages.cpm || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coluna direita */}
                <div>
                  <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-4">
                    Estatísticas de Engajamento
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">Taxa de carregamento</span>
                      <span className="font-bold text-text-light dark:text-text-dark text-lg">
                        {formatPercent(averages.carregamentoPagina || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">Média de pageviews/dia</span>
                      <span className="font-bold text-text-light dark:text-text-dark text-lg">
                        {formatNumber(Math.round((totals.pageviews || 0) / (metrics?.dataCount || 1)))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-text-muted-light dark:text-text-muted-dark text-sm">Eficiência do investimento</span>
                      <span className="font-bold text-primary text-lg">
                        {totals.cliques > 0 ? ((totals.leads / totals.cliques * 100)).toFixed(1) : '0'}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== MODAL DE PERÍODO PERSONALIZADO ===== */}
        {datePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDatePickerOpen(false)}
            />
            <div className="relative bg-white dark:bg-secondary rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full animate-slide-up">
              <h3 className="text-xl font-bold text-text-light dark:text-text-dark mb-6">
                Selecionar Período
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={
                      customDateRange.start
                        ? customDateRange.start.toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        start: e.target.value ? new Date(e.target.value + 'T12:00:00') : null,
                      })
                    }
                    className="w-full px-4 py-3 border border-primary/20 rounded-xl text-text-light dark:text-text-dark bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={
                      customDateRange.end
                        ? customDateRange.end.toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        end: e.target.value ? new Date(e.target.value + 'T12:00:00') : null,
                      })
                    }
                    min={
                      customDateRange.start
                        ? customDateRange.start.toISOString().split('T')[0]
                        : ''
                    }
                    className="w-full px-4 py-3 border border-primary/20 rounded-xl text-text-light dark:text-text-dark bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setDatePickerOpen(false)}
                  className="px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCustomDateConfirm}
                  disabled={!customDateRange.start || !customDateRange.end}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrafficMonitor
