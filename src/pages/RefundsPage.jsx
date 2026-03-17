import React, { useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FaUndo, FaChartPie, FaTable, FaFilter, FaSync, FaChartLine,
  FaCalendarAlt, FaSearch, FaChevronDown, FaChevronUp, FaSortUp, FaSortDown,
  FaChevronLeft, FaChevronRight, FaExchangeAlt, FaTimes,
} from 'react-icons/fa'
import DateRangePicker from '../components/DateRangePicker'
import { refundsService } from '../services/refundsService'

const CHART_COLORS = ['#22c55e', '#7c3aed', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#f97316']

const STATUS_STYLES = {
  'Reembolso realizado': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Revertido': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'dar prosseguimento Reembolso': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Sem retorno do lead': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  'Reembolso solicitado': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Em contato com lead': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function parseDateBR(str) {
  if (!str) return null
  if (str.includes('T')) return new Date(str)
  const parts = str.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number)
    if (d && m && y) return new Date(y, m - 1, d)
  }
  return null
}

function formatDateBR(date) {
  if (!date) return '-'
  if (typeof date === 'string') date = parseDateBR(date)
  if (!date || isNaN(date)) return '-'
  return date.toLocaleDateString('pt-BR')
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null
  const a = parseDateBR(d1)
  const b = parseDateBR(d2)
  if (!a || !b) return null
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

const tooltipStyle = { backgroundColor: '#141419', border: '1px solid #27272a', borderRadius: '12px', color: '#fafafa', fontSize: '12px' }

export default function RefundsPage() {
  const [allData, setAllData] = useState([])
  const [deduplication, setDeduplication] = useState(null)
  const [rawCounts, setRawCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Filters
  const [filterProduto, setFilterProduto] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterClassificacao, setFilterClassificacao] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilterType, setDateFilterType] = useState('solicitacao')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sales crossref
  const [salesData, setSalesData] = useState(null)
  const [loadingSales, setLoadingSales] = useState(false)

  // Table
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'desc' })
  const [expandedRow, setExpandedRow] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await refundsService.getAll()
      if (result.success) {
        setAllData(result.data || [])
        setDeduplication(result.deduplication || null)
        setRawCounts(result.raw || null)
      }
    } catch (error) {
      toast.error('Erro ao carregar dados de reembolsos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchSalesData = useCallback(async () => {
    if (salesData || loadingSales) return
    setLoadingSales(true)
    try {
      const meses = ['2026-01', '2026-02', '2026-03']
      const result = await refundsService.getVendasMensais(meses)
      if (result.success) setSalesData(result.data)
    } catch (error) {
      toast.error('Erro ao carregar dados de vendas.')
    } finally {
      setLoadingSales(false)
    }
  }, [salesData, loadingSales])

  const hasActiveFilters = filterProduto !== 'all' || filterStatus !== 'all' || filterSource !== 'all' || filterClassificacao !== 'all' || searchTerm || startDate

  const clearFilters = () => {
    setFilterProduto('all'); setFilterStatus('all'); setFilterSource('all')
    setFilterClassificacao('all'); setSearchTerm(''); setStartDate(''); setEndDate(''); setCurrentPage(1)
  }

  // Filter logic
  const filteredData = useMemo(() => {
    return allData.filter(r => {
      if (filterProduto !== 'all' && r.produto !== filterProduto) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterSource !== 'all' && r.source !== filterSource) return false
      if (filterClassificacao !== 'all' && r.classificacaoMotivo !== filterClassificacao) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const match = (r.nome || '').toLowerCase().includes(term) ||
          (r.email || '').toLowerCase().includes(term) ||
          (r.contato || '').toLowerCase().includes(term) ||
          (r.whatsapp || '').toLowerCase().includes(term)
        if (!match) return false
      }
      if (startDate && endDate) {
        let dateField
        if (dateFilterType === 'solicitacao') dateField = r.dataSolicitacao || r.submittedAt
        else if (dateFilterType === 'compra') dateField = r.dataCompra
        else if (dateFilterType === 'reembolso') dateField = r.dataReembolso
        const d = parseDateBR(dateField)
        if (d) {
          const s = new Date(startDate + 'T00:00:00')
          const e = new Date(endDate + 'T23:59:59')
          if (d < s || d > e) return false
        } else {
          return false
        }
      }
      return true
    })
  }, [allData, filterProduto, filterStatus, filterSource, filterClassificacao, searchTerm, startDate, endDate, dateFilterType])

  const uniqueValues = useMemo(() => ({
    produtos: [...new Set(allData.map(r => r.produto).filter(Boolean))].sort(),
    statuses: [...new Set(allData.map(r => r.status).filter(Boolean))].sort(),
    classificacoes: [...new Set(allData.map(r => r.classificacaoMotivo).filter(Boolean))].sort(),
  }), [allData])

  // Stats
  const stats = useMemo(() => {
    const total = filteredData.length
    const realizados = filteredData.filter(r => r.status === 'Reembolso realizado').length
    const revertidos = filteredData.filter(r => r.status === 'Revertido').length
    const pendentes = filteredData.filter(r => !r.status || ['dar prosseguimento Reembolso', 'Reembolso solicitado', 'Em contato com lead'].includes(r.status)).length
    const semRetorno = filteredData.filter(r => r.status === 'Sem retorno do lead').length
    const resolutionDays = filteredData.map(r => daysBetween(r.dataSolicitacao, r.dataReembolso)).filter(d => d !== null && d >= 0)
    const avgResolution = resolutionDays.length > 0 ? Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) : null
    const taxaRetencao = total > 0 ? ((revertidos / total) * 100).toFixed(1) : '0'
    return { total, realizados, revertidos, pendentes, semRetorno, avgResolution, taxaRetencao }
  }, [filteredData])

  // Chart data
  const produtoData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { const k = r.produto || 'Nao informado'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredData])

  const statusData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { const k = r.status || 'Sem status'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredData])

  const pagamentoData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { const k = r.formaPagamento || 'Nao informado'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredData])

  const classificacaoData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { if (r.classificacaoMotivo) map[r.classificacaoMotivo] = (map[r.classificacaoMotivo] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredData])

  const motivoData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { if (!r.motivo) return; const short = r.motivo.length > 50 ? r.motivo.substring(0, 47) + '...' : r.motivo; map[short] = (map[short] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredData])

  const timelineData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => { const d = parseDateBR(r.dataSolicitacao || r.submittedAt); if (!d) return; const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; map[key] = (map[key] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => { const [ma, ya] = a.name.split('/'); const [mb, yb] = b.name.split('/'); return (ya + ma).localeCompare(yb + mb) })
  }, [filteredData])

  const monthlyComparisonData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => {
      const mes = r.mesReferencia || 'Typeform'
      if (!map[mes]) map[mes] = { mes, total: 0, realizados: 0, revertidos: 0, pendentes: 0 }
      map[mes].total++
      if (r.status === 'Reembolso realizado') map[mes].realizados++
      if (r.status === 'Revertido') map[mes].revertidos++
      if (!r.status || ['dar prosseguimento Reembolso', 'Reembolso solicitado', 'Em contato com lead'].includes(r.status)) map[mes].pendentes++
    })
    return Object.values(map)
  }, [filteredData])

  const produtoStatusData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => {
      const prod = r.produto || 'Nao informado'
      if (!map[prod]) map[prod] = { name: prod, realizados: 0, revertidos: 0, outros: 0 }
      if (r.status === 'Reembolso realizado') map[prod].realizados++
      else if (r.status === 'Revertido') map[prod].revertidos++
      else map[prod].outros++
    })
    return Object.values(map).sort((a, b) => (b.realizados + b.revertidos + b.outros) - (a.realizados + a.revertidos + a.outros))
  }, [filteredData])

  // Table sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData
    return [...filteredData].sort((a, b) => {
      const va = (a[sortConfig.key] || '').toString().toLowerCase()
      const vb = (b[sortConfig.key] || '').toString().toLowerCase()
      return sortConfig.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [filteredData, sortConfig])

  const paginatedData = useMemo(() => sortedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedData, currentPage])
  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE)

  const handleSort = (key) => setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
  const handleDateChange = (s, e) => { setStartDate(s); setEndDate(e); setCurrentPage(1) }

  const setQuickDate = (type) => {
    const now = new Date()
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (type === 'all') { setStartDate(''); setEndDate(''); setCurrentPage(1); return }
    let s, e
    if (type === 'month') { s = new Date(now.getFullYear(), now.getMonth(), 1); e = now }
    else if (type === 'lastMonth') { s = new Date(now.getFullYear(), now.getMonth() - 1, 1); e = new Date(now.getFullYear(), now.getMonth(), 0) }
    else { s = new Date(now.getFullYear(), now.getMonth() - 2, 1); e = now }
    setStartDate(fmt(s)); setEndDate(fmt(e)); setCurrentPage(1)
  }

  const tabs = [
    { id: 'overview', label: 'Visao Geral', icon: FaChartPie },
    { id: 'analytics', label: 'Analises', icon: FaChartLine },
    { id: 'crossref', label: 'Vendas x Reembolsos', icon: FaExchangeAlt },
    { id: 'table', label: 'Detalhes', icon: FaTable },
    { id: 'monthly', label: 'Por Mes', icon: FaCalendarAlt },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Carregando dados de reembolsos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
            <FaUndo className="text-red-500" />
            Reembolsos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs sm:text-sm">
            {rawCounts && `Typeform: ${rawCounts.typeform} | Planilha: ${rawCounts.planilha}`}
            {deduplication && ` | Mesclados: ${deduplication.merged}`}
            {` | Total: ${allData.length}`}
          </p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center gap-2 text-sm font-medium transition-colors self-start sm:self-auto">
          <FaSync className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KPICard label="Total" value={stats.total} color="text-blue-500" icon="📋" />
        <KPICard label="Reembolsados" value={stats.realizados} sub={stats.total > 0 ? `${((stats.realizados / stats.total) * 100).toFixed(0)}%` : ''} color="text-red-500" icon="↩️" />
        <KPICard label="Revertidos" value={stats.revertidos} sub={`${stats.taxaRetencao}% retencao`} color="text-green-500" icon="✅" />
        <KPICard label="Pendentes" value={stats.pendentes} color="text-yellow-500" icon="⏳" />
        <KPICard label="Sem Retorno" value={stats.semRetorno} color="text-gray-500" icon="📵" />
        <KPICard label="Tempo Medio" value={stats.avgResolution !== null ? `${stats.avgResolution}d` : '-'} sub="dias p/ resolver" color="text-purple-500" icon="⏱️" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaFilter className="text-gray-400 w-3.5 h-3.5" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Filtros</span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
              <FaTimes className="w-2.5 h-2.5" /> Limpar
            </button>
          )}
        </div>

        {/* Row 1: Date + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col xs:flex-row gap-2 flex-1">
            <select value={dateFilterType} onChange={e => setDateFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white w-full xs:w-32">
              <option value="solicitacao">Solicitacao</option>
              <option value="compra">Compra</option>
              <option value="reembolso">Reembolso</option>
            </select>
            <div className="flex-1 min-w-0">
              <DateRangePicker startDate={startDate} endDate={endDate} onDateChange={handleDateChange} />
            </div>
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              placeholder="Buscar nome ou email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary" />
          </div>
        </div>

        {/* Row 2: Quick dates */}
        <div className="flex flex-wrap gap-1.5">
          {[['month', 'Este mes'], ['lastMonth', 'Mes anterior'], ['3months', '3 meses'], ['all', 'Tudo']].map(([k, l]) => (
            <button key={k} onClick={() => setQuickDate(k)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
              {l}
            </button>
          ))}
        </div>

        {/* Row 3: Dropdown filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={filterProduto} onChange={e => { setFilterProduto(e.target.value); setCurrentPage(1) }}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white">
            <option value="all">Todos Produtos</option>
            {uniqueValues.produtos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white">
            <option value="all">Todos Status</option>
            {uniqueValues.statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterClassificacao} onChange={e => { setFilterClassificacao(e.target.value); setCurrentPage(1) }}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white">
            <option value="all">Classificacao</option>
            {uniqueValues.classificacoes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setCurrentPage(1) }}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white">
            <option value="all">Todas Fontes</option>
            <option value="typeform">Typeform</option>
            <option value="planilha">Planilha</option>
            <option value="merged">Mesclado</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                  : 'bg-white dark:bg-[#141419] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-[#27272a]'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          )
        })}
        <span className="ml-auto text-xs text-gray-400 self-center shrink-0 pl-2">{filteredData.length} registros</span>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab data={{ produtoData, statusData, pagamentoData, timelineData }} />}
      {activeTab === 'analytics' && <AnalyticsTab data={{ classificacaoData, motivoData, produtoStatusData, monthlyComparisonData }} />}
      {activeTab === 'crossref' && <CrossRefTab refunds={filteredData} salesData={salesData} loadingSales={loadingSales} onLoad={fetchSalesData} />}
      {activeTab === 'table' && (
        <TableTab data={paginatedData} sortConfig={sortConfig} onSort={handleSort}
          expandedRow={expandedRow} onExpand={setExpandedRow}
          currentPage={currentPage} totalPages={totalPages}
          onPageChange={setCurrentPage} totalRecords={sortedData.length} />
      )}
      {activeTab === 'monthly' && <MonthlyTab data={monthlyComparisonData} />}
    </div>
  )
}

// ========== Shared Components ==========

function KPICard({ label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-3 sm:p-4 shadow-sm">
      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 sm:p-6 shadow-sm ${className}`}>
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">-</span>
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>{status}</span>
}

function SourceBadge({ source }) {
  const styles = {
    typeform: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    planilha: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    merged: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[source] || styles.typeform}`}>{source}</span>
}

// ========== Tab: Overview ==========
function OverviewTab({ data }) {
  const { produtoData, statusData, pagamentoData, timelineData } = data
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <ChartCard title="Por Produto">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={produtoData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Solicitacoes" radius={[0, 8, 8, 0]}>
              {produtoData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Por Status">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value"
              label={({ name, percent }) => `${name.length > 15 ? name.substring(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Forma de Pagamento">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={pagamentoData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pagamentoData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {timelineData.length > 0 && (
        <ChartCard title="Timeline de Solicitacoes">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" name="Solicitacoes" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ========== Tab: Analytics ==========
function AnalyticsTab({ data }) {
  const { classificacaoData, motivoData, produtoStatusData, monthlyComparisonData } = data
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {classificacaoData.length > 0 && (
        <ChartCard title="Classificacao do Motivo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={classificacaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]}>
                {classificacaoData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="Produto x Status">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={produtoStatusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="realizados" name="Reembolsados" fill="#ef4444" stackId="a" />
            <Bar dataKey="revertidos" name="Revertidos" fill="#22c55e" stackId="a" />
            <Bar dataKey="outros" name="Outros" fill="#f59e0b" stackId="a" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Trend Mensal" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyComparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="realizados" name="Reembolsados" fill="#ef4444" radius={[8, 8, 0, 0]} />
            <Bar dataKey="revertidos" name="Revertidos" fill="#22c55e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {motivoData.length > 0 && (
        <ChartCard title="Top 10 Motivos (Typeform)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={motivoData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Quantidade" fill="#7c3aed" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ========== Tab: Table ==========
function TableTab({ data, sortConfig, onSort, expandedRow, onExpand, currentPage, totalPages, onPageChange, totalRecords }) {
  const columns = [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'Email', hideMobile: true },
    { key: 'produto', label: 'Produto' },
    { key: 'formaPagamento', label: 'Pagamento', hideMobile: true },
    { key: 'dataSolicitacao', label: 'Solicitacao', hideMobile: true },
    { key: 'status', label: 'Status' },
    { key: 'classificacaoMotivo', label: 'Classif.', hideTablet: true },
    { key: 'source', label: 'Fonte', hideTablet: true },
  ]

  return (
    <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
              <th className="px-2 py-3 w-8"></th>
              {columns.map(col => (
                <th key={col.key} onClick={() => onSort(col.key)}
                  className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors ${col.hideMobile ? 'hidden md:table-cell' : ''} ${col.hideTablet ? 'hidden lg:table-cell' : ''}`}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortConfig.key === col.key && (sortConfig.dir === 'asc' ? <FaSortUp className="w-3 h-3" /> : <FaSortDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {data.map((r, i) => (
              <React.Fragment key={r.id || i}>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => onExpand(expandedRow === r.id ? null : r.id)}>
                  <td className="px-2 py-3 text-gray-400">
                    {expandedRow === r.id ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[150px] sm:max-w-[180px] truncate">{r.nome || '-'}</td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate hidden md:table-cell">{r.email || '-'}</td>
                  <td className="px-3 py-3">
                    {r.produto ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{r.produto}</span> : '-'}
                  </td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:table-cell">{r.formaPagamento || '-'}</td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:table-cell">{r.dataSolicitacao ? formatDateBR(r.dataSolicitacao) : r.submittedAt ? formatDateBR(r.submittedAt) : '-'}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell">{r.classificacaoMotivo || '-'}</td>
                  <td className="px-3 py-3 hidden lg:table-cell"><SourceBadge source={r.source} /></td>
                </tr>
                {expandedRow === r.id && (
                  <tr className="bg-gray-50 dark:bg-[#1e1e24]">
                    <td colSpan={9} className="px-4 sm:px-6 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-sm">
                        <DetailField label="Contato/WhatsApp" value={r.contato || r.whatsapp} />
                        <DetailField label="Email" value={r.email} />
                        <DetailField label="Data de Compra" value={r.dataCompra} />
                        <DetailField label="Data de Reembolso" value={r.dataReembolso} />
                        <DetailField label="Primeiro Contato" value={r.primeiroContato} />
                        <DetailField label="Colaborador" value={r.colaborador} />
                        <DetailField label="Mes Referencia" value={r.mesReferencia} />
                        <DetailField label="Fonte" value={r.source} />
                        {r.motivo && <div className="sm:col-span-2 lg:col-span-3"><DetailField label="Motivo" value={r.motivo} /></div>}
                        {r.contatoCliente && <div className="sm:col-span-2 lg:col-span-3"><DetailField label="Historico de Contato" value={r.contatoCliente} /></div>}
                        {r.observacao && <div className="sm:col-span-2 lg:col-span-3"><DetailField label="Observacao" value={r.observacao} /></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-gray-800/50 border-t border-gray-200/50 dark:border-gray-700/50">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{totalRecords} registros</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <FaChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{currentPage}/{totalPages || 1}</span>
          <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
            className="px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }) {
  if (!value) return null
  return (
    <div>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">{label}</span>
      <span className="text-gray-700 dark:text-gray-300 text-sm">{value}</span>
    </div>
  )
}

// ========== Tab: Monthly ==========
function MonthlyTab({ data }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mes</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reembolsados</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Revertidos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Pendentes</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Retencao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{row.mes}</td>
                  <td className="px-4 py-3 text-center text-blue-600 font-bold">{row.total}</td>
                  <td className="px-4 py-3 text-center text-red-500">{row.realizados}</td>
                  <td className="px-4 py-3 text-center text-green-500 hidden sm:table-cell">{row.revertidos}</td>
                  <td className="px-4 py-3 text-center text-yellow-500 hidden sm:table-cell">{row.pendentes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row.total > 0 && (row.revertidos / row.total) > 0.1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {row.total > 0 ? `${((row.revertidos / row.total) * 100).toFixed(1)}%` : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChartCard title="Comparativo Mensal">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="realizados" name="Reembolsados" fill="#ef4444" radius={[8, 8, 0, 0]} />
            <Bar dataKey="revertidos" name="Revertidos" fill="#22c55e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ========== Tab: Vendas x Reembolsos ==========
const MONTH_NAMES = { '2026-01': 'Janeiro', '2026-02': 'Fevereiro', '2026-03': 'Março' }

function CrossRefTab({ refunds, salesData, loadingSales, onLoad }) {
  useEffect(() => { onLoad() }, [onLoad])

  if (loadingSales) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Buscando dados de vendas (Guru + Hotmart)...</p>
        </div>
      </div>
    )
  }

  if (!salesData) return null

  const refundsByMonth = {}
  const refundsByMonthProduct = {}
  refunds.forEach(r => {
    const d = parseDateBR(r.dataSolicitacao || r.submittedAt)
    if (!d) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    refundsByMonth[key] = (refundsByMonth[key] || 0) + 1
    const prod = r.produto || 'Nao informado'
    if (!refundsByMonthProduct[key]) refundsByMonthProduct[key] = {}
    refundsByMonthProduct[key][prod] = (refundsByMonthProduct[key][prod] || 0) + 1
  })

  const months = Object.keys(salesData).sort()
  const tableData = months.map(m => {
    const sales = salesData[m]
    const refCount = refundsByMonth[m] || 0
    return { mes: MONTH_NAMES[m] || m, key: m, vendas: sales.totalVendas, valorVendas: sales.totalValor, reembolsos: refCount, taxa: sales.totalVendas > 0 ? ((refCount / sales.totalVendas) * 100).toFixed(1) : '0' }
  })

  const normalizeProduct = (name) => {
    const n = name.toLowerCase().trim()
    if (n.includes('full stack') || n.includes('fullstack') || n.includes('devclub')) return 'Full Stack'
    if (n.includes('vitalício') || n.includes('vitalicio')) return 'Vitalício'
    if (n.includes('mba') || n.includes('pós')) return 'MBA'
    if (n.includes('front end') || n.includes('frontend')) return 'Front End'
    if (n.includes('ia club') || n.includes('gestor de ia')) return 'IA Club'
    return name
  }

  const productData = {}
  months.forEach(m => {
    Object.entries(salesData[m].byProduct || {}).forEach(([prod, data]) => {
      const norm = normalizeProduct(prod)
      if (!productData[norm]) productData[norm] = {}
      if (!productData[norm][m]) productData[norm][m] = { vendas: 0, valor: 0, reembolsos: 0 }
      productData[norm][m].vendas += data.vendas; productData[norm][m].valor += data.valor
    })
    Object.entries(refundsByMonthProduct[m] || {}).forEach(([prod, count]) => {
      const norm = normalizeProduct(prod)
      if (!productData[norm]) productData[norm] = {}
      if (!productData[norm][m]) productData[norm][m] = { vendas: 0, valor: 0, reembolsos: 0 }
      productData[norm][m].reembolsos += count
    })
  })

  const productChartData = Object.entries(productData).map(([prod, md]) => {
    let tv = 0, tr = 0
    Object.values(md).forEach(d => { tv += d.vendas; tr += d.reembolsos })
    return { name: prod, vendas: tv, reembolsos: tr, taxa: tv > 0 ? ((tr / tv) * 100).toFixed(1) : '0' }
  }).filter(d => d.vendas > 0 || d.reembolsos > 0).sort((a, b) => b.vendas - a.vendas)

  const chartData = tableData.map(r => ({ name: r.mes, Vendas: r.vendas, Reembolsos: r.reembolsos, Taxa: parseFloat(r.taxa) }))
  const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Total por mes */}
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">Vendas x Reembolsos por Mes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mes</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendas</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reemb.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {tableData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{row.mes}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-bold">{row.vendas}</td>
                  <td className="px-4 py-3 text-center text-green-600 text-sm hidden sm:table-cell">{formatMoney(row.valorVendas)}</td>
                  <td className="px-4 py-3 text-center text-red-500 font-bold">{row.reembolsos}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${parseFloat(row.taxa) > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                      {row.taxa}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChartCard title="Vendas vs Reembolsos por Mes">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 'auto']} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'Taxa %' ? `${value}%` : value} />
            <Legend />
            <Bar yAxisId="left" dataKey="Vendas" fill="#22c55e" radius={[8, 8, 0, 0]}
              label={{ position: 'top', fontSize: 11, fill: '#a1a1aa' }} />
            <Bar yAxisId="left" dataKey="Reembolsos" fill="#ef4444" radius={[8, 8, 0, 0]}
              label={{ position: 'top', fontSize: 11, fill: '#a1a1aa' }} />
            <Line yAxisId="right" type="monotone" dataKey="Taxa" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 5 }} name="Taxa %" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Por Produto */}
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">Vendas x Reembolsos por Produto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendas</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reemb.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Taxa</th>
                {months.map(m => (
                  <th key={m} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">{MONTH_NAMES[m] || m}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {productChartData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.name}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-bold">{row.vendas}</td>
                  <td className="px-4 py-3 text-center text-red-500 font-bold">{row.reembolsos}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${parseFloat(row.taxa) > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                      {row.taxa}%
                    </span>
                  </td>
                  {months.map(m => {
                    const d = productData[row.name]?.[m]
                    return <td key={m} className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">{d ? `${d.vendas}v / ${d.reembolsos}r` : '-'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChartCard title="Taxa de Reembolso por Produto">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={productChartData.map(d => ({ ...d, taxaNum: parseFloat(d.taxa) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 'auto']} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'Taxa %' ? `${value}%` : value} />
            <Legend />
            <Bar yAxisId="left" dataKey="vendas" name="Vendas" fill="#22c55e" radius={[8, 8, 0, 0]}
              label={{ position: 'top', fontSize: 11, fill: '#a1a1aa' }} />
            <Bar yAxisId="left" dataKey="reembolsos" name="Reembolsos" fill="#ef4444" radius={[8, 8, 0, 0]}
              label={{ position: 'top', fontSize: 11, fill: '#a1a1aa' }} />
            <Line yAxisId="right" type="monotone" dataKey="taxaNum" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 5 }} name="Taxa %" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
