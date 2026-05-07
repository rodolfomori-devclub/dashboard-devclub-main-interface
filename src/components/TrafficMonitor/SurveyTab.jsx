import React, { useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FaPoll, FaClock, FaPercent, FaSpinner, FaUserClock, FaTable, FaFileAlt } from 'react-icons/fa'
import {
  formatNumber, formatPercent, distributionFor, topNDistribution, weekdayHourHeatmap,
  leadScoreHistogram, PESQUISA_FIELDS, WEEKDAYS_PT, CHART_COLORS, groupByDay,
  filterByLocalDate,
} from './utils'

const TooltipBox = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const cat = payload[0]?.payload?.name
  return (
    <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-2 shadow-xl text-xs min-w-[160px] max-w-[320px]">
      {cat && <p className="font-bold mb-1 break-words">{cat}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-3 items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </span>
          <span className="font-bold">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Tooltip para BarChart horizontal com % + count
const HBarTooltipRich = ({ active, payload, valueLabel = 'Valor', extra }) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload || {}
  return (
    <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 shadow-xl text-xs min-w-[180px] max-w-[340px]">
      <p className="font-bold mb-2 break-words border-b border-gray-200 dark:border-gray-700 pb-1.5">{data.name}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-3 items-center py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500">{p.name || valueLabel}</span>
          </span>
          <span className="font-bold">{typeof p.value === 'number' && p.name?.includes('%') ? `${p.value}%` : formatNumber(p.value)}</span>
        </div>
      ))}
      {extra && extra(data)}
    </div>
  )
}

const MiniChart = ({ data, type = 'pie' }) => {
  if (!data || data.length === 0) return <div className="h-44 flex items-center justify-center text-xs text-gray-400">sem dados</div>
  if (type === 'bar') {
    const h = Math.max(176, data.length * 26 + 20)
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 60, top: 5, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} interval={0} />
            <RechartsTooltip content={<TooltipBox />} />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} label={(e) => e.value > 0 ? `${e.name.slice(0, 10)}` : ''}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <RechartsTooltip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

const SurveyTab = ({ allSurveyLeads, allClients, loading, periodFilters }) => {
  const [viewMode, setViewMode] = useState({}) // por campo: 'pie' | 'bar' | 'table'
  const [contentFilter, setContentFilter] = useState('') // filtro UTM Content (afeta SÓ esta aba)

  // Filtragem por timezone local + opcional por UTM Content
  const surveyLeadsByDate = useMemo(
    () => filterByLocalDate(allSurveyLeads, periodFilters?.startDate, periodFilters?.endDate, (l) => l.createdAt || l.data),
    [allSurveyLeads, periodFilters?.startDate, periodFilters?.endDate]
  )

  // Distribuição de UTM Content no período (com count + % do total)
  const contentDistribution = useMemo(() => {
    const map = {}
    let withContent = 0
    for (const l of surveyLeadsByDate) {
      const c = (l.content || '').trim()
      if (!c) continue
      map[c] = (map[c] || 0) + 1
      withContent++
    }
    const total = surveyLeadsByDate.length || 1
    return {
      total,
      withContent,
      withoutContent: total - withContent,
      items: Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          pct: +((count / total) * 100).toFixed(2),
          pctOfWithContent: +((count / Math.max(1, withContent)) * 100).toFixed(2),
        })),
    }
  }, [surveyLeadsByDate])

  // Opções (top 100) para o seletor de filtro
  const contentOptions = useMemo(
    () => contentDistribution.items.slice(0, 100),
    [contentDistribution]
  )

  const surveyLeads = useMemo(
    () => contentFilter ? surveyLeadsByDate.filter(l => (l.content || '') === contentFilter) : surveyLeadsByDate,
    [surveyLeadsByDate, contentFilter]
  )

  const clients = useMemo(
    () => filterByLocalDate(allClients, periodFilters?.startDate, periodFilters?.endDate, (c) => c.createdAt),
    [allClients, periodFilters?.startDate, periodFilters?.endDate]
  )

  const heatmap = useMemo(() => weekdayHourHeatmap(surveyLeads, (l) => l.createdAt || l.data), [surveyLeads])
  const heatMax = useMemo(() => heatmap.reduce((m, c) => Math.max(m, c.value), 0) || 1, [heatmap])

  const leadScoreHist = useMemo(() => leadScoreHistogram(surveyLeads, 10), [surveyLeads])

  const decilDist = useMemo(() => {
    const map = {}
    for (const l of surveyLeads) {
      if (l.decil === null || l.decil === undefined) continue
      const k = String(l.decil)
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name: `D${name}`, value, sortKey: parseInt(name, 10) })).sort((a, b) => a.sortKey - b.sortKey)
  }, [surveyLeads])

  const capiDist = useMemo(() => {
    const map = { 'Enviado': 0, 'Não enviado': 0, 'Erro': 0 }
    for (const l of surveyLeads) {
      if (l.capiSentAt) map['Enviado']++
      else if (l.capiStatus && l.capiStatus.toLowerCase().includes('error')) map['Erro']++
      else map['Não enviado']++
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0)
  }, [surveyLeads])

  const dailySeries = useMemo(() => {
    const surveyByDay = groupByDay(surveyLeads, (l) => l.createdAt || l.data)
    const clientsByDay = groupByDay(clients || [], (c) => c.createdAt)
    const days = new Set([...Object.keys(surveyByDay), ...Object.keys(clientsByDay)])
    return [...days].sort().map((d) => {
      const survey = surveyByDay[d] || 0
      const captados = clientsByDay[d] || 0
      const [, m, day] = d.split('-')
      return {
        date: `${day}/${m}`,
        respostas: survey,
        captados,
        taxa: captados > 0 ? +((survey / captados) * 100).toFixed(1) : 0,
      }
    })
  }, [surveyLeads, clients])

  // Cross-tabs: faixaSalarial × cartaoCredito; ocupacao × interesseEvento
  const crossTab = (kx, ky) => {
    const matrix = {}
    const xs = new Set()
    const ys = new Set()
    for (const l of surveyLeads) {
      const x = l.pesquisa?.[kx] || '—'
      const y = l.pesquisa?.[ky] || '—'
      xs.add(x); ys.add(y)
      const key = `${x}||${y}`
      matrix[key] = (matrix[key] || 0) + 1
    }
    const xArr = [...xs].slice(0, 8)
    const yArr = [...ys].slice(0, 8)
    return { matrix, xArr, yArr }
  }

  const ct1 = useMemo(() => crossTab('faixaSalarial', 'cartaoCredito'), [surveyLeads])
  const ct2 = useMemo(() => crossTab('ocupacao', 'interesseEvento'), [surveyLeads])

  if (loading && surveyLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <FaSpinner className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-gray-500">Carregando respostas de pesquisa...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Filtro UTM Content (afeta TODA a aba Pesquisa) */}
      <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500 uppercase font-semibold">Filtrar por UTM Content:</span>
        <select
          value={contentFilter}
          onChange={(e) => setContentFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#0a0a0c] border border-gray-200 dark:border-[#27272a] outline-none focus:ring-2 focus:ring-primary/30 min-w-[280px]"
        >
          <option value="">Todos ({contentOptions.reduce((s, o) => s + o.count, 0)} respostas)</option>
          {contentOptions.map(o => (
            <option key={o.name} value={o.name}>{o.name} ({o.count})</option>
          ))}
        </select>
        {contentFilter && (
          <button
            onClick={() => setContentFilter('')}
            className="px-2 py-1 rounded-md text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          >
            Limpar
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500">
          <span className="font-semibold text-text-light dark:text-text-dark">{surveyLeads.length}</span> respostas
          {contentFilter && <> filtradas de <span className="font-semibold">{surveyLeadsByDate.length}</span> totais no período</>}
        </span>
      </section>

      {/* Gráfico UTM Content × % das respostas no período */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaFileAlt className="text-amber-500" />
            UTM Content × % das respostas no período
          </h2>
          <span className="text-xs text-gray-500">
            <span className="font-semibold text-text-light dark:text-text-dark">{formatNumber(contentDistribution.withContent)}</span> com content
            {' · '}
            <span className="font-semibold">{formatNumber(contentDistribution.withoutContent)}</span> sem content
            {' · '}
            <span className="font-semibold">{contentDistribution.items.length}</span> distintos
          </span>
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          {contentDistribution.items.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                {(() => {
                  const items = contentDistribution.items.slice(0, 20)
                  const h = Math.max(280, items.length * 30 + 40)
                  return (
                    <div style={{ height: h }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={items} layout="vertical" margin={{ left: 100, right: 30, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            domain={[0, 'dataMax']}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 10 }}
                            width={180}
                            interval={0}
                          />
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 shadow-xl text-xs min-w-[200px] max-w-[340px]">
                                  <p className="font-bold mb-2 break-words border-b border-gray-200 dark:border-gray-700 pb-1.5">{d.name}</p>
                                  <div className="flex justify-between gap-3 py-0.5">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />% no período</span>
                                    <span className="font-bold text-amber-600">{d.pct}%</span>
                                  </div>
                                  <div className="flex justify-between gap-3 py-0.5">
                                    <span className="text-gray-500">Respostas</span>
                                    <span className="font-bold">{formatNumber(d.count)}</span>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar
                            dataKey="pct"
                            name="% no período"
                            fill="#f59e0b"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                            onClick={(data) => setContentFilter(data.name === contentFilter ? '' : data.name)}
                            cursor="pointer"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}
                <p className="text-[10px] text-gray-400 mt-2 text-center">Click numa barra para filtrar a aba inteira por aquele content</p>
              </div>
              <div className="overflow-y-auto max-h-[460px]">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b border-gray-200 dark:border-[#27272a] sticky top-0 bg-white dark:bg-[#141419]">
                    <tr>
                      <th className="text-left py-2 pr-2">UTM Content</th>
                      <th className="text-right py-2 px-1">Respostas</th>
                      <th className="text-right py-2 pl-1">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentDistribution.items.slice(0, 50).map((c) => {
                      const isSelected = c.name === contentFilter
                      return (
                        <tr
                          key={c.name}
                          className={`border-b border-gray-100 dark:border-[#27272a] cursor-pointer transition ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                          onClick={() => setContentFilter(isSelected ? '' : c.name)}
                        >
                          <td className="py-1.5 pr-2 truncate max-w-[180px]" title={c.name}>{c.name}</td>
                          <td className="text-right py-1.5 px-1 tabular-nums">{formatNumber(c.count)}</td>
                          <td className="text-right py-1.5 pl-1 tabular-nums font-semibold text-amber-600">{c.pct.toFixed(2)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="py-1.5 pr-2 font-bold text-gray-500">Total com content</td>
                      <td className="text-right py-1.5 px-1 font-bold tabular-nums">{formatNumber(contentDistribution.withContent)}</td>
                      <td className="text-right py-1.5 pl-1 font-bold text-amber-600 tabular-nums">{((contentDistribution.withContent / Math.max(1, contentDistribution.total)) * 100).toFixed(2)}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-gray-400">Nenhum UTM content nas respostas do período</div>
          )}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FaPoll} label="Total Respostas" value={formatNumber(surveyLeads.length)} color="from-pink-500 to-rose-500" />
        <KpiCard icon={FaPercent} label="Taxa de Resposta" value={clients?.length ? formatPercent(Math.min(100, (surveyLeads.length / Math.max(1, clients.length)) * 100)) : '—'} color="from-cyan-500 to-blue-500" />
        <KpiCard icon={FaUserClock} label="Avg Lead Score" value={(() => {
          const scores = surveyLeads.map(l => Number(l.leadScore)).filter(n => !isNaN(n))
          return scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : '—'
        })()} color="from-purple-500 to-fuchsia-500" />
        <KpiCard icon={FaClock} label="Período" value={(() => {
          if (!dailySeries.length) return '—'
          return `${dailySeries[0].date} - ${dailySeries[dailySeries.length - 1].date}`
        })()} color="from-emerald-500 to-teal-500" />
      </section>

      {/* Daily comparison */}
      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><FaPoll className="text-pink-500" />Respostas vs Captação</h2>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          {dailySeries.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="captados" name="Captados" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="respostas" name="Respostas" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-56 flex items-center justify-center text-xs text-gray-400">sem dados</div>}
        </div>
      </section>

      {/* Heatmap dia × hora */}
      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><FaClock className="text-cyan-500" />Heatmap: Quando respondem (dia × hora)</h2>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm overflow-x-auto">
          <table className="text-[10px] w-full">
            <thead>
              <tr><th className="w-12"></th>{Array.from({ length: 24 }, (_, h) => <th key={h} className="font-normal text-gray-400 py-1">{h}</th>)}</tr>
            </thead>
            <tbody>
              {WEEKDAYS_PT.map((wd, dayIdx) => (
                <tr key={wd}>
                  <td className="text-right pr-2 font-semibold text-gray-500">{wd}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmap.find((c) => c.day === dayIdx && c.hour === h) || { value: 0 }
                    const intensity = cell.value / heatMax
                    return (
                      <td key={h} className="p-0">
                        <div
                          className="w-full aspect-square rounded-sm m-0.5"
                          style={{ backgroundColor: `rgba(236, 72, 153, ${intensity * 0.85})`, minHeight: 18 }}
                          title={`${wd} ${h}h: ${cell.value}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distribuições por campo de pesquisa */}
      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><FaTable className="text-amber-500" />Distribuição das respostas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PESQUISA_FIELDS.map((f) => {
            const isOpenField = f.key === 'barreira' || f.key === 'porqueGestor'
            const data = isOpenField ? topNDistribution(surveyLeads, f.key, 10) : distributionFor(surveyLeads, f.key)
            const mode = viewMode[f.key] || (data.length > 6 ? 'bar' : 'pie')
            return (
              <div key={f.key} className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-text-light dark:text-text-dark">{f.label}</h3>
                  <div className="flex gap-1 text-[10px]">
                    {['pie', 'bar', 'table'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setViewMode((s) => ({ ...s, [f.key]: m }))}
                        className={`px-1.5 py-0.5 rounded ${mode === m ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
                {mode === 'table' ? (
                  (() => {
                    const total = data.reduce((s, x) => s + x.value, 0) || 1
                    return (
                      <div className="overflow-y-auto max-h-44 text-xs">
                        <table className="w-full">
                          <tbody>
                            {data.map((d) => (
                              <tr key={d.name} className="border-b border-gray-100 dark:border-[#27272a]">
                                <td className="py-1 truncate max-w-[160px]" title={d.name}>{d.name}</td>
                                <td className="text-right font-semibold tabular-nums">{formatNumber(d.value)}</td>
                                <td className="text-right text-gray-400 tabular-nums w-12">{((d.value / total) * 100).toFixed(1)}%</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-200 dark:border-gray-700">
                              <td className="py-1 font-bold text-gray-500">Total</td>
                              <td className="text-right font-bold tabular-nums">{formatNumber(total)}</td>
                              <td className="text-right text-gray-400 tabular-nums">100%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  })()
                ) : (
                  <MiniChart data={data} type={mode} />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Cross-tabs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CrossTabCard title="Faixa Salarial × Cartão de Crédito" tab={ct1} color="rgba(16, 185, 129" />
        <CrossTabCard title="Ocupação × Interesse no Evento" tab={ct2} color="rgba(139, 92, 246" />
      </section>

      {/* Lead Score + Decil + CAPI */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">Distribuição Lead Score</h3>
          {leadScoreHist.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadScoreHist}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-xs text-gray-400">sem dados</div>}
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">Distribuição Decil</h3>
          {decilDist.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decilDist}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-xs text-gray-400">sem dados</div>}
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">CAPI Status</h3>
          {capiDist.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={capiDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} label={(e) => `${e.name}: ${e.value}`}>
                    {capiDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-xs text-gray-400">sem dados</div>}
        </div>
      </section>
    </div>
  )
}

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2`}>
      <Icon className="text-white" />
    </div>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-text-light dark:text-text-dark">{value}</p>
  </div>
)

const CrossTabCard = ({ title, tab, color }) => {
  const max = Math.max(1, ...Object.values(tab.matrix))
  return (
    <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-[10px] w-full">
          <thead>
            <tr>
              <th></th>
              {tab.yArr.map((y) => <th key={y} className="font-normal text-gray-400 px-1 truncate max-w-[80px]" title={y}>{y.length > 12 ? y.slice(0, 12) + '…' : y}</th>)}
            </tr>
          </thead>
          <tbody>
            {tab.xArr.map((x) => (
              <tr key={x}>
                <td className="text-right pr-2 font-semibold text-gray-500 truncate max-w-[100px]" title={x}>{x.length > 14 ? x.slice(0, 14) + '…' : x}</td>
                {tab.yArr.map((y) => {
                  const v = tab.matrix[`${x}||${y}`] || 0
                  const intensity = v / max
                  return (
                    <td key={y} className="p-0.5">
                      <div className="rounded text-center font-semibold py-1.5" style={{ backgroundColor: `${color}, ${intensity * 0.6})` }}>{v || ''}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SurveyTab
