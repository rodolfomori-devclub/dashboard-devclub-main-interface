import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { FaBullseye, FaPercent, FaShare, FaLink, FaTag, FaFileAlt } from 'react-icons/fa'
import { formatNumber, formatPercent, CHART_COLORS } from './utils'

// Tooltip rico p/ BarChart horizontal: mostra a categoria (label) e os valores
const HBarTooltip = ({ active, payload, valueLabel }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload || {}
  const cat = d.source || d.medium || d.name || ''
  return (
    <div className="bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 shadow-xl text-xs min-w-[200px] max-w-[360px]">
      <p className="font-bold mb-2 break-words border-b border-gray-200 dark:border-gray-700 pb-1.5">{cat}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-3 items-center py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500">{p.name || valueLabel || 'Valor'}</span>
          </span>
          <span className="font-bold">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const AttributionTab = ({ attribution, allClients, allSurveyLeads = [], onApplyFilter, filters }) => {
  const [tableTab, setTableTab] = useState('content')

  const sources = (attribution?.bestSources || []).slice(0, 12)
  const mediums = (attribution?.bestMediums || []).slice(0, 12)

  // Aggregations a partir de allSurveyLeads (onde os UTMs efetivamente existem
  // — /api/clients não retorna utm_* por padrão, /api/leads retorna)
  const { campaignsAgg, contentAgg, termsAgg, sourceMediumMatrix } = useMemo(() => {
    const campaigns = {}
    const contents = {}
    const terms = {}
    const matrix = {}

    for (const l of allSurveyLeads || []) {
      const source = (l.source || 'unknown').trim() || 'unknown'
      const medium = (l.medium || 'unknown').trim() || 'unknown'
      const campaign = (l.campaign || '').trim()
      const content = (l.content || '').trim()
      const term = (l.term || '').trim()

      if (campaign) campaigns[campaign] = (campaigns[campaign] || 0) + 1
      if (content) contents[content] = (contents[content] || 0) + 1
      if (term) terms[term] = (terms[term] || 0) + 1

      const key = `${source}|${medium}`
      matrix[key] = (matrix[key] || 0) + 1
    }

    const sortDesc = (obj) => Object.entries(obj).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    const matrixArr = Object.entries(matrix).map(([key, value]) => {
      const [source, medium] = key.split('|')
      return { source, medium, value }
    }).sort((a, b) => b.value - a.value)

    return {
      campaignsAgg: sortDesc(campaigns).slice(0, 30),
      contentAgg: sortDesc(contents).slice(0, 30),
      termsAgg: sortDesc(terms).slice(0, 30),
      sourceMediumMatrix: matrixArr.slice(0, 30),
    }
  }, [allSurveyLeads])

  const totalSources = sources.reduce((s, x) => s + x.count, 0)

  return (
    <div className="space-y-8">
      {/* Top Sources */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
          <FaShare className="text-blue-500" />
          Top UTM Sources
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
            <div style={{ height: Math.max(288, sources.length * 30 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sources} layout="vertical" margin={{ left: 80, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 11 }} width={120} interval={0} />
                  <RechartsTooltip content={<HBarTooltip valueLabel="Leads" />} />
                  <Bar dataKey="count" name="Leads" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm overflow-y-auto" style={{ maxHeight: 300 }}>
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b border-gray-200 dark:border-[#27272a]">
                <tr><th className="text-left py-1.5">Source</th><th className="text-right">Count</th><th className="text-right">% Total</th></tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr
                    key={s.source}
                    className="border-b border-gray-100 dark:border-[#27272a] hover:bg-primary/5 cursor-pointer"
                    onClick={() => onApplyFilter && onApplyFilter({ utmSources: [...(filters.utmSources || []), s.source].filter((v, idx, arr) => arr.indexOf(v) === idx) })}
                  >
                    <td className="py-1.5 font-medium truncate max-w-[120px]">{s.source}</td>
                    <td className="text-right">{formatNumber(s.count)}</td>
                    <td className="text-right text-gray-400">{((s.count / Math.max(1, totalSources)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top Mediums */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
          <FaLink className="text-purple-500" />
          Top UTM Mediums
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
            <div style={{ height: Math.max(288, mediums.length * 30 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediums} layout="vertical" margin={{ left: 80, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="medium" type="category" tick={{ fontSize: 10 }} width={140} interval={0} />
                  <RechartsTooltip content={<HBarTooltip valueLabel="Leads" />} />
                  <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm overflow-y-auto" style={{ maxHeight: 300 }}>
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b border-gray-200 dark:border-[#27272a]">
                <tr><th className="text-left py-1.5">Medium</th><th className="text-right">Count</th></tr>
              </thead>
              <tbody>
                {mediums.map((m) => (
                  <tr
                    key={m.medium}
                    className="border-b border-gray-100 dark:border-[#27272a] hover:bg-primary/5 cursor-pointer"
                    onClick={() => onApplyFilter && onApplyFilter({ utmMediums: [...(filters.utmMediums || []), m.medium].filter((v, idx, arr) => arr.indexOf(v) === idx) })}
                  >
                    <td className="py-1.5 font-medium truncate max-w-[140px]">{m.medium}</td>
                    <td className="text-right">{formatNumber(m.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top UTM Content */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
          <FaFileAlt className="text-amber-500" />
          Top UTM Content (criativos)
        </h2>
        {contentAgg.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
              {(() => {
                const items = contentAgg.slice(0, 12)
                return (
                  <div style={{ height: Math.max(288, items.length * 30 + 40) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={items} layout="vertical" margin={{ left: 100, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={180} interval={0} />
                        <RechartsTooltip content={<HBarTooltip valueLabel="Leads" />} />
                        <Bar dataKey="count" name="Leads" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
            </div>
            <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm overflow-y-auto" style={{ maxHeight: 300 }}>
              <table className="w-full text-xs">
                <thead className="text-gray-500 border-b border-gray-200 dark:border-[#27272a] sticky top-0 bg-white dark:bg-[#141419]">
                  <tr><th className="text-left py-1.5">Content</th><th className="text-right">Count</th><th className="text-right">% Total</th></tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = contentAgg.reduce((s, x) => s + x.count, 0) || 1
                    return contentAgg.slice(0, 30).map((c) => (
                      <tr key={c.name} className="border-b border-gray-100 dark:border-[#27272a] hover:bg-primary/5">
                        <td className="py-1.5 font-medium truncate max-w-[200px]" title={c.name}>{c.name}</td>
                        <td className="text-right">{formatNumber(c.count)}</td>
                        <td className="text-right text-gray-400">{((c.count / total) * 100).toFixed(1)}%</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-8 text-center text-xs text-gray-400">
            Sem dados de UTM Content no período
          </div>
        )}
      </section>

      {/* Source × Medium Heatmap (top 30 combos) */}
      {sourceMediumMatrix.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
            <FaPercent className="text-cyan-500" />
            Top Combos Source × Medium
          </h2>
          <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {sourceMediumMatrix.map((cell, i) => {
                const max = sourceMediumMatrix[0]?.value || 1
                const intensity = Math.min(1, cell.value / max)
                return (
                  <div
                    key={i}
                    className="rounded-lg p-3 border border-gray-200 dark:border-[#27272a] hover:shadow transition cursor-pointer"
                    style={{ backgroundColor: `rgba(59, 130, 246, ${intensity * 0.3})` }}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex flex-col gap-0.5 truncate">
                        <span className="font-bold truncate">{cell.source}</span>
                        <span className="text-gray-500 truncate">{cell.medium}</span>
                      </div>
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-sm shrink-0">{formatNumber(cell.value)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tabs Campaigns/Content/Terms */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            <FaTag className="text-amber-500" />
            UTM detalhado
          </h2>
          <div className="flex gap-1 bg-white dark:bg-[#141419] rounded-lg border border-gray-200 dark:border-[#27272a] p-1">
            {[
              { id: 'campaigns', label: `Campaigns (${campaignsAgg.length})` },
              { id: 'content', label: `Content (${contentAgg.length})` },
              { id: 'terms', label: `Terms (${termsAgg.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTableTab(t.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  tableTab === t.id ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          {(() => {
            const data = tableTab === 'campaigns' ? campaignsAgg : tableTab === 'content' ? contentAgg : termsAgg
            if (!data.length) return <p className="text-xs text-gray-400 text-center py-8">Sem dados client-side. Aplique filtros ou aumente o período.</p>
            const total = data.reduce((s, x) => s + x.count, 0)
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b border-gray-200 dark:border-[#27272a] sticky top-0 bg-white dark:bg-[#141419]">
                    <tr>
                      <th className="text-left py-2 pl-2 w-8">#</th>
                      <th className="text-left">Valor</th>
                      <th className="text-right">Count</th>
                      <th className="text-right pr-2">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 30).map((item, i) => (
                      <tr key={item.name} className="border-b border-gray-100 dark:border-[#27272a] hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-1.5 pl-2 text-gray-400">{i + 1}</td>
                        <td className="font-medium truncate max-w-[420px]" title={item.name}>{item.name}</td>
                        <td className="text-right">{formatNumber(item.count)}</td>
                        <td className="text-right pr-2 text-gray-500">{((item.count / total) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      </section>
    </div>
  )
}

export default AttributionTab
