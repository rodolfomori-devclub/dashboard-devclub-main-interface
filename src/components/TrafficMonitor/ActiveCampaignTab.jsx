import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FaEnvelope, FaList, FaSearch, FaSpinner, FaChevronLeft, FaChevronRight,
  FaExclamationTriangle, FaUserPlus, FaDatabase, FaSortUp, FaSortDown,
  FaFilter, FaTimes,
} from 'react-icons/fa'
import { formatNumber, periodLabel } from './utils'
import { activeCampaignService } from '../../services/activeCampaignService'

const PAGE_SIZE = 25

const ActiveCampaignTab = ({ periodFilters, filters }) => {
  const [summary, setSummary] = useState(null)
  const [dailySeries, setDailySeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtro por lista (fica nessa aba — não é global)
  const [selectedListId, setSelectedListId] = useState('')

  // Snapshot table
  const [snapshotSearch, setSnapshotSearch] = useState('')
  const [snapshotSort, setSnapshotSort] = useState({ key: 'totalSubscribers', dir: 'desc' })

  // Contacts table
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsSearch, setContactsSearch] = useState('')
  const [contactsData, setContactsData] = useState({ data: [], total: 0, totalPages: 0 })
  const [contactsLoading, setContactsLoading] = useState(false)

  // ============ load summary + series quando período/lista mudam ============
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      activeCampaignService.getListsSummary({
        startDate: periodFilters.startDate, endDate: periodFilters.endDate,
      }),
      activeCampaignService.getDailySeries({
        startDate: periodFilters.startDate, endDate: periodFilters.endDate,
        listId: selectedListId || undefined,
      }),
    ])
      .then(([s, d]) => {
        if (cancelled) return
        setSummary(s?.data || null)
        setDailySeries(d?.data || [])
      })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [periodFilters.startDate, periodFilters.endDate, selectedListId])

  // ============ contacts table ============
  useEffect(() => {
    let cancelled = false
    setContactsLoading(true)
    activeCampaignService.getContacts({
      startDate: periodFilters.startDate,
      endDate: periodFilters.endDate,
      listId: selectedListId || undefined,
      page: contactsPage,
      limit: PAGE_SIZE,
      search: contactsSearch || undefined,
    })
      .then((d) => { if (!cancelled) setContactsData(d) })
      .catch(() => { if (!cancelled) setContactsData({ data: [], total: 0, totalPages: 0 }) })
      .finally(() => { if (!cancelled) setContactsLoading(false) })
    return () => { cancelled = true }
  }, [contactsPage, contactsSearch, selectedListId, periodFilters.startDate, periodFilters.endDate])

  // Reset paginação quando filtro de lista muda
  useEffect(() => { setContactsPage(1) }, [selectedListId, contactsSearch])

  // ============ derivações ============
  const allLists = summary?.allLists || []
  const activeLists = useMemo(() => allLists.filter(l => l.newInPeriod > 0), [allLists])
  const filteredSnapshot = useMemo(() => {
    let arr = allLists
    if (snapshotSearch) {
      const q = snapshotSearch.toLowerCase()
      arr = arr.filter(l => l.listName.toLowerCase().includes(q))
    }
    return [...arr].sort((a, b) => {
      const k = snapshotSort.key
      const dir = snapshotSort.dir === 'asc' ? 1 : -1
      const av = typeof a[k] === 'string' ? a[k].toLowerCase() : a[k]
      const bv = typeof b[k] === 'string' ? b[k].toLowerCase() : b[k]
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [allLists, snapshotSearch, snapshotSort])

  const newInPeriodKpi = selectedListId
    ? (allLists.find(l => l.listId === String(selectedListId))?.newInPeriod || 0)
    : (summary?.totalContacts || 0)

  const selectedList = selectedListId ? allLists.find(l => l.listId === String(selectedListId)) : null

  const toggleSort = (k) => setSnapshotSort(s => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))
  const sortIcon = (k) => snapshotSort.key !== k ? null : (snapshotSort.dir === 'asc' ? <FaSortUp className="inline ml-1 w-2.5 h-2.5" /> : <FaSortDown className="inline ml-1 w-2.5 h-2.5" />)

  // BarChart contatos novos por lista (no período)
  const barData = useMemo(() => activeLists.slice(0, 15).map(l => ({
    name: l.listName, value: l.newInPeriod,
  })), [activeLists])

  // BarChart top listas por total atual (snapshot)
  const snapshotBarData = useMemo(() => allLists.slice(0, 15).map(l => ({
    name: l.listName, value: l.totalSubscribers,
  })), [allLists])

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <FaSpinner className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-gray-500">Carregando ActiveCampaign...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-6 flex items-center gap-3">
        <FaExclamationTriangle className="text-rose-500 w-5 h-5" />
        <div>
          <p className="font-semibold text-rose-700 dark:text-rose-300">Erro ao carregar ActiveCampaign</p>
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtro de lista (afeta SÓ esta aba) */}
      <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <FaFilter className="text-gray-400 w-3.5 h-3.5" />
        <span className="text-xs text-gray-500 uppercase font-semibold">Filtrar por lista:</span>
        <select
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30 min-w-[260px]"
        >
          <option value="">Todas as listas ({formatNumber(summary?.totalLists || 0)})</option>
          <optgroup label={`Com novos no período (${activeLists.length})`}>
            {activeLists.map(l => (
              <option key={l.listId} value={l.listId}>{l.listName} (+{l.newInPeriod})</option>
            ))}
          </optgroup>
          <optgroup label={`Outras listas (${allLists.length - activeLists.length})`}>
            {allLists.filter(l => l.newInPeriod === 0).map(l => (
              <option key={l.listId} value={l.listId}>{l.listName} · {formatNumber(l.totalSubscribers)} subs</option>
            ))}
          </optgroup>
        </select>
        {selectedListId && (
          <button
            onClick={() => setSelectedListId('')}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          >
            <FaTimes className="w-2.5 h-2.5" />
            Limpar
          </button>
        )}
        {selectedList && (
          <span className="ml-auto text-xs text-gray-500">
            <span className="font-semibold text-text-light dark:text-text-dark">{formatNumber(selectedList.totalSubscribers)}</span> subscribers totais ·
            <span className="ml-1 font-semibold text-emerald-600">+{selectedList.newInPeriod}</span> no período
          </span>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox
          icon={FaUserPlus}
          label={selectedListId ? 'Novos nesta lista' : 'Novos no período'}
          value={formatNumber(newInPeriodKpi)}
          color="from-emerald-500 to-teal-500"
          sub={periodLabel(filters)}
        />
        <KpiBox
          icon={FaList}
          label="Listas com novos"
          value={formatNumber(activeLists.length)}
          color="from-purple-500 to-fuchsia-500"
          sub={`de ${formatNumber(summary?.totalLists || 0)} totais`}
        />
        <KpiBox
          icon={FaDatabase}
          label={selectedListId ? 'Subscribers da lista' : 'Total subscribers'}
          value={formatNumber(selectedList ? selectedList.totalSubscribers : (summary?.grandTotalSubscribers || 0))}
          color="from-blue-500 to-cyan-500"
          sub={selectedListId ? null : 'soma de todas as listas'}
        />
        <KpiBox
          icon={FaEnvelope}
          label="Listas totais"
          value={formatNumber(summary?.totalLists || 0)}
          color="from-amber-500 to-orange-500"
          sub="cadastradas no AC"
        />
      </section>

      {/* Série diária */}
      <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <FaUserPlus className="text-emerald-500" />
          Contatos novos por dia {selectedListId && <span className="text-gray-500 font-normal">· {selectedList?.listName}</span>}
        </h3>
        {dailySeries.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries.map(d => {
                const [, m, day] = d.date.split('-')
                return { date: `${day}/${m}`, total: d.total }
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="total" name="Novos contatos" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty msg="Sem novos contatos no período" />}
      </section>

      {/* BarChart: novos por lista */}
      {!selectedListId && barData.length > 0 && (
        <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <FaList className="text-purple-500" />
            Novos contatos por lista (top 15)
          </h3>
          <div style={{ height: Math.max(280, barData.length * 30 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 100, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={170} interval={0} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 shadow-xl text-xs min-w-[200px] max-w-[340px]">
                        <p className="font-bold mb-2 break-words border-b border-gray-200 dark:border-gray-700 pb-1.5">{d.name}</p>
                        <div className="flex justify-between gap-3 py-0.5">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" />Contatos novos</span>
                          <span className="font-bold">{formatNumber(d.value)}</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" name="Contatos novos" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Tabela: snapshot total por lista (para conferir com banco) */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaDatabase className="text-blue-500" />
            Snapshot atual por lista (para comparar com banco)
          </h2>
          <div className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              value={snapshotSearch}
              onChange={(e) => setSnapshotSearch(e.target.value)}
              placeholder="Buscar lista..."
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30 w-56"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 cursor-pointer hover:text-primary" onClick={() => toggleSort('listName')}>Lista{sortIcon('listName')}</th>
                  <th className="text-right py-2 px-3 cursor-pointer hover:text-primary" onClick={() => toggleSort('totalSubscribers')}>Total{sortIcon('totalSubscribers')}</th>
                  <th className="text-right py-2 px-3 cursor-pointer hover:text-primary" onClick={() => toggleSort('activeSubscribers')}>Ativos{sortIcon('activeSubscribers')}</th>
                  <th className="text-right py-2 px-3 cursor-pointer hover:text-primary" onClick={() => toggleSort('newInPeriod')}>Novos no período{sortIcon('newInPeriod')}</th>
                  <th className="text-left py-2 px-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredSnapshot.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhuma lista encontrada</td></tr>
                )}
                {filteredSnapshot.map((l) => {
                  const isSelected = selectedListId === l.listId
                  return (
                    <tr
                      key={l.listId}
                      className={`border-t border-gray-100 dark:border-[#27272a] cursor-pointer transition ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      onClick={() => setSelectedListId(isSelected ? '' : l.listId)}
                    >
                      <td className="py-2 px-3 font-medium truncate max-w-[400px]" title={l.listName}>{l.listName}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatNumber(l.totalSubscribers)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatNumber(l.activeSubscribers)}</td>
                      <td className="py-2 px-3 text-right">
                        {l.newInPeriod > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            +{l.newInPeriod}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-400 font-mono text-[10px]">{l.listId}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-[#27272a] text-xs text-gray-500 flex justify-between">
            <span>{formatNumber(filteredSnapshot.length)} listas exibidas · Total geral: <span className="font-semibold">{formatNumber(filteredSnapshot.reduce((s, l) => s + l.totalSubscribers, 0))}</span> subscribers</span>
            <span className="text-gray-400">Click numa linha para filtrar</span>
          </div>
        </div>
      </section>

      {/* Tabela contatos novos */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaEnvelope className="text-emerald-500" />
            Contatos novos no período {selectedList && <span className="text-gray-500 font-normal text-sm">· {selectedList.listName}</span>}
          </h2>
          <div className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              value={contactsSearch}
              onChange={(e) => setContactsSearch(e.target.value)}
              placeholder="Buscar contato (email/nome)..."
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30 w-64"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Nome</th>
                  <th className="text-left py-2 px-3">Telefone</th>
                  <th className="text-left py-2 px-3">Criado em</th>
                  <th className="text-right py-2 px-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {contactsLoading && (
                  <tr><td colSpan={5} className="text-center py-8"><FaSpinner className="inline animate-spin mr-2" />Carregando...</td></tr>
                )}
                {!contactsLoading && (contactsData.data || []).map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-[#27272a] hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-3 truncate max-w-[260px]" title={c.email}>{c.email}</td>
                    <td className="py-2 px-3 truncate max-w-[180px]">{c.firstName || ''} {c.lastName || ''}</td>
                    <td className="py-2 px-3">{c.phone || '—'}</td>
                    <td className="py-2 px-3 text-gray-500">{c.cdate ? new Date(c.cdate).toLocaleString('pt-BR') : '—'}</td>
                    <td className="py-2 px-3 text-right text-gray-400 font-mono text-[10px]">{c.id}</td>
                  </tr>
                ))}
                {!contactsLoading && (!contactsData.data || contactsData.data.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum contato</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#27272a] text-xs">
            <span className="text-gray-500">{formatNumber(contactsData.total || 0)} registros</span>
            <div className="flex items-center gap-2">
              <button disabled={contactsPage <= 1} onClick={() => setContactsPage(p => p - 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                <FaChevronLeft className="w-3 h-3" />
              </button>
              <span>Página {contactsPage} / {contactsData.totalPages || 1}</span>
              <button disabled={contactsPage >= (contactsData.totalPages || 1)} onClick={() => setContactsPage(p => p + 1)} className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-30">
                <FaChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const KpiBox = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}><Icon className="text-white w-3.5 h-3.5" /></div>
      <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
  </div>
)

const Empty = ({ msg = 'sem dados' }) => <div className="h-56 flex items-center justify-center text-xs text-gray-400">{msg}</div>

export default ActiveCampaignTab
