import React, { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FaChartLine, FaDollarSign, FaEye, FaMousePointer, FaUsers, FaPercent,
  FaBullseye, FaSnowflake, FaReply, FaFunnelDollar,
} from 'react-icons/fa'
import MetricCard from '../MetricCard'
import { formatCurrency, formatPercent, formatNumber, calcDelta, periodLabel, CHART_COLORS } from './utils'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg p-3 border border-white/20 dark:border-gray-700/50 rounded-xl shadow-2xl min-w-[200px]">
      <p className="font-bold text-text-light dark:text-text-dark text-sm border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">{label}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-text-muted-light dark:text-text-muted-dark">{e.name}</span>
          </span>
          <span className="font-semibold text-xs text-text-light dark:text-text-dark">
            {['Investimento', 'CPC', 'CPL', 'CPM'].includes(e.name) ? formatCurrency(e.value)
              : ['CTR', 'Conversão', 'Open Rate', 'Click Rate'].includes(e.name) ? formatPercent(e.value)
              : formatNumber(e.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const OverviewTab = ({
  filters, periodFilters, dailySeries, kpis, prevKpis,
  goals, onGoalChange,
}) => {
  const [seriesToggles, setSeriesToggles] = useState({
    investimento: true, leads: true, respostas: true, cpl: true, ctr: false, conversao: false,
  })
  const toggleSeries = (k) => setSeriesToggles((s) => ({ ...s, [k]: !s[k] }))

  const compareEnabled = filters.compare && prevKpis

  const cards = [
    { title: 'Investimento', value: formatCurrency(kpis.investimento), raw: kpis.investimento, prev: prevKpis?.investimento, deltaInverse: false, icon: FaDollarSign, colors: ['#10b981', '#34d399'] },
    { title: 'Impressões', value: formatNumber(kpis.impressoes), raw: kpis.impressoes, prev: prevKpis?.impressoes, icon: FaEye, colors: ['#3b82f6', '#60a5fa'] },
    { title: 'Cliques', value: formatNumber(kpis.cliques), raw: kpis.cliques, prev: prevKpis?.cliques, icon: FaMousePointer, colors: ['#8b5cf6', '#a78bfa'] },
    { title: 'Leads Captados', value: formatNumber(kpis.leadsCaptados), raw: kpis.leadsCaptados, prev: prevKpis?.leadsCaptados, icon: FaUsers, colors: ['#f59e0b', '#fbbf24'] },
    { title: 'Respostas Pesquisa', value: formatNumber(kpis.respostas), raw: kpis.respostas, prev: prevKpis?.respostas, icon: FaReply, colors: ['#ec4899', '#f472b6'] },
    {
      title: 'Taxa de Resposta',
      value: formatPercent(Math.min(100, kpis.taxaResposta)),
      subtitle: kpis.taxaResposta > 100 ? `Real: ${kpis.taxaResposta.toFixed(1)}%` : undefined,
      badge: kpis.taxaResposta > 100 ? 'ressub' : undefined,
      raw: kpis.taxaResposta, prev: prevKpis?.taxaResposta,
      icon: FaPercent, colors: ['#06b6d4', '#22d3ee'],
    },
  ]

  return (
    <div className="space-y-10">
      {/* KPI Cards */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <FaChartLine className="text-primary" />
          Indicadores ({periodLabel(filters)})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => {
            const delta = compareEnabled ? calcDelta(c.raw, c.prev) : null
            return (
              <MetricCard
                key={c.title}
                icon={c.icon}
                title={c.title}
                value={c.value}
                subtitle={c.subtitle}
                badge={c.badge}
                gradientFrom={c.colors[0]}
                gradientTo={c.colors[1]}
                iconGradientFrom={c.colors[0]}
                iconGradientTo={c.colors[0]}
                delta={delta}
                deltaLabel={compareEnabled ? 'vs anterior' : undefined}
                deltaInverse={c.deltaInverse}
                delay={`${i * 0.05}s`}
              />
            )
          })}
        </div>
      </section>

      {/* Metas de Performance */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <FaBullseye className="text-blue-500" />
          Metas de Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={FaDollarSign} title="CPM" value={formatCurrency(kpis.cpm)} subtitle="Custo por Mil"
            goalKey="cpm" goalValue={goals.cpm} onGoalChange={onGoalChange}
            isInverse={true} rawValue={kpis.cpm} goalPrefix="R$ "
            delta={compareEnabled ? calcDelta(kpis.cpm, prevKpis?.cpm) : null}
            deltaLabel={compareEnabled ? 'vs anterior' : undefined} deltaInverse={true}
          />
          <MetricCard
            icon={FaPercent} title="CTR Médio" value={formatPercent(kpis.ctr)} subtitle="Click-Through Rate"
            goalKey="ctr" goalValue={goals.ctr} onGoalChange={onGoalChange}
            isInverse={false} rawValue={kpis.ctr} goalSuffix="%"
            delta={compareEnabled ? calcDelta(kpis.ctr, prevKpis?.ctr) : null}
            deltaLabel={compareEnabled ? 'vs anterior' : undefined}
          />
          <MetricCard
            icon={FaUsers} title="CPL Médio" value={formatCurrency(kpis.cpl)} subtitle="Custo por Lead Captado"
            goalKey="cpl" goalValue={goals.cpl} onGoalChange={onGoalChange}
            isInverse={true} rawValue={kpis.cpl} goalPrefix="R$ "
            delta={compareEnabled ? calcDelta(kpis.cpl, prevKpis?.cpl) : null}
            deltaLabel={compareEnabled ? 'vs anterior' : undefined} deltaInverse={true}
          />
          <MetricCard
            icon={FaBullseye} title="Conversão Pesquisa" value={formatPercent(kpis.conversaoPesquisa)} subtitle="Respostas / Captados"
            goalKey="conversao" goalValue={goals.conversao} onGoalChange={onGoalChange}
            isInverse={false} rawValue={kpis.conversaoPesquisa} goalSuffix="%"
            delta={compareEnabled ? calcDelta(kpis.conversaoPesquisa, prevKpis?.conversaoPesquisa) : null}
            deltaLabel={compareEnabled ? 'vs anterior' : undefined}
          />
        </div>
      </section>

      {/* Funil */}
      <section className="relative">
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <FaFunnelDollar className="text-primary" />
          Funil de Conversão
        </h2>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-6 shadow-sm">
          <div className="space-y-3">
            {[
              { label: 'Impressões', value: kpis.impressoes, color: '#3b82f6' },
              { label: 'Cliques', value: kpis.cliques, color: '#8b5cf6', prev: kpis.impressoes },
              { label: 'Leads Captados', value: kpis.leadsCaptados, color: '#f59e0b', prev: kpis.cliques },
              { label: 'Respostas Pesquisa', value: kpis.respostas, color: '#ec4899', prev: kpis.leadsCaptados },
            ].map((step, i) => {
              const max = kpis.impressoes || 1
              const widthPct = step.value > 0 ? Math.max(8, (step.value / max) * 100) : 8
              const stepConv = step.prev ? (step.value / step.prev) * 100 : null
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-36 text-sm font-medium text-text-light dark:text-text-dark shrink-0">{step.label}</span>
                  <div className="flex-1 h-10 relative">
                    <div
                      className="h-full rounded-lg flex items-center justify-end pr-4 text-white text-sm font-bold shadow"
                      style={{ width: `${widthPct}%`, backgroundColor: step.color, transition: 'width 0.6s' }}
                    >
                      {formatNumber(step.value)}
                    </div>
                  </div>
                  <span className="w-24 text-right text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {stepConv !== null ? `${stepConv.toFixed(1)}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Gráfico principal */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            <FaChartLine className="text-primary" />
            Métricas Diárias ({dailySeries.length} dias)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'investimento', label: 'Investimento', color: '#10b981' },
              { key: 'leads', label: 'Leads', color: '#f59e0b' },
              { key: 'respostas', label: 'Respostas', color: '#ec4899' },
              { key: 'cpl', label: 'CPL', color: '#ef4444' },
              { key: 'ctr', label: 'CTR', color: '#8b5cf6' },
              { key: 'conversao', label: 'Conversão', color: '#06b6d4' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSeries(s.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  seriesToggles[s.key]
                    ? 'text-white shadow'
                    : 'bg-white dark:bg-[#141419] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#27272a]'
                }`}
                style={seriesToggles[s.key] ? { backgroundColor: s.color, borderColor: s.color } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          {dailySeries.length > 0 ? (
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySeries} margin={{ top: 5, right: 50, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#CBD5E1" tickLine={false} />
                  <YAxis yAxisId="currency" orientation="left" tick={{ fontSize: 11, fill: '#10b981' }} stroke="#10b981" strokeOpacity={0.3} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} tickLine={false} />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11, fill: '#f59e0b' }} stroke="#f59e0b" strokeOpacity={0.3} tickLine={false} />
                  <YAxis yAxisId="cpl" orientation="right" hide />
                  <YAxis yAxisId="ctr" orientation="right" hide />
                  <YAxis yAxisId="percent" orientation="right" hide />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} iconType="circle" iconSize={8} />
                  {seriesToggles.investimento && <Bar yAxisId="currency" dataKey="investimento" name="Investimento" fill="#10b981" fillOpacity={0.85} radius={[4, 4, 0, 0]} barSize={dailySeries.length > 14 ? 16 : 26} />}
                  {seriesToggles.leads && <Line yAxisId="count" type="monotone" dataKey="leads" name="Leads" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />}
                  {seriesToggles.respostas && <Line yAxisId="count" type="monotone" dataKey="respostas" name="Respostas" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#ec4899', r: 3 }} />}
                  {seriesToggles.cpl && <Line yAxisId="cpl" type="monotone" dataKey="cpl" name="CPL" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#ef4444', r: 2.5 }} />}
                  {seriesToggles.ctr && <Line yAxisId="ctr" type="monotone" dataKey="ctr" name="CTR" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 2.5 }} />}
                  {seriesToggles.conversao && <Line yAxisId="percent" type="monotone" dataKey="conversao" name="Conversão" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 2.5 }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FaChartLine className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem dados para o período selecionado</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Audiência + ROI */}
      <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark mb-4 flex items-center gap-2">
          <FaSnowflake className="text-cyan-500" />
          Resumo do Período
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="block text-xs text-gray-500">Dias analisados</span><span className="font-bold text-lg">{dailySeries.length}</span></div>
          <div><span className="block text-xs text-gray-500">Avg leads/dia</span><span className="font-bold text-lg">{formatNumber(Math.round(kpis.leadsCaptados / Math.max(1, dailySeries.length)))}</span></div>
          <div><span className="block text-xs text-gray-500">Avg respostas/dia</span><span className="font-bold text-lg">{formatNumber(Math.round(kpis.respostas / Math.max(1, dailySeries.length)))}</span></div>
          <div><span className="block text-xs text-gray-500">Avg invest/dia</span><span className="font-bold text-lg">{formatCurrency(kpis.investimento / Math.max(1, dailySeries.length))}</span></div>
        </div>
      </section>
    </div>
  )
}

export default OverviewTab
