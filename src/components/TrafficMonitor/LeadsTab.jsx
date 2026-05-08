import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  FaUsers, FaTags, FaSearch, FaSpinner,
  FaSortUp, FaSortDown, FaTimes, FaDownload, FaChevronLeft, FaChevronRight, FaHistory,
} from 'react-icons/fa'
import { formatNumber, formatPercent, groupByDay, CHART_COLORS } from './utils'
import { leadsService } from '../../services/leadsService'

const PAGE_SIZE = 20

const LeadsTab = ({ allClients, tagsMetrics, periodFilters, filters, onApplyFilter, loading }) => {
  // Tabela paginada server-side
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [tableData, setTableData] = useState({ clients: [], total: 0, totalPages: 0 })
  const [tableLoading, setTableLoading] = useState(false)
  const [drawerEmail, setDrawerEmail] = useState(null)
  const [activities, setActivities] = useState(null)
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setTableLoading(true)
    leadsService.fetchClients({
      page, limit: PAGE_SIZE, search: debouncedSearch,
      startDate: periodFilters.startDate, endDate: periodFilters.endDate,
      utmSource: filters.utmSources?.length ? filters.utmSources.join(',') : undefined,
      utmMedium: filters.utmMediums?.length ? filters.utmMediums.join(',') : undefined,
      utmCampaign: filters.utmCampaigns?.length ? filters.utmCampaigns.join(',') : undefined,
      tags: filters.tags?.length ? filters.tags.join(',') : undefined,
      orderBy: sortBy, order: sortDir,
    })
      .then((d) => { if (!cancelled) setTableData(d) })
      .catch(() => { if (!cancelled) setTableData({ clients: [], total: 0, totalPages: 0 }) })
      .finally(() => { if (!cancelled) setTableLoading(false) })
    return () => { cancelled = true }
  }, [page, debouncedSearch, sortBy, sortDir, periodFilters.startDate, periodFilters.endDate, JSON.stringify(filters.utmSources), JSON.stringify(filters.utmMediums), JSON.stringify(filters.utmCampaigns), JSON.stringify(filters.tags)])

  const openDrawer = async (email) => {
    setDrawerEmail(email)
    setActivitiesLoading(true)
    try {
      const data = await leadsService.fetchClientActivities(email)
      setActivities(data)
    } catch {
      setActivities(null)
    } finally {
      setActivitiesLoading(false)
    }
  }

  // Agregações
  const firstSeenSeries = useMemo(() => {
    const byDay = groupByDay(allClients, (c) => c.firstSeenAt)
    return Object.entries(byDay).sort().map(([d, v]) => {
      const [, m, day] = d.split('-')
      return { date: `${day}/${m}`, count: v }
    })
  }, [allClients])

  const lastActivitySeries = useMemo(() => {
    const byDay = groupByDay(allClients, (c) => c.lastActivityAt)
    return Object.entries(byDay).sort().map(([d, v]) => {
      const [, m, day] = d.split('-')
      return { date: `${day}/${m}`, count: v }
    })
  }, [allClients])

  const activitiesHist = useMemo(() => {
    const buckets = { '0-1': 0, '2-5': 0, '6-10': 0, '11-25': 0, '26+': 0 }
    for (const c of allClients) {
      const n = c._count?.activities ?? 0
      if (n <= 1) buckets['0-1']++
      else if (n <= 5) buckets['2-5']++
      else if (n <= 10) buckets['6-10']++
      else if (n <= 25) buckets['11-25']++
      else buckets['26+']++
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [allClients])

  const utmTrackingHist = useMemo(() => {
    const buckets = { '0-1': 0, '2-3': 0, '4-7': 0, '8-15': 0, '16+': 0 }
    for (const c of allClients) {
      const n = c._count?.utmTracking ?? 0
      if (n <= 1) buckets['0-1']++
      else if (n <= 3) buckets['2-3']++
      else if (n <= 7) buckets['4-7']++
      else if (n <= 15) buckets['8-15']++
      else buckets['16+']++
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [allClients])

  const topTags = useMemo(() => {
    const arr = tagsMetrics?.tagDistribution || []
    return arr.slice(0, 20).map(t => ({ name: t.tagName, value: t.count }))
  }, [tagsMetrics])

  const tagCategoryDist = useMemo(() => {
    const arr = tagsMetrics?.tagDistribution || []
    const map = {}
    for (const t of arr) {
      map[t.category || 'sem categoria'] = (map[t.category || 'sem categoria'] || 0) + t.count
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [tagsMetrics])

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  const sortIcon = (col) => sortBy !== col ? null : (sortDir === 'asc' ? <FaSortUp className="inline ml-1 w-2.5 h-2.5" /> : <FaSortDown className="inline ml-1 w-2.5 h-2.5" />)

  const exportCsv = () => {
    const url = `${import.meta.env.DEV ? '/leads-proxy' : import.meta.env.VITE_LEADS_API_URL}/leads/export?startDate=${periodFilters.startDate}&endDate=${periodFilters.endDate}`
    window.open(url, '_blank')
  }

  // Classifica clientes em novos vs recorrentes baseado em firstSeenAt vs período.
  // Novo = firstSeenAt dentro do período (1ª vez visto)
  // Recorrente = firstSeenAt antes do período (já existia)
  const splitNovosRecorrentes = useMemo(() => {
    const start = periodFilters?.startDate || ''
    let novos = 0, recorrentes = 0
    for (const c of allClients) {
      const fs = c.firstSeenAt
      if (!fs) { novos++; continue }
      const d = new Date(fs)
      if (isNaN(d.getTime())) { novos++; continue }
      const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (start && localDay < start) recorrentes++
      else novos++
    }
    const total = novos + recorrentes
    return {
      novos, recorrentes, total,
      pctNovos: total > 0 ? (novos / total) * 100 : 0,
      pctRecorrentes: total > 0 ? (recorrentes / total) * 100 : 0,
    }
  }, [allClients, periodFilters?.startDate])

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiBox icon={FaUsers} label="Total" value={formatNumber(allClients.length)} color="from-blue-500 to-cyan-500" />
        <KpiBox icon={FaTags} label="Total Tags" value={formatNumber(tagsMetrics?.tagDistribution?.length || 0)} color="from-amber-500 to-orange-500" />
        <KpiBox icon={FaTags} label="Avg activities" value={(() => {
          const arr = allClients.map(c => c._count?.activities ?? 0)
          return arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(1) : '0'
        })()} color="from-pink-500 to-rose-500" />
        <KpiBox icon={FaTags} label="Avg UTM tracking" value={(() => {
          const arr = allClients.map(c => c._count?.utmTracking ?? 0)
          return arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(1) : '0'
        })()} color="from-cyan-500 to-blue-500" />
      </section>

      {/* Split: novos vs recorrentes (baseado em firstSeenAt vs início do período) */}
      <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FaUsers className="text-blue-500" />
            Novos vs Recorrentes (por firstSeenAt)
          </h3>
          <span className="text-xs text-gray-500">total: <span className="font-semibold text-text-light dark:text-text-dark">{formatNumber(splitNovosRecorrentes.total)}</span> clientes no período</span>
        </div>
        {splitNovosRecorrentes.total > 0 ? (
          <>
            <div className="flex h-8 rounded-lg overflow-hidden mb-3 shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-end pr-3 text-white text-xs font-bold transition-all"
                style={{ width: `${splitNovosRecorrentes.pctNovos}%` }}
                title={`${formatNumber(splitNovosRecorrentes.novos)} novos`}
              >
                {splitNovosRecorrentes.pctNovos >= 12 && `${splitNovosRecorrentes.pctNovos.toFixed(1)}%`}
              </div>
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-start pl-3 text-white text-xs font-bold transition-all"
                style={{ width: `${splitNovosRecorrentes.pctRecorrentes}%` }}
                title={`${formatNumber(splitNovosRecorrentes.recorrentes)} recorrentes`}
              >
                {splitNovosRecorrentes.pctRecorrentes >= 12 && `${splitNovosRecorrentes.pctRecorrentes.toFixed(1)}%`}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Novos clientes</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {formatNumber(splitNovosRecorrentes.novos)} <span className="text-xs font-normal text-gray-500">({splitNovosRecorrentes.pctNovos.toFixed(1)}%)</span>
                  </p>
                  <p className="text-[10px] text-gray-400">primeiro contato no período</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Recorrentes</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {formatNumber(splitNovosRecorrentes.recorrentes)} <span className="text-xs font-normal text-gray-500">({splitNovosRecorrentes.pctRecorrentes.toFixed(1)}%)</span>
                  </p>
                  <p className="text-[10px] text-gray-400">já existiam antes (re-registraram)</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">Sem clientes no período</p>
        )}
      </section>

      {/* Time series */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="First Seen por dia (novos)">
          {firstSeenSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={firstSeenSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="count" name="Novos" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>
        <ChartCard title="Last Activity por dia (engajamento)">
          {lastActivitySeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lastActivitySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="count" name="Ativos" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>
      </section>

      {/* Histogramas + Categoria de Tags */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Distribuição de Activities">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activitiesHist}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição de UTM Tracking">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={utmTrackingHist}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Categoria das Tags">
          {tagCategoryDist.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tagCategoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} label={(e) => e.name}>
                  {tagCategoryDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>
      </section>

      {/* Top Tags */}
      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><FaTags className="text-amber-500" />Top 20 Tags</h2>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          {topTags.length ? (
            <div style={{ height: Math.max(384, topTags.length * 30 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTags} layout="vertical" margin={{ left: 200, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={300} interval={0} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 shadow-xl text-xs min-w-[200px] max-w-[400px]">
                          <p className="font-bold mb-2 break-words border-b border-gray-200 dark:border-gray-700 pb-1.5">{d.name}</p>
                          <div className="flex justify-between gap-3 py-0.5">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Subscribers</span>
                            <span className="font-bold">{formatNumber(d.value)}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" name="Subscribers" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </div>
      </section>

      {/* Tabela */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2"><FaUsers className="text-blue-500" />Lista de Clientes</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar nome / email / telefone..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30 w-64"
              />
            </div>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200">
              <FaDownload className="w-3 h-3" />
              CSV
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="text-left py-2 px-3 cursor-pointer" onClick={() => handleSort('email')}>Email{sortIcon('email')}</th>
                  <th className="text-left py-2 px-3 cursor-pointer" onClick={() => handleSort('firstName')}>Nome{sortIcon('firstName')}</th>
                  <th className="text-left py-2 px-3">Telefone</th>
                  <th className="text-left py-2 px-3 cursor-pointer" onClick={() => handleSort('firstSeenAt')}>First Seen{sortIcon('firstSeenAt')}</th>
                  <th className="text-left py-2 px-3 cursor-pointer" onClick={() => handleSort('lastActivityAt')}>Last Activity{sortIcon('lastActivityAt')}</th>
                  <th className="text-right py-2 px-3"># Atv</th>
                  <th className="text-right py-2 px-3"># UTM</th>
                  <th className="text-left py-2 px-3">Tags</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading && (
                  <tr><td colSpan={8} className="text-center py-8"><FaSpinner className="inline animate-spin mr-2" />Carregando...</td></tr>
                )}
                {!tableLoading && tableData.clients?.map((c) => (
                  <tr
                    key={c.email}
                    className="border-t border-gray-100 dark:border-[#27272a] hover:bg-primary/5 cursor-pointer"
                    onClick={() => openDrawer(c.email)}
                  >
                    <td className="py-2 px-3 font-medium truncate max-w-[200px]" title={c.email}>{c.email}</td>
                    <td className="py-2 px-3 truncate max-w-[120px]">{c.firstName} {c.lastName}</td>
                    <td className="py-2 px-3">{c.phone || '—'}</td>
                    <td className="py-2 px-3 text-gray-500">{c.firstSeenAt ? new Date(c.firstSeenAt).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="py-2 px-3 text-gray-500">{c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="py-2 px-3 text-right font-semibold">{c._count?.activities ?? 0}</td>
                    <td className="py-2 px-3 text-right font-semibold">{c._count?.utmTracking ?? 0}</td>
                    <td className="py-2 px-3">
                      {c.tags?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((t, i) => {
                            const label = typeof t === 'string' ? t
                              : (t.tag?.name || t.tag?.tag || t.tagName || t.name || (typeof t.tag === 'string' ? t.tag : ''))
                            return <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 truncate max-w-[100px]" title={String(label)}>{String(label)}</span>
                          })}
                          {c.tags.length > 2 && <span className="text-[10px] text-gray-400">+{c.tags.length - 2}</span>}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
                {!tableLoading && (!tableData.clients || tableData.clients.length === 0) && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhum lead encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#27272a] text-xs">
            <span className="text-gray-500">{formatNumber(tableData.total || 0)} registros</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                <FaChevronLeft className="w-3 h-3" />
              </button>
              <span>Página {page} / {tableData.totalPages || 1}</span>
              <button disabled={page >= (tableData.totalPages || 1)} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                <FaChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Drawer */}
      {drawerEmail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setDrawerEmail(null); setActivities(null) }} />
          <aside className="relative w-full max-w-md bg-white dark:bg-[#141419] shadow-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><FaHistory className="text-primary" />Atividades</h3>
              <button onClick={() => { setDrawerEmail(null); setActivities(null) }}><FaTimes /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 truncate">{drawerEmail}</p>
            {activitiesLoading ? <FaSpinner className="animate-spin mx-auto my-8" /> : (
              <div className="space-y-2">
                {(Array.isArray(activities) ? activities : activities?.activities || []).map((a, i) => (
                  <div key={i} className="border-l-2 border-primary/40 pl-3 py-1 text-xs">
                    <div className="font-semibold">{a.type || 'evento'}</div>
                    <div className="text-gray-500">{a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR') : '—'}</div>
                    {a.metadata && <pre className="mt-1 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(a.metadata, null, 2).slice(0, 500)}</pre>}
                  </div>
                ))}
                {(!activities || (Array.isArray(activities) ? activities.length === 0 : (activities.activities || []).length === 0)) && (
                  <p className="text-xs text-gray-400 text-center py-8">Nenhuma atividade registrada</p>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

const KpiBox = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-3 shadow-sm">
    <div className="flex items-center gap-2 mb-1">
      <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}><Icon className="text-white w-3 h-3" /></div>
      <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
    </div>
    <p className="text-xl font-bold">{value}</p>
  </div>
)

const ChartCard = ({ title, children }) => (
  <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
    <h3 className="text-sm font-bold mb-3">{title}</h3>
    <div className="h-56">{children}</div>
  </div>
)

const Empty = () => <div className="h-full flex items-center justify-center text-xs text-gray-400">sem dados</div>

export default LeadsTab
