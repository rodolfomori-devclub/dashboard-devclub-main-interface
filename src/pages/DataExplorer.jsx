import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FaTable, FaSearch, FaDownload, FaSpinner, FaSortUp, FaSortDown,
  FaChevronLeft, FaChevronRight, FaFilter, FaTimes, FaColumns,
  FaUsers, FaPoll, FaEnvelope, FaSync, FaDatabase, FaArrowLeft,
  FaTachometerAlt,
} from 'react-icons/fa'
import { leadsService } from '../services/leadsService'
import { activeCampaignService } from '../services/activeCampaignService'

// ====== Definição das fontes / colunas ======
const SOURCES = {
  clients: {
    id: 'clients',
    label: 'Leads Captados',
    icon: FaUsers,
    color: 'from-blue-500 to-cyan-500',
    description: 'Clientes captados (Leads Data API · /api/clients)',
    fetcher: async ({ page, limit, search, startDate, endDate }) =>
      leadsService.fetchClients({ page, limit, search, startDate, endDate }),
    extractRows: (resp) => resp.clients || [],
    extractTotal: (resp) => resp.total || 0,
    extractTotalPages: (resp) => resp.totalPages || 1,
    columns: [
      { key: 'email', label: 'Email', width: 220 },
      { key: 'firstName', label: 'Nome', width: 120 },
      { key: 'lastName', label: 'Sobrenome', width: 120 },
      { key: 'phone', label: 'Telefone', width: 130 },
      { key: 'firstSeenAt', label: 'First Seen', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'lastActivityAt', label: 'Last Activity', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'createdAt', label: 'Criado em', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: '_count.activities', label: '# Activities', width: 100, align: 'right' },
      { key: '_count.utmTracking', label: '# UTM', width: 80, align: 'right' },
      { key: 'tags', label: 'Tags', width: 220, render: (v) => Array.isArray(v) ? v.map(t => {
        if (typeof t === 'string') return t
        return t.tag?.name || t.tag?.tag || t.tagName || t.name || (typeof t.tag === 'string' ? t.tag : '')
      }).filter(Boolean).join(', ') : '—' },
      { key: 'ip4', label: 'IP', width: 130 },
      { key: 'orgName', label: 'Org', width: 120 },
    ],
  },
  survey: {
    id: 'survey',
    label: 'Pesquisa (Respostas)',
    icon: FaPoll,
    color: 'from-pink-500 to-rose-500',
    description: 'Respostas de pesquisa (Leads Data API · /api/leads)',
    fetcher: async ({ page, limit, search, startDate, endDate }) =>
      leadsService.fetchLeads({ page, limit, search, startDate, endDate }),
    extractRows: (resp) => resp.leads || [],
    extractTotal: (resp) => resp.total || 0,
    extractTotalPages: (resp) => resp.totalPages || 1,
    columns: [
      { key: 'createdAt', label: 'Criado em', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'data', label: 'Data', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'hora', label: 'Hora', width: 70, render: (v, row) => {
        // O campo `hora` vem em UTC. Deriva da hora local a partir de createdAt/data.
        const iso = row?.createdAt || row?.data
        if (iso) {
          const d = new Date(iso)
          if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
        return v || '—'
      }},
      { key: 'nomeCompleto', label: 'Nome', width: 180 },
      { key: 'email', label: 'Email', width: 220 },
      { key: 'telefone', label: 'Telefone', width: 130 },
      { key: 'source', label: 'UTM Source', width: 130 },
      { key: 'medium', label: 'UTM Medium', width: 150 },
      { key: 'campaign', label: 'UTM Campaign', width: 280 },
      { key: 'content', label: 'UTM Content', width: 200 },
      { key: 'term', label: 'UTM Term', width: 100 },
      { key: 'leadScore', label: 'Lead Score', width: 90, align: 'right' },
      { key: 'decil', label: 'Decil', width: 70, align: 'center' },
      { key: 'pesquisa.idade', label: 'Idade', width: 110 },
      { key: 'pesquisa.genero', label: 'Gênero', width: 100 },
      { key: 'pesquisa.ocupacao', label: 'Ocupação', width: 200 },
      { key: 'pesquisa.faixaSalarial', label: 'Faixa Salarial', width: 200 },
      { key: 'pesquisa.faculdade', label: 'Faculdade', width: 90 },
      { key: 'pesquisa.computador', label: 'Computador', width: 100 },
      { key: 'pesquisa.cartaoCredito', label: 'Cartão Crédito', width: 110 },
      { key: 'pesquisa.estudouProgramacao', label: 'Estudou Prog.', width: 120 },
      { key: 'pesquisa.estudouIA', label: 'Estudou IA', width: 100 },
      { key: 'pesquisa.investiuCurso', label: 'Investiu Curso', width: 120 },
      { key: 'pesquisa.investimento', label: 'Investimento', width: 110 },
      { key: 'pesquisa.urgencia', label: 'Urgência', width: 110 },
      { key: 'pesquisa.interesseEvento', label: 'Interesse Evento', width: 240 },
      { key: 'pesquisa.atracaoProfissao', label: 'Atração Profissão', width: 240 },
      { key: 'pesquisa.barreira', label: 'Barreira', width: 200 },
      { key: 'pesquisa.porqueGestor', label: 'Por que Gestor', width: 200 },
      { key: 'capiSentAt', label: 'CAPI Enviado', width: 150, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'capiStatus', label: 'CAPI Status', width: 110 },
      { key: 'remoteIp', label: 'IP', width: 130 },
      { key: 'pageUrl', label: 'Page URL', width: 280 },
    ],
  },
  activecampaign: {
    id: 'activecampaign',
    label: 'ActiveCampaign',
    icon: FaEnvelope,
    color: 'from-emerald-500 to-teal-500',
    description: 'Contatos novos no AC (proxy backend)',
    fetcher: async ({ page, limit, search, startDate, endDate }) =>
      activeCampaignService.getContacts({ page, limit, search, startDate, endDate }),
    extractRows: (resp) => resp.data || [],
    extractTotal: (resp) => resp.total || 0,
    extractTotalPages: (resp) => resp.totalPages || 1,
    columns: [
      { key: 'cdate', label: 'Criado em', width: 160, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'udate', label: 'Atualizado em', width: 160, render: (v) => v ? new Date(v).toLocaleString('pt-BR') : '—' },
      { key: 'email', label: 'Email', width: 240 },
      { key: 'firstName', label: 'Nome', width: 130 },
      { key: 'lastName', label: 'Sobrenome', width: 130 },
      { key: 'phone', label: 'Telefone', width: 130 },
      { key: 'id', label: 'ID', width: 80 },
      { key: 'orgname', label: 'Organização', width: 140 },
    ],
  },
}

// Helper para acessar valor por path "a.b.c"
const getValue = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

// API cap rígido em 100 — valores acima retornam 400. "Tudo" pagina internamente.
const PAGE_SIZES = [25, 50, 100, 'all']
const PAGE_SIZE_LABELS = { 25: '25', 50: '50', 100: '100', all: 'Tudo' }
const ALL_MAX_RECORDS = 20000 // Máximo absoluto para não travar o navegador
const ALL_INTERNAL_LIMIT = 100 // Cap da API
const STORAGE_KEY = 'data-explorer-state'

// ====== Date helpers ======
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysAgoStr = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PERIOD_PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Personalizado' },
]

const resolveRange = (preset, customStart, customEnd) => {
  switch (preset) {
    case 'today': return { startDate: todayStr(), endDate: todayStr() }
    case 'yesterday': return { startDate: daysAgoStr(1), endDate: daysAgoStr(1) }
    case '7d': return { startDate: daysAgoStr(6), endDate: todayStr() }
    case '30d': return { startDate: daysAgoStr(29), endDate: todayStr() }
    case '90d': return { startDate: daysAgoStr(89), endDate: todayStr() }
    case 'all': return { startDate: '', endDate: '' }
    case 'custom': return { startDate: customStart || '', endDate: customEnd || '' }
    default: return { startDate: todayStr(), endDate: todayStr() }
  }
}

// CSV export
const toCsv = (rows, columns) => {
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const header = columns.map(c => escape(c.label)).join(',')
  const lines = rows.map(r =>
    columns.map(c => {
      const raw = getValue(r, c.key)
      const v = c.render ? c.render(raw, r) : raw
      return escape(typeof v === 'object' ? JSON.stringify(v) : v)
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

const downloadCsv = (filename, content) => {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ====== Componente principal ======
const DataExplorer = () => {
  // ---- estado restaurado do localStorage
  const initial = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
  })()

  const [sourceId, setSourceId] = useState(initial.sourceId || 'survey')
  const [periodPreset, setPeriodPreset] = useState(initial.periodPreset || 'today')
  const [customStart, setCustomStart] = useState(initial.customStart || '')
  const [customEnd, setCustomEnd] = useState(initial.customEnd || '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initial.pageSize || 50)
  const [hiddenCols, setHiddenCols] = useState(initial.hiddenCols || {})
  const [columnFilters, setColumnFilters] = useState({})
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'desc' })
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const [allLoadProgress, setAllLoadProgress] = useState(null) // { loaded, total, pages }

  // ---- Persistência
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sourceId, periodPreset, customStart, customEnd, pageSize, hiddenCols,
    }))
  }, [sourceId, periodPreset, customStart, customEnd, pageSize, hiddenCols])

  // ---- Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page quando filtros mudam
  useEffect(() => { setPage(1) }, [sourceId, periodPreset, customStart, customEnd, debouncedSearch, pageSize])

  const source = SOURCES[sourceId]
  const range = useMemo(() => resolveRange(periodPreset, customStart, customEnd), [periodPreset, customStart, customEnd])

  // ---- Fetch
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Modo "Tudo": pagina internamente até esgotar (com cap em ALL_MAX_RECORDS)
    if (pageSize === 'all') {
      const all = []
      let p = 1
      let totalReported = 0
      let totalPagesReported = 1
      setAllLoadProgress({ loaded: 0, total: 0, pages: 0 })
      try {
        while (all.length < ALL_MAX_RECORDS) {
          const resp = await source.fetcher({
            page: p, limit: ALL_INTERNAL_LIMIT, search: debouncedSearch || undefined,
            startDate: range.startDate || undefined, endDate: range.endDate || undefined,
          })
          const rows = source.extractRows(resp) || []
          totalReported = Number(source.extractTotal(resp)) || 0
          totalPagesReported = totalReported > 0 ? Math.ceil(totalReported / ALL_INTERNAL_LIMIT) : 1
          all.push(...rows)
          setAllLoadProgress({ loaded: all.length, total: totalReported, pages: p })
          if (rows.length < ALL_INTERNAL_LIMIT) break
          if (p >= totalPagesReported) break
          p++
        }
        setData({ rows: all, total: totalReported || all.length, totalPages: 1 })
      } catch (err) {
        setError(err?.response?.data?.message || err.message)
        setData({ rows: all, total: totalReported || all.length, totalPages: 1 })
      } finally {
        setAllLoadProgress(null)
        setLoading(false)
      }
      return
    }

    try {
      const resp = await source.fetcher({
        page, limit: pageSize, search: debouncedSearch || undefined,
        startDate: range.startDate || undefined, endDate: range.endDate || undefined,
      })
      setData({
        rows: source.extractRows(resp),
        total: source.extractTotal(resp),
        totalPages: source.extractTotalPages(resp),
      })
    } catch (err) {
      setError(err?.response?.data?.message || err.message)
      setData({ rows: [], total: 0, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }, [source, page, pageSize, debouncedSearch, range.startDate, range.endDate])

  useEffect(() => { load() }, [load])

  // ---- Filtragem client-side por coluna + sort
  const filteredRows = useMemo(() => {
    let arr = data.rows
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v && v.trim())
    if (activeFilters.length) {
      arr = arr.filter((row) =>
        activeFilters.every(([key, value]) => {
          const raw = getValue(row, key)
          const str = (raw == null ? '' : String(raw)).toLowerCase()
          return str.includes(value.toLowerCase())
        })
      )
    }
    if (sortConfig.key) {
      arr = [...arr].sort((a, b) => {
        const av = getValue(a, sortConfig.key)
        const bv = getValue(b, sortConfig.key)
        const dir = sortConfig.dir === 'asc' ? 1 : -1
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av).localeCompare(String(bv), 'pt-BR') * dir
      })
    }
    return arr
  }, [data.rows, columnFilters, sortConfig])

  const visibleColumns = useMemo(() => source.columns.filter(c => !hiddenCols[c.key]), [source.columns, hiddenCols])

  const toggleSort = (key) =>
    setSortConfig(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const sortIcon = (key) => sortConfig.key !== key ? null : (sortConfig.dir === 'asc' ? <FaSortUp className="inline ml-1 w-2.5 h-2.5" /> : <FaSortDown className="inline ml-1 w-2.5 h-2.5" />)

  const handleExport = () => {
    const csv = toCsv(filteredRows, visibleColumns)
    const dateStr = `${range.startDate || 'inicio'}_${range.endDate || 'fim'}`
    downloadCsv(`${source.id}_${dateStr}_p${page}.csv`, csv)
  }

  const clearFilters = () => { setColumnFilters({}); setSortConfig({ key: null, dir: 'desc' }); setSearch('') }

  const activeColFilters = Object.values(columnFilters).filter(v => v && v.trim()).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              to="/monitor"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary transition shadow-sm font-medium text-sm"
              title="Voltar para o Monitor de Tráfego"
            >
              <FaArrowLeft className="w-3.5 h-3.5" />
              <FaTachometerAlt className="w-3.5 h-3.5" />
              Voltar ao Monitor
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent flex items-center gap-3">
                <FaDatabase className="text-primary" />
                Explorador de Dados
              </h1>
              <p className="text-text-muted-light dark:text-text-muted-dark text-sm mt-1">
                Visualizador estilo planilha · {source.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => load()}
            className="p-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white shadow hover:shadow-lg transition"
            title="Recarregar"
          >
            <FaSync className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Seletor de fonte */}
        <section className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(SOURCES).map((s) => {
            const Icon = s.icon
            const active = sourceId === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSourceId(s.id)}
                className={`text-left p-4 rounded-xl border transition ${
                  active
                    ? 'bg-white dark:bg-[#141419] border-primary shadow-lg shadow-primary/10'
                    : 'bg-white/50 dark:bg-[#141419]/50 border-gray-200 dark:border-[#27272a] hover:bg-white dark:hover:bg-[#141419]'
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <Icon className="text-white w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm">{s.label}</span>
                </div>
                <p className="text-[11px] text-gray-500">{s.description}</p>
              </button>
            )
          })}
        </section>

        {/* Filtros */}
        <section className="mb-4 bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 uppercase font-semibold mr-1">Período:</span>
            {PERIOD_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  periodPreset === p.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-[#0a0a0c] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#27272a] hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >{p.label}</button>
            ))}
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-1 ml-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none" />
                <span className="text-gray-400">→</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none" />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busca global (server-side)..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => {
                const v = e.target.value
                setPageSize(v === 'all' ? 'all' : parseInt(v, 10))
                setPage(1)
              }}
              className="px-2 py-2 rounded-lg text-xs bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none"
            >
              {PAGE_SIZES.map(s => <option key={s} value={s}>{PAGE_SIZE_LABELS[s]}{s === 'all' ? '' : ' / pág'}</option>)}
            </select>

            <div className="relative">
              <button
                onClick={() => setShowColumnsMenu(s => !s)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
              >
                <FaColumns className="w-3 h-3" />
                Colunas ({visibleColumns.length}/{source.columns.length})
              </button>
              {showColumnsMenu && (
                <div className="absolute right-0 mt-1 w-64 max-h-96 overflow-y-auto bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-xl shadow-2xl z-30 p-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 dark:border-[#27272a]">
                    <span className="text-xs font-bold">Colunas visíveis</span>
                    <button onClick={() => setHiddenCols({})} className="text-[10px] text-primary hover:underline">Mostrar todas</button>
                  </div>
                  {source.columns.map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={!hiddenCols[c.key]}
                        onChange={() => setHiddenCols(h => ({ ...h, [c.key]: !h[c.key] }))}
                        className="w-3.5 h-3.5"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {(activeColFilters > 0 || sortConfig.key || search) && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-1"
              >
                <FaTimes className="w-2.5 h-2.5" />
                Limpar ({activeColFilters + (sortConfig.key ? 1 : 0) + (search ? 1 : 0)})
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={loading || !filteredRows.length}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FaDownload className="w-3 h-3" />
              CSV
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-3 flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            {loading && allLoadProgress ? (
              <>
                <FaSpinner className="inline animate-spin mr-2 text-primary" />
                Carregando tudo: <span className="font-semibold text-text-light dark:text-text-dark">{allLoadProgress.loaded.toLocaleString('pt-BR')}</span>
                {allLoadProgress.total > 0 && <> / {allLoadProgress.total.toLocaleString('pt-BR')}</>}
                {' · '}{allLoadProgress.pages} {allLoadProgress.pages === 1 ? 'página' : 'páginas'}
              </>
            ) : loading ? 'Carregando...' : (
              <>
                <span className="font-semibold text-text-light dark:text-text-dark">{(data.total || 0).toLocaleString('pt-BR')}</span> registros totais
                {pageSize === 'all' && data.rows.length > 0 && (
                  <> · <span className="font-semibold text-emerald-600">{(data.rows?.length || 0).toLocaleString('pt-BR')}</span> carregados</>
                )}
                {filteredRows.length !== data.rows.length && (
                  <> · <span className="font-semibold">{filteredRows.length.toLocaleString('pt-BR')}</span> após filtros</>
                )}
                {pageSize !== 'all' && (
                  <>{' · '}Página <span className="font-semibold">{page}</span> / {data.totalPages || 1}</>
                )}
                {pageSize === 'all' && data.total > ALL_MAX_RECORDS && (
                  <span className="ml-2 text-amber-600">
                    ⚠ truncado em {ALL_MAX_RECORDS.toLocaleString('pt-BR')} registros (limite p/ não travar o navegador)
                  </span>
                )}
              </>
            )}
          </span>
          {error && <span className="text-rose-500 truncate max-w-[400px]">{error}</span>}
        </section>

        {/* Tabela */}
        <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
            <table className="text-xs">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-bold w-12 border-b border-gray-200 dark:border-[#27272a]">#</th>
                  {visibleColumns.map(c => (
                    <th
                      key={c.key}
                      style={{ minWidth: c.width || 120 }}
                      className="px-3 py-2 text-left font-bold border-b border-gray-200 dark:border-[#27272a] cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                      onClick={() => toggleSort(c.key)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{c.label}</span>
                        {sortIcon(c.key)}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-white dark:bg-[#0a0a0c]">
                  <th className="px-2 py-1 border-b border-gray-200 dark:border-[#27272a]"></th>
                  {visibleColumns.map(c => (
                    <th key={c.key} className="px-2 py-1 border-b border-gray-200 dark:border-[#27272a]">
                      <input
                        value={columnFilters[c.key] || ''}
                        onChange={(e) => setColumnFilters(f => ({ ...f, [c.key]: e.target.value }))}
                        placeholder="filtrar..."
                        className="w-full px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-[#27272a] bg-white dark:bg-[#141419] outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={visibleColumns.length + 1} className="text-center py-12">
                    <FaSpinner className="inline animate-spin mr-2" />Carregando...
                  </td></tr>
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 1} className="text-center py-12 text-gray-400">
                    Nenhum registro encontrado
                  </td></tr>
                )}
                {!loading && filteredRows.map((row, i) => (
                  <tr key={row.id || row.email || i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 border-b border-gray-100 dark:border-[#27272a]">
                    <td className="px-2 py-1.5 text-gray-400 text-[10px] tabular-nums">{(page - 1) * pageSize + i + 1}</td>
                    {visibleColumns.map(c => {
                      const raw = getValue(row, c.key)
                      const v = c.render ? c.render(raw, row) : raw
                      const display = v == null || v === '' ? <span className="text-gray-300">—</span>
                        : typeof v === 'object' ? <code className="text-[10px]">{JSON.stringify(v).slice(0, 100)}</code>
                        : String(v)
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-1.5 truncate ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                          style={{ maxWidth: c.width || 200 }}
                          title={typeof v === 'string' ? v : undefined}
                        >
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação (oculta em modo Tudo) */}
          {pageSize !== 'all' ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#27272a] text-xs">
              <span className="text-gray-500">
                {(data.total || 0).toLocaleString('pt-BR')} registros · Página {page} / {data.totalPages || 1}
              </span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30 text-[10px]">
                  início
                </button>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                  <FaChevronLeft className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={data.totalPages || 1}
                  value={page}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (!isNaN(n) && n >= 1 && n <= (data.totalPages || 1)) setPage(n)
                  }}
                  className="w-14 px-2 py-1 text-center rounded border border-gray-200 dark:border-[#27272a] bg-white dark:bg-[#141419] outline-none"
                />
                <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                  <FaChevronRight className="w-3 h-3" />
                </button>
                <button disabled={page >= data.totalPages} onClick={() => setPage(data.totalPages)} className="px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30 text-[10px]">
                  fim
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#27272a] text-xs">
              <span className="text-gray-500">
                Modo "Tudo": <span className="font-semibold text-emerald-600">{(data.rows?.length || 0).toLocaleString('pt-BR')}</span> registros carregados
                {filteredRows.length !== data.rows.length && (
                  <> · <span className="font-semibold">{filteredRows.length.toLocaleString('pt-BR')}</span> após filtros</>
                )}
              </span>
              <span className="text-gray-400 text-[10px]">use o CSV pra exportar tudo</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default DataExplorer
