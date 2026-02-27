import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { leadsService } from '../services/leadsService'
import { monitoringService } from '../services/monitoringService'
import toast from 'react-hot-toast'
import {
  FaUsers,
  FaUserPlus,
  FaBrain,
  FaChartBar,
  FaSearch,
  FaFilter,
  FaTimes,
  FaDownload,
  FaChevronDown,
  FaChevronUp,
  FaChevronLeft,
  FaChevronRight,
  FaSyncAlt,
  FaEnvelope,
  FaPhone,
  FaGlobe,
  FaBullhorn,
  FaTag,
  FaLaptop,
  FaCreditCard,
  FaBriefcase,
  FaGraduationCap,
  FaClock,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaRocket,
  FaStar,
  FaInfoCircle,
  FaCalendarAlt,
  FaBell,
  FaCheckCircle,
  FaShieldAlt,
} from 'react-icons/fa'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const CHART_COLORS = ['#37E359', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50]

const FILTER_OPTIONS = {
  source: ['facebook-ads', 'google-ads', 'organico'],
  genero: ['Masculino', 'Feminino'],
  idade: ['Menos de 18', '18 – 24', '25 – 34', '35 – 44', '45 – 54', '55+'],
  ocupacao: ['Estudante', 'CLT / Funcionário Público', 'Autônomo / Empreendedor', 'Desempregado', 'Aposentado'],
  urgencia: ['Quero começar o mais rápido possível', 'Quero começar, mas ainda estou avaliando'],
  barreira: ['Falta de dinheiro', 'Falta de tempo', 'Falta de orientação / por onde começar', 'Medo de não conseguir', 'Nenhuma'],
  investimento: ['Sim, estou pronto', 'Sim, mas preciso avaliar melhor', 'Não sei'],
  faixaSalarial: ['Nenhuma renda', 'Até R$ 2.000', 'R$ 2.001 a 3.000', 'R$ 3.001 a 5.000', 'Acima de R$ 5.000'],
  computador: ['SIM', 'NAO'],
  cartaoCredito: ['Sim', 'Não'],
  estudouProgramacao: ['Sim', 'Não'],
  interesseEvento: ['Como conseguir emprego', 'Como fazer freelancer', 'Como fazer transição de carreira', 'Projeto na prática', 'Quero saber se é pra mim'],
  atracaoProfissao: ['Ganhar mais dinheiro / bons salários', 'Trabalhar de qualquer lugar', 'Trabalhar para fora / dólar', 'Estabilidade / nunca faltar emprego', 'Todas as alternativas'],
  leadScore: ['Com score', 'Sem score'],
}

const FILTER_LABELS = {
  source: 'Fonte',
  genero: 'Gênero',
  idade: 'Faixa Etária',
  ocupacao: 'Ocupação',
  urgencia: 'Urgência',
  barreira: 'Barreira',
  investimento: 'Investimento',
  faixaSalarial: 'Faixa Salarial',
  computador: 'Computador',
  cartaoCredito: 'Cartão de Crédito',
  estudouProgramacao: 'Estudou Programação',
  interesseEvento: 'Interesse',
  atracaoProfissao: 'Atração pela Profissão',
  leadScore: 'Lead Score',
}

function getScoreColor(score) {
  if (score === null || score === undefined) return 'gray'
  if (score >= 0.6) return 'green'
  if (score >= 0.3) return 'yellow'
  return 'red'
}

function getScoreBadge(score) {
  const color = getScoreColor(score)
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        N/A
      </span>
    )
  }
  const colorMap = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[color]}`}>
      {(score * 100).toFixed(0)}%
    </span>
  )
}

function getDecilBadge(decil) {
  if (decil === null || decil === undefined) {
    return <span className="text-gray-400 dark:text-gray-600 text-sm">—</span>
  }
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    mid: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const tier = decil >= 8 ? 'high' : decil >= 5 ? 'mid' : 'low'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[tier]}`}>
      D{decil}
    </span>
  )
}

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatPhone(phone) {
  if (!phone) return '—'
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length >= 12) {
    const ddd = clean.slice(2, 4)
    const num = clean.slice(4)
    if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
    if (num.length === 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`
  }
  return phone
}

function computeMetrics(leads) {
  if (!leads || leads.length === 0) return { avgScore: null, pctD9: null, pctD10: null, count: 0 }
  const withScore = leads.filter(l => l.leadScore !== null && l.leadScore !== undefined)
  const avgScore = withScore.length > 0 ? withScore.reduce((s, l) => s + l.leadScore, 0) / withScore.length : 0
  const withDecil = leads.filter(l => l.decil !== null && l.decil !== undefined)
  const d9Count = withDecil.filter(l => l.decil === 9).length
  const d10Count = withDecil.filter(l => l.decil === 10).length
  return {
    avgScore,
    pctD9: withDecil.length > 0 ? d9Count / withDecil.length : 0,
    pctD10: withDecil.length > 0 ? d10Count / withDecil.length : 0,
    count: leads.length,
  }
}

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-3 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-xl">
        <p className="font-semibold text-sm text-text-light dark:text-text-dark">{payload[0].name}</p>
        <p className="text-primary font-bold">{payload[0].value} leads</p>
        <p className="text-xs text-gray-500">{((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%</p>
      </div>
    )
  }
  return null
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-3 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-xl">
        <p className="font-semibold text-sm text-text-light dark:text-text-dark">{label}</p>
        <p className="text-primary font-bold">{payload[0].value} leads</p>
      </div>
    )
  }
  return null
}

// Helpers de data (usando fuso horário local do Brasil)
const toLocalDateStr = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = () => toLocalDateStr(new Date())
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateStr(d)
}
const startOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const DATE_PRESETS = [
  { label: 'Hoje', startDate: () => todayStr(), endDate: () => todayStr() },
  { label: 'Ontem', startDate: () => daysAgo(1), endDate: () => daysAgo(1) },
  { label: '7 dias', startDate: () => daysAgo(6), endDate: () => todayStr() },
  { label: '15 dias', startDate: () => daysAgo(14), endDate: () => todayStr() },
  { label: '30 dias', startDate: () => daysAgo(29), endDate: () => todayStr() },
  { label: 'Este mês', startDate: () => startOfMonth(), endDate: () => todayStr() },
  { label: 'Tudo', startDate: () => '', endDate: () => '' },
]

export default function LeadsPage() {
  // Data states
  const [leads, setLeads] = useState([])
  const [allLeads, setAllLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Date filter states
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  const [activePreset, setActivePreset] = useState('Hoje')

  // Historical quality states
  const [historicalData, setHistoricalData] = useState(null)
  const [loadingHistorical, setLoadingHistorical] = useState(true)

  // Monitoring states
  const [monitoringData, setMonitoringData] = useState(null)
  const [loadingMonitoring, setLoadingMonitoring] = useState(true)
  const [alertsExpanded, setAlertsExpanded] = useState(false)

  // UI states
  const [loading, setLoading] = useState(true)
  const [loadingAll, setLoadingAll] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  // Filters
  const [filters, setFilters] = useState({})

  const searchTimerRef = useRef(null)

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(searchTimerRef.current)
  }, [search])

  // Fetch paginated leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      const data = await leadsService.fetchLeads({ page, limit, search: debouncedSearch, startDate, endDate })
      setLeads(data.leads || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      toast.error('Erro ao carregar leads')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, startDate, endDate])

  // Fetch all leads for KPIs and charts
  const fetchAllLeads = useCallback(async () => {
    try {
      setLoadingAll(true)
      const data = await leadsService.fetchAllLeads({ startDate, endDate })
      setAllLeads(data)
    } catch (error) {
      console.error('Erro ao carregar todos os leads:', error)
    } finally {
      setLoadingAll(false)
    }
  }, [startDate, endDate])

  // Fetch historical metrics (fixed periods, independent of date filter)
  const fetchHistoricalMetrics = useCallback(async () => {
    try {
      setLoadingHistorical(true)
      const today = todayStr()
      const [all, month, week, day] = await Promise.allSettled([
        leadsService.fetchAllLeads({ startDate: '', endDate: '' }),
        leadsService.fetchAllLeads({ startDate: daysAgo(29), endDate: today }),
        leadsService.fetchAllLeads({ startDate: daysAgo(6), endDate: today }),
        leadsService.fetchAllLeads({ startDate: today, endDate: today }),
      ])
      setHistoricalData({
        historico: computeMetrics(all.status === 'fulfilled' ? all.value : []),
        mes: computeMetrics(month.status === 'fulfilled' ? month.value : []),
        semana: computeMetrics(week.status === 'fulfilled' ? week.value : []),
        hoje: computeMetrics(day.status === 'fulfilled' ? day.value : []),
      })
    } catch (error) {
      console.error('Erro ao carregar métricas históricas:', error)
    } finally {
      setLoadingHistorical(false)
    }
  }, [])

  // Fetch monitoring data seguindo o filtro de datas da página
  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoadingMonitoring(true)
      const data = await monitoringService.fetchDailyCheck({ startDate, endDate })
      setMonitoringData(data)
    } catch (error) {
      console.error('Erro ao carregar monitoramento:', error)
      toast.error('Erro ao carregar dados de monitoramento')
    } finally {
      setLoadingMonitoring(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchAllLeads() }, [fetchAllLeads])
  useEffect(() => { fetchHistoricalMetrics() }, [fetchHistoricalMetrics])
  useEffect(() => { fetchMonitoringData() }, [fetchMonitoringData])

  const handleRefresh = async () => {
    leadsService.clearCache()
    monitoringService.clearCache()
    await Promise.all([fetchLeads(), fetchAllLeads(), fetchHistoricalMetrics(), fetchMonitoringData()])
    toast.success('Dados atualizados!')
  }

  const handlePreset = (preset) => {
    setStartDate(preset.startDate())
    setEndDate(preset.endDate())
    setActivePreset(preset.label)
    setPage(1)
  }

  const handleDateChange = (field, value) => {
    if (field === 'startDate') setStartDate(value)
    else setEndDate(value)
    setActivePreset(null)
    setPage(1)
  }

  // Apply client-side filters
  const filteredLeads = useMemo(() => {
    let result = [...leads]
    const activeFilters = Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)

    for (const [key, value] of activeFilters) {
      if (key === 'leadScore') {
        result = result.filter(l => value === 'Com score' ? l.leadScore !== null : l.leadScore === null)
      } else if (key === 'source') {
        result = result.filter(l => l.source === value)
      } else if (key === 'medium') {
        result = result.filter(l => l.medium === value)
      } else {
        result = result.filter(l => l.pesquisa?.[key] === value)
      }
    }

    // Client-side sort
    if (sortField) {
      result.sort((a, b) => {
        let va, vb
        if (sortField === 'leadScore') {
          va = a.leadScore ?? -1
          vb = b.leadScore ?? -1
        } else if (sortField === 'decil') {
          va = a.decil ?? -1
          vb = b.decil ?? -1
        } else if (sortField === 'data') {
          va = new Date(a.data).getTime()
          vb = new Date(b.data).getTime()
        } else if (sortField === 'nomeCompleto') {
          va = (a.nomeCompleto || '').toLowerCase()
          vb = (b.nomeCompleto || '').toLowerCase()
        } else {
          va = a[sortField] || ''
          vb = b[sortField] || ''
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [leads, filters, sortField, sortDir])

  // KPI calculations from allLeads
  const kpis = useMemo(() => {
    if (!allLeads.length) return { total: 0, todayCount: 0, withScore: 0, avgScore: 0 }
    const today = toLocalDateStr(new Date())
    const todayLeads = allLeads.filter(l => l.data?.startsWith(today))
    const withScore = allLeads.filter(l => l.leadScore !== null && l.leadScore !== undefined)
    const avgScore = withScore.length > 0 ? withScore.reduce((s, l) => s + l.leadScore, 0) / withScore.length : 0
    return {
      total: allLeads.length,
      todayCount: todayLeads.length,
      withScore: withScore.length,
      withScorePercent: allLeads.length > 0 ? ((withScore.length / allLeads.length) * 100).toFixed(1) : '0.0',
      avgScore: (avgScore * 100).toFixed(1),
    }
  }, [allLeads])

  // Chart data
  const sourceChartData = useMemo(() => {
    const map = {}
    allLeads.forEach(l => {
      const s = l.source || 'Desconhecido'
      map[s] = (map[s] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({
      name: name === 'facebook-ads' ? 'Facebook Ads' : name === 'google-ads' ? 'Google Ads' : name === 'organico' ? 'Orgânico' : name,
      value,
      total: allLeads.length,
    }))
  }, [allLeads])

  const decilChartData = useMemo(() => {
    const map = {}
    let semDecil = 0
    allLeads.forEach(l => {
      if (l.decil !== null && l.decil !== undefined) {
        const key = `D${l.decil}`
        map[key] = (map[key] || 0) + 1
      } else {
        semDecil++
      }
    })
    const ordered = Array.from({ length: 10 }, (_, i) => {
      const key = `D${i + 1}`
      return { name: key, value: map[key] || 0 }
    })
    if (semDecil > 0) ordered.push({ name: 'S/D', value: semDecil })
    return ordered
  }, [allLeads])

  // Medium options from current data
  const mediumOptions = useMemo(() => {
    const set = new Set()
    leads.forEach(l => { if (l.medium) set.add(l.medium) })
    return [...set].sort()
  }, [leads])

  // Daily score evolution from allLeads (current filter period)
  const dailyScoreData = useMemo(() => {
    const byDay = {}
    allLeads.forEach(l => {
      if (l.data && l.leadScore !== null && l.leadScore !== undefined) {
        const day = l.data.split('T')[0]
        if (!byDay[day]) byDay[day] = { scores: [], count: 0 }
        byDay[day].scores.push(l.leadScore)
        byDay[day].count++
      }
    })
    return Object.entries(byDay)
      .map(([date, { scores, count }]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        avgScore: (scores.reduce((s, v) => s + v, 0) / scores.length) * 100,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allLeads])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const clearFilters = () => {
    setFilters({})
    setSearch('')
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== undefined).length

  // CSV export
  const exportCSV = () => {
    const headers = ['Data', 'Hora', 'Nome', 'Email', 'Telefone', 'Source', 'Medium', 'Campaign', 'Lead Score', 'Decil', 'Idade', 'Gênero', 'Ocupação', 'Urgência', 'Barreira', 'Investimento', 'Faixa Salarial', 'Computador', 'Cartão de Crédito', 'Estudou Programação', 'Interesse', 'Atração pela Profissão']

    const rows = allLeads.map(l => {
      const p = l.pesquisa || {}
      return [
        formatDate(l.data),
        l.hora || '',
        `"${(l.nomeCompleto || '').replace(/"/g, '""')}"`,
        l.email || '',
        l.telefone || '',
        l.source || '',
        l.medium || '',
        `"${(l.campaign || '').replace(/"/g, '""')}"`,
        l.leadScore !== null ? (l.leadScore * 100).toFixed(1) + '%' : '',
        l.decil || '',
        p.idade || '',
        p.genero || '',
        p.ocupacao || '',
        p.urgencia || '',
        p.barreira || '',
        p.investimento || '',
        p.faixaSalarial || '',
        p.computador || '',
        p.cartaoCredito || '',
        p.estudouProgramacao || '',
        p.interesseEvento || '',
        p.atracaoProfissao || '',
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_devclub_${toLocalDateStr(new Date())}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`${allLeads.length} leads exportados!`)
  }

  // Sort icon
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <FaChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <FaChevronUp className="w-3 h-3 text-primary" /> : <FaChevronDown className="w-3 h-3 text-primary" />
  }

  return (
    <div className="max-w-[1600px] mx-auto pb-10 space-y-6">
      {/* ====== PAGE HEADER ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Leads Captados
          </h1>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
            {loadingAll ? 'Carregando...' : `${kpis.total} leads no total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/30 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 hover:scale-105 hover:shadow-lg text-sm font-medium text-text-light dark:text-text-dark cursor-pointer"
          >
            <FaSyncAlt className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-180" />
            Atualizar
          </button>
          <button
            onClick={exportCSV}
            disabled={loadingAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            <FaDownload className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ====== ALERTAS DO SISTEMA ====== */}
      {!loadingMonitoring && monitoringData && monitoringData.total_alerts > 0 && (
        <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800/60">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-semibold text-text-light dark:text-text-dark">Alertas do Sistema</span>
            </div>
            <div className="flex items-center gap-1.5">
              {monitoringData.alerts_by_severity?.HIGH > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{monitoringData.alerts_by_severity.HIGH} HIGH</span>
              )}
              {(monitoringData.alerts_by_severity?.MEDIUM ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500 text-white">{monitoringData.alerts_by_severity.MEDIUM} MED</span>
              )}
              {monitoringData.alerts_by_severity?.LOW > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">{monitoringData.alerts_by_severity.LOW} LOW</span>
              )}
            </div>
          </div>

          {/* Alert rows */}
          {(() => {
            const VISIBLE = 4
            const sorted = [...monitoringData.alerts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            const visible = alertsExpanded ? sorted : sorted.slice(0, VISIBLE)
            const hidden = sorted.length - VISIBLE

            const renderRow = (alert, i) => {
              const isHigh = alert.severity === 'HIGH'
              const isMid = alert.severity === 'MEDIUM'
              const leftBorder = isHigh ? 'border-l-4 border-l-red-500' : isMid ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-blue-400'
              const badgeCls = isHigh
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : isMid
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              const d = alert.details

              const typeLabel = {
                distribution_drift: 'Drift de Distribuição',
                category_drift: 'Categoria Nova',
                missing_rate_high: 'Dados Faltando',
                score_distribution_change: 'Mudança em Decis',
                extra_unexpected_features: 'Features Inesperadas',
              }[alert.type] ?? alert.type

              let summary = ''
              if (alert.type === 'distribution_drift' && d?.changes?.[0]) {
                const top = d.changes[0]
                summary = `${d.column} · "${top.categoria}": ${(top.treino * 100).toFixed(1)}% → ${(top.producao * 100).toFixed(1)}% (+${(top.diff * 100).toFixed(1)}pp)`
              } else if (alert.type === 'category_drift' && d?.new_categories) {
                summary = `${d.column} · novas: ${d.new_categories.join(', ')} (${d.affected_count} leads)`
              } else if (alert.type === 'missing_rate_high' && d) {
                summary = `${d.column} · ${d.missing_count}/${d.total_rows} sem dado (${(d.missing_rate * 100).toFixed(0)}%)`
              } else if (alert.type === 'score_distribution_change' && d?.changes?.[0]) {
                const top = d.changes[0]
                summary = `${top.decil}: esperado ${(top.esperado * 100).toFixed(0)}% → atual ${(top.atual * 100).toFixed(0)}% (+${(top.diff * 100).toFixed(1)}pp)`
              } else if (alert.type === 'extra_unexpected_features' && d) {
                summary = `${d.extra_count} features inesperadas · ${d.extra_features?.slice(0, 3).join(', ')}`
              }

              return (
                <div key={i} className={`flex items-center gap-3 px-5 py-3 ${leftBorder} hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors`}>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${badgeCls}`}>{alert.severity}</span>
                  <span className="text-xs font-medium text-text-light dark:text-text-dark shrink-0">{typeLabel}</span>
                  <span className="text-xs text-text-muted-light dark:text-text-muted-dark truncate flex-1">{summary}</span>
                  <span className="text-xs text-text-muted-light dark:text-text-muted-dark shrink-0 tabular-nums">{formatDateTime(alert.timestamp)}</span>
                </div>
              )
            }

            return (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {visible.map(renderRow)}
                {sorted.length > VISIBLE && (
                  <button
                    onClick={() => setAlertsExpanded(e => !e)}
                    className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-medium text-text-muted-light dark:text-text-muted-dark hover:text-primary hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer"
                  >
                    {alertsExpanded ? (
                      <><FaChevronUp className="w-3 h-3" /> Recolher</>
                    ) : (
                      <><FaChevronDown className="w-3 h-3" /> Ver mais {hidden} {hidden === 1 ? 'alerta' : 'alertas'}</>
                    )}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* ====== DATE FILTER ====== */}
      <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-4 md:p-5 border border-white/20 dark:border-gray-700/50 shadow-xl animate-fade-in">
        <div className="flex flex-wrap items-center gap-3">
          {/* Icon */}
          <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary-dark/20 rounded-xl flex items-center justify-center shrink-0">
            <FaCalendarAlt className="w-4 h-4 text-primary" />
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activePreset === preset.label
                    ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-md shadow-primary/25'
                    : 'bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700" />

          {/* Custom date inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark font-medium whitespace-nowrap">De</span>
              <input
                type="date"
                value={startDate}
                onChange={e => handleDateChange('startDate', e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark font-medium whitespace-nowrap">até</span>
              <input
                type="date"
                value={endDate}
                onChange={e => handleDateChange('endDate', e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              />
            </div>
          </div>

          {/* Result count */}
          {!loadingAll && (
            <div className="ml-auto text-sm font-semibold text-text-light dark:text-text-dark whitespace-nowrap">
              <span className="text-primary">{kpis.total}</span>
              <span className="text-text-muted-light dark:text-text-muted-dark font-normal"> leads no período</span>
            </div>
          )}
          {loadingAll && (
            <div className="ml-auto w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          )}
        </div>
      </div>

      {/* ====== KPI CARDS ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          {
            title: activePreset === 'Tudo' ? 'Total de Leads' : 'Leads no Período',
            value: kpis.total,
            icon: FaUsers,
            gradient: 'from-primary/20 to-emerald-500/20',
            iconGradient: 'from-primary to-emerald-500',
          },
          {
            title: 'Leads Hoje',
            value: kpis.todayCount,
            icon: FaUserPlus,
            gradient: 'from-blue-500/20 to-cyan-500/20',
            iconGradient: 'from-blue-500 to-cyan-500',
          },
          {
            title: 'Com Lead Score',
            value: `${kpis.withScorePercent || 0}%`,
            subtitle: `${kpis.withScore} de ${kpis.total}`,
            icon: FaBrain,
            gradient: 'from-purple-500/20 to-pink-500/20',
            iconGradient: 'from-purple-500 to-pink-500',
          },
          {
            title: 'Score Médio',
            value: `${kpis.avgScore || 0}%`,
            icon: FaChartBar,
            gradient: 'from-amber-500/20 to-orange-500/20',
            iconGradient: 'from-amber-500 to-orange-500',
          },
        ].map((kpi, i) => (
          <div key={i} className="group relative animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`absolute inset-0 bg-gradient-to-r ${kpi.gradient} rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300 opacity-60`}></div>
            <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${kpi.iconGradient} rounded-xl flex items-center justify-center shadow-lg`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">{kpi.title}</h3>
              <p className="text-3xl font-bold text-text-light dark:text-text-dark">
                {loadingAll ? (
                  <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></span>
                ) : kpi.value}
              </p>
              {kpi.subtitle && !loadingAll && (
                <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">{kpi.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ====== CHARTS ====== */}
      {!loadingAll && allLeads.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in">
          {/* Source Pie Chart */}
          <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Leads por Fonte</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={sourceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={true}
                >
                  {sourceChartData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Decil Bar Chart */}
          <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Leads por Decil</h3>
              <div className="flex items-center gap-3 text-xs text-text-muted-light dark:text-text-muted-dark">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>D1–D4 baixo</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>D5–D7 médio</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block"></span>D8–D10 alto</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={decilChartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="rgba(100,100,100,0.5)" />
                <YAxis tick={{ fontSize: 12 }} stroke="rgba(100,100,100,0.5)" />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {decilChartData.map((entry, idx) => {
                    const d = parseInt(entry.name.replace('D', ''))
                    const color = isNaN(d) ? '#94A3B8' : d >= 8 ? '#37E359' : d >= 5 ? '#F59E0B' : '#EF4444'
                    return <Cell key={idx} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ====== QUALIDADE HISTÓRICA ====== */}
      <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
            <FaStar className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Qualidade dos Leads</h3>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Análise histórica de score e distribuição por decil</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                  <th className="text-left py-2.5 pr-4 font-semibold text-text-muted-light dark:text-text-muted-dark text-xs uppercase tracking-wider">Métrica</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-text-muted-light dark:text-text-muted-dark text-xs uppercase tracking-wider">Histórico</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-text-muted-light dark:text-text-muted-dark text-xs uppercase tracking-wider">Último mês</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-text-muted-light dark:text-text-muted-dark text-xs uppercase tracking-wider">Última semana</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-text-muted-light dark:text-text-muted-dark text-xs uppercase tracking-wider">Últimas 24h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {[
                  { label: 'Score Médio', key: 'avgScore', format: (v) => `${(v * 100).toFixed(2)}%` },
                  { label: '% em D9', key: 'pctD9', format: (v) => `${(v * 100).toFixed(2)}%` },
                  { label: '% em D10', key: 'pctD10', format: (v) => `${(v * 100).toFixed(2)}%` },
                ].map(metric => (
                  <tr key={metric.key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 pr-4 font-medium text-text-light dark:text-text-dark">{metric.label}</td>
                    {['historico', 'mes', 'semana', 'hoje'].map(period => (
                      <td key={period} className="py-3.5 px-3 text-center">
                        {loadingHistorical ? (
                          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
                        ) : (
                          <span className="font-semibold text-text-light dark:text-text-dark">
                            {historicalData?.[period]?.[metric.key] != null
                              ? metric.format(historicalData[period][metric.key])
                              : '—'}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-gray-200/50 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4 text-xs text-text-muted-light dark:text-text-muted-dark">Total de leads</td>
                  {['historico', 'mes', 'semana', 'hoje'].map(period => (
                    <td key={period} className="py-2.5 px-3 text-center">
                      {loadingHistorical ? (
                        <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
                      ) : (
                        <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                          {historicalData?.[period]?.count ?? '—'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Daily score line chart */}
          <div>
            <h4 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark mb-4 uppercase tracking-wider">
              Evolução do score no período selecionado
            </h4>
            {loadingAll ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : dailyScoreData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyScoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.15)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(100,100,100,0.5)" />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="rgba(100,100,100,0.5)"
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-3 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-xl">
                            <p className="font-semibold text-sm text-text-light dark:text-text-dark">{label}</p>
                            <p className="text-primary font-bold">{payload[0].value.toFixed(1)}% score médio</p>
                            <p className="text-xs text-gray-500">{payload[0].payload.count} leads com score</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#37E359"
                    strokeWidth={2.5}
                    dot={{ fill: '#37E359', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#37E359' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-text-muted-light dark:text-text-muted-dark gap-2">
                <FaChartBar className="w-10 h-10 opacity-20" />
                <p className="text-sm">Dados insuficientes para o gráfico</p>
                <p className="text-xs opacity-60">Selecione um período com mais de um dia</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== MONITORAMENTO DO SISTEMA ====== */}
      {loadingMonitoring ? (
        <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl animate-pulse">
          <div className="h-6 w-56 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-3">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                {[0, 1, 2, 3].map(j => (
                  <div key={j} className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : monitoringData && (
        <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
                <FaBell className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Monitoramento Automático</h3>
                <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                  {monitoringData.funnel_metrics?.window?.start_brt} → {monitoringData.funnel_metrics?.window?.end_brt} (12h)
                </p>
              </div>
            </div>
            {/* Severity badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {monitoringData.alerts_by_severity?.HIGH > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <FaExclamationTriangle className="w-3 h-3" />
                  {monitoringData.alerts_by_severity.HIGH} HIGH
                </span>
              )}
              {(monitoringData.alerts_by_severity?.MEDIUM ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <FaExclamationTriangle className="w-3 h-3" />
                  {monitoringData.alerts_by_severity.MEDIUM} MEDIUM
                </span>
              )}
              {monitoringData.alerts_by_severity?.LOW > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <FaInfoCircle className="w-3 h-3" />
                  {monitoringData.alerts_by_severity.LOW} LOW
                </span>
              )}
              {monitoringData.total_alerts === 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <FaCheckCircle className="w-3 h-3" />
                  Tudo OK
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Funil de Conversão */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider flex items-center gap-2">
                <FaRocket className="w-3.5 h-3.5" /> Funil de Conversão
              </h4>
              {(() => {
                const total = monitoringData.funnel_metrics?.capture?.total_database || 0
                return [
                  { label: 'Capturados', value: total, color: 'bg-primary' },
                  { label: 'Pontuados', value: monitoringData.funnel_metrics?.scoring?.total_scored, color: 'bg-blue-500' },
                  { label: 'Enviados CAPI', value: monitoringData.funnel_metrics?.capi_sent?.leads_sent, color: 'bg-purple-500' },
                  { label: 'Aceitos Meta', value: monitoringData.funnel_metrics?.meta_response?.success_count, color: 'bg-amber-500' },
                ].map((step, i) => {
                  const pct = total > 0 ? ((step.value / total) * 100) : 100
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-28 text-right text-xs text-text-muted-light dark:text-text-muted-dark shrink-0">{step.label}</div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${step.color} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="w-20 text-right text-xs font-semibold text-text-light dark:text-text-dark shrink-0">
                        {step.value?.toLocaleString('pt-BR')} <span className="font-normal text-text-muted-light dark:text-text-muted-dark">({pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  )
                })
              })()}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-0.5">Tx. Envio CAPI</p>
                  <p className="text-2xl font-bold text-primary">{monitoringData.funnel_metrics?.capi_sent?.send_rate?.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-0.5">Aceitação Meta</p>
                  <p className="text-2xl font-bold text-primary">{monitoringData.funnel_metrics?.meta_response?.acceptance_rate?.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Qualidade dos Dados */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider flex items-center gap-2">
                <FaShieldAlt className="w-3.5 h-3.5" /> Qualidade dos Dados
              </h4>
              {[
                { label: 'Telefone', value: monitoringData.funnel_metrics?.data_quality?.phone_percentage },
                { label: 'FBP (pixel cookie)', value: monitoringData.funnel_metrics?.data_quality?.fbp_percentage },
                { label: 'FBC (click cookie)', value: monitoringData.funnel_metrics?.data_quality?.fbc_percentage },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-28 text-right text-xs text-text-muted-light dark:text-text-muted-dark shrink-0">{item.label}</div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${(item.value ?? 0) >= 90 ? 'bg-primary' : (item.value ?? 0) >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${item.value?.toFixed(1) ?? 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-xs font-semibold text-text-light dark:text-text-dark shrink-0">{item.value?.toFixed(1)}%</div>
                </div>
              ))}
              {/* Score metrics 24h */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60 space-y-2">
                <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Qualidade dos Leads (24h)</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Score', value: ((monitoringData.lead_quality_metrics?.ultimas_24h?.score ?? 0) * 100).toFixed(1) + '%' },
                    { label: '% D9', value: (monitoringData.lead_quality_metrics?.ultimas_24h?.d9 ?? 0).toFixed(1) + '%' },
                    { label: '% D10', value: (monitoringData.lead_quality_metrics?.ultimas_24h?.d10 ?? 0).toFixed(1) + '%' },
                  ].map((m, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2">
                      <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{m.label}</p>
                      <p className="text-lg font-bold text-text-light dark:text-text-dark">{m.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-text-muted-light dark:text-text-muted-dark">
                  {monitoringData.lead_quality_metrics?.ultimas_24h?.count?.toLocaleString('pt-BR')} leads analisados
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ====== SEARCH & FILTERS ====== */}
      <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20 dark:border-gray-700/50 shadow-xl space-y-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >
                <FaTimes className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300 font-medium text-sm cursor-pointer ${
              activeFilterCount > 0
                ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20'
                : 'bg-white/60 dark:bg-gray-800/60 border-gray-200/50 dark:border-gray-700/50 text-text-light dark:text-text-dark hover:bg-white/80 dark:hover:bg-gray-800/80'
            }`}
          >
            <FaFilter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {filtersOpen ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
          </button>

          {/* Clear filters */}
          {(activeFilterCount > 0 || search) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-200/50 dark:border-red-800/30 transition-all duration-300 font-medium text-sm cursor-pointer"
            >
              <FaTimes className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 animate-slide-up">
            {Object.entries(FILTER_OPTIONS).map(([key, options]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1.5">
                  {FILTER_LABELS[key]}
                </label>
                <select
                  value={filters[key] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  <option value="">Todos</option>
                  {(key === 'medium' ? mediumOptions : options).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== DATA TABLE ====== */}
      <div className="bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden animate-fade-in">
        {/* Table header info */}
        <div className="px-4 md:px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
            Mostrando <span className="font-semibold text-text-light dark:text-text-dark">{filteredLeads.length}</span> de{' '}
            <span className="font-semibold text-text-light dark:text-text-dark">{total}</span> leads
            {debouncedSearch && <span> para "<span className="text-primary font-medium">{debouncedSearch}</span>"</span>}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted-light dark:text-text-muted-dark">Por página:</span>
            {ITEMS_PER_PAGE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { setLimit(opt); setPage(1) }}
                className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
                  limit === opt
                    ? 'bg-primary text-white font-medium shadow-sm'
                    : 'text-text-muted-light dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50">
                {[
                  { key: 'data', label: 'Data/Hora' },
                  { key: 'nomeCompleto', label: 'Nome' },
                  { key: 'email', label: 'Email', hideClass: 'hidden lg:table-cell' },
                  { key: 'telefone', label: 'Telefone', hideClass: 'hidden md:table-cell' },
                  { key: 'source', label: 'Fonte', hideClass: 'hidden sm:table-cell' },
                  { key: 'medium', label: 'Mídia', hideClass: 'hidden xl:table-cell' },
                  { key: 'leadScore', label: 'Score' },
                  { key: 'decil', label: 'Decil', hideClass: 'hidden sm:table-cell' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none ${col.hideClass || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      <SortIcon field={col.key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }}></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FaUsers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum lead encontrado</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Tente ajustar os filtros ou a busca</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    expanded={expandedRow === lead.id}
                    onToggleExpand={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                    onOpenDetail={() => setDetailModal(lead)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
              Página <span className="font-semibold text-text-light dark:text-text-dark">{page}</span> de{' '}
              <span className="font-semibold text-text-light dark:text-text-dark">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Primeira
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <FaChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        page === pageNum
                          ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                          : 'bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 text-text-light dark:text-text-dark'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <FaChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====== DETAIL MODAL ====== */}
      {detailModal && (
        <LeadDetailModal lead={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  )
}

// ========== LEAD TABLE ROW ==========
function LeadRow({ lead, expanded, onToggleExpand, onOpenDetail }) {
  const sourceColors = {
    'facebook-ads': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'google-ads': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'organico': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-3.5">
          <div className="text-sm font-medium text-text-light dark:text-text-dark">{formatDate(lead.data)}</div>
          <div className="text-xs text-text-muted-light dark:text-text-muted-dark">{lead.hora}</div>
        </td>
        <td className="px-4 py-3.5">
          <div className="text-sm font-medium text-text-light dark:text-text-dark max-w-[200px] truncate">
            {lead.nomeCompleto}
          </div>
        </td>
        <td className="px-4 py-3.5 hidden lg:table-cell">
          <div className="text-sm text-text-muted-light dark:text-text-muted-dark max-w-[200px] truncate">{lead.email}</div>
        </td>
        <td className="px-4 py-3.5 hidden md:table-cell">
          <div className="text-sm text-text-muted-light dark:text-text-muted-dark">{formatPhone(lead.telefone)}</div>
        </td>
        <td className="px-4 py-3.5 hidden sm:table-cell">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceColors[lead.source] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
            {lead.source === 'facebook-ads' ? 'Facebook' : lead.source === 'google-ads' ? 'Google' : lead.source || '—'}
          </span>
        </td>
        <td className="px-4 py-3.5 hidden xl:table-cell">
          <div className="text-xs text-text-muted-light dark:text-text-muted-dark max-w-[150px] truncate">{lead.medium || '—'}</div>
        </td>
        <td className="px-4 py-3.5">{getScoreBadge(lead.leadScore)}</td>
        <td className="px-4 py-3.5 hidden sm:table-cell">{getDecilBadge(lead.decil)}</td>
        <td className="px-4 py-3.5">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail() }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Ver detalhes"
          >
            <FaInfoCircle className="w-4 h-4 text-gray-400 hover:text-primary transition-colors" />
          </button>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="bg-gray-50/30 dark:bg-gray-800/20">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-slide-up">
              {/* Contact info (visible on mobile) */}
              <div className="lg:hidden space-y-1.5">
                <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Contato</p>
                <p className="text-sm text-text-light dark:text-text-dark flex items-center gap-1.5">
                  <FaEnvelope className="w-3 h-3 text-gray-400" /> {lead.email}
                </p>
                <p className="text-sm text-text-light dark:text-text-dark flex items-center gap-1.5">
                  <FaPhone className="w-3 h-3 text-gray-400" /> {formatPhone(lead.telefone)}
                </p>
              </div>

              {/* Survey data */}
              {lead.pesquisa && Object.entries({
                'Idade': lead.pesquisa.idade,
                'Gênero': lead.pesquisa.genero,
                'Ocupação': lead.pesquisa.ocupacao,
                'Faixa Salarial': lead.pesquisa.faixaSalarial,
                'Urgência': lead.pesquisa.urgencia,
                'Barreira': lead.pesquisa.barreira,
                'Investimento': lead.pesquisa.investimento,
                'Computador': lead.pesquisa.computador,
                'Cartão': lead.pesquisa.cartaoCredito,
                'Estudou Prog.': lead.pesquisa.estudouProgramacao,
                'Interesse': lead.pesquisa.interesseEvento,
                'Atração': lead.pesquisa.atracaoProfissao,
              }).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-text-light dark:text-text-dark mt-0.5">{value || '—'}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ========== DETAIL MODAL ==========
function LeadDetailModal({ lead, onClose }) {
  const pesquisa = lead.pesquisa || {}

  const sections = [
    {
      title: 'Informações Pessoais',
      icon: FaUsers,
      items: [
        { label: 'Nome Completo', value: lead.nomeCompleto },
        { label: 'Email', value: lead.email, icon: FaEnvelope },
        { label: 'Telefone', value: formatPhone(lead.telefone), icon: FaPhone },
        { label: 'Data de Captação', value: formatDateTime(lead.data), icon: FaClock },
      ],
    },
    {
      title: 'Perfil',
      icon: FaBriefcase,
      items: [
        { label: 'Idade', value: pesquisa.idade },
        { label: 'Gênero', value: pesquisa.genero },
        { label: 'Ocupação', value: pesquisa.ocupacao, icon: FaBriefcase },
        { label: 'Faixa Salarial', value: pesquisa.faixaSalarial, icon: FaMoneyBillWave },
      ],
    },
    {
      title: 'Qualificação',
      icon: FaStar,
      items: [
        { label: 'Lead Score', value: lead.leadScore !== null ? `${(lead.leadScore * 100).toFixed(1)}%` : 'N/A' },
        { label: 'Decil', value: lead.decil !== null ? `D${lead.decil}` : 'N/A' },
        { label: 'Urgência', value: pesquisa.urgencia, icon: FaRocket },
        { label: 'Investimento', value: pesquisa.investimento, icon: FaCreditCard },
      ],
    },
    {
      title: 'Interesse & Barreiras',
      icon: FaGraduationCap,
      items: [
        { label: 'Interesse no Evento', value: pesquisa.interesseEvento },
        { label: 'Atração pela Profissão', value: pesquisa.atracaoProfissao },
        { label: 'Barreira', value: pesquisa.barreira, icon: FaExclamationTriangle },
        { label: 'Tem Computador', value: pesquisa.computador, icon: FaLaptop },
        { label: 'Cartão de Crédito', value: pesquisa.cartaoCredito, icon: FaCreditCard },
        { label: 'Estudou Programação', value: pesquisa.estudouProgramacao, icon: FaGraduationCap },
        { label: 'Investiu em Curso', value: pesquisa.investiuCurso },
      ],
    },
    {
      title: 'Dados de Tráfego (UTM)',
      icon: FaBullhorn,
      items: [
        { label: 'Source', value: lead.source, icon: FaGlobe },
        { label: 'Medium', value: lead.medium, icon: FaBullhorn },
        { label: 'Campaign', value: lead.campaign, icon: FaTag },
        { label: 'Content', value: lead.content },
        { label: 'Term', value: lead.term },
      ],
    },
    {
      title: 'Dados Técnicos',
      icon: FaInfoCircle,
      items: [
        { label: 'IP', value: lead.remoteIp },
        { label: 'CAPI Status', value: lead.capiStatus || 'Pendente' },
        { label: 'CAPI Enviado em', value: lead.capiSentAt ? formatDateTime(lead.capiSentAt) : 'N/A' },
        { label: 'Criado em', value: formatDateTime(lead.createdAt) },
      ],
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 dark:border-gray-700/50 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-text-light dark:text-text-dark">{lead.nomeCompleto}</h2>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">{lead.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {getScoreBadge(lead.leadScore)}
            {getDecilBadge(lead.decil)}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <FaTimes className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-6">
          {sections.map((section, si) => (
            <div key={si}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary-dark/20 rounded-lg flex items-center justify-center">
                  <section.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-text-light dark:text-text-dark uppercase tracking-wider">{section.title}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.items.map((item, ii) => (
                  <div
                    key={ii}
                    className="px-4 py-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/30"
                  >
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-text-light dark:text-text-dark break-all">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
