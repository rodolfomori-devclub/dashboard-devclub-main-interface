import React, { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FaChartLine, FaDollarSign, FaEye, FaMousePointer, FaUsers, FaPercent,
  FaBullseye, FaSnowflake, FaReply, FaFunnelDollar,
  FaExclamationTriangle, FaHeartbeat, FaCheckCircle,
  FaFileExcel, FaExternalLinkAlt, FaFacebook, FaGoogle,
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
  goals, onGoalChange, allClients = [], allSurveyLeads = [], acSummary = null,
  sheetRows = null, sheetMetrics = null, sheetError = null, channelData = null,
}) => {
  const [seriesToggles, setSeriesToggles] = useState({
    investimento: true, leads: true, respostas: true, cpl: true, ctr: false, conversao: false,
  })
  const toggleSeries = (k) => setSeriesToggles((s) => ({ ...s, [k]: !s[k] }))

  const compareEnabled = filters.compare && prevKpis

  // ====== Cruzamento real de emails — fórmula correta da Taxa de Resposta ======
  // (D1+D2+D3) Calcula em local com base no que está carregado.
  // Quando o leads-data tiver /api/metrics/response-rate (D4), trocar por fetch direto.
  const funnelHealth = useMemo(() => {
    const start = periodFilters?.startDate || ''
    const end = periodFilters?.endDate || ''
    const localDay = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const inPeriod = (iso) => {
      const day = localDay(iso)
      if (!day) return false
      if (start && day < start) return false
      if (end && day > end) return false
      return true
    }
    const norm = (e) => (e || '').trim().toLowerCase()

    // Clients criados no período (em local time)
    const clientsLocais = allClients.filter((c) => inPeriod(c.createdAt))
    const emailsClients = new Set(clientsLocais.map((c) => norm(c.email)))

    // Survey leads no período
    const leadsLocais = allSurveyLeads.filter((l) => inPeriod(l.createdAt || l.data))
    const leadsByEmail = new Map()
    const dupCount = {}
    for (const l of leadsLocais) {
      const k = norm(l.email)
      dupCount[k] = (dupCount[k] || 0) + 1
      if (!leadsByEmail.has(k)) leadsByEmail.set(k, l)
    }
    const leadsUnicos = [...leadsByEmail.keys()] // emails únicos normalizados
    const duplicatas = Object.values(dupCount).reduce((s, n) => s + (n - 1), 0)

    // Cruzamento
    let comResposta = 0
    let semResposta = 0
    for (const e of emailsClients) {
      if (leadsByEmail.has(e)) comResposta++
      else semResposta++
    }
    let vazados = 0
    for (const e of leadsUnicos) {
      if (!emailsClients.has(e)) vazados++
    }

    const totalClients = clientsLocais.length
    const totalLeads = leadsLocais.length

    return {
      totalClients,
      totalLeads,
      leadsUnicos: leadsUnicos.length,
      duplicatas,
      comResposta,
      semResposta,
      vazados,
      taxaResposta: totalClients > 0 ? +((comResposta / totalClients) * 100).toFixed(2) : 0,
      pctVazamento: totalLeads > 0 ? +((vazados / totalLeads) * 100).toFixed(2) : 0,
      // Disponibilidade dos dados pra confiança no número
      dadosCarregados: allClients.length > 0 && allSurveyLeads.length > 0,
    }
  }, [allClients, allSurveyLeads, periodFilters?.startDate, periodFilters?.endDate])

  const cards = [
    { title: 'Investimento', value: formatCurrency(kpis.investimento), raw: kpis.investimento, prev: prevKpis?.investimento, deltaInverse: false, icon: FaDollarSign, colors: ['#10b981', '#34d399'] },
    { title: 'Impressões', value: formatNumber(kpis.impressoes), raw: kpis.impressoes, prev: prevKpis?.impressoes, icon: FaEye, colors: ['#3b82f6', '#60a5fa'] },
    { title: 'Cliques', value: formatNumber(kpis.cliques), raw: kpis.cliques, prev: prevKpis?.cliques, icon: FaMousePointer, colors: ['#8b5cf6', '#a78bfa'] },
    { title: 'Leads Captados', value: formatNumber(kpis.leadsCaptados), raw: kpis.leadsCaptados, prev: prevKpis?.leadsCaptados, icon: FaUsers, colors: ['#f59e0b', '#fbbf24'] },
    { title: 'Respostas Pesquisa', value: formatNumber(kpis.respostas), raw: kpis.respostas, prev: prevKpis?.respostas, icon: FaReply, colors: ['#ec4899', '#f472b6'] },
    // Taxa de Resposta REAL (cruzamento de emails) — substitui a fórmula errada anterior
    {
      title: 'Taxa de Resposta',
      value: funnelHealth.dadosCarregados ? formatPercent(funnelHealth.taxaResposta) : '...',
      subtitle: funnelHealth.dadosCarregados ? `${formatNumber(funnelHealth.comResposta)} de ${formatNumber(funnelHealth.totalClients)} clients` : 'carregando',
      badge: funnelHealth.pctVazamento > 5 ? 'vazando' : undefined,
      raw: funnelHealth.taxaResposta, prev: prevKpis?.taxaResposta,
      icon: FaPercent, colors: ['#06b6d4', '#22d3ee'],
    },
  ]

  return (
    <div className="space-y-10">
      {/* KPI Cards (Meta Ads + APIs) */}
      <section>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-2 flex items-center gap-2 flex-wrap">
          <FaChartLine className="text-primary" />
          Indicadores ({periodLabel(filters)})
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            Meta Ads · Leads API
          </span>
          {filters.metaBucket === 'cap' && (
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
              filtro: só Captação
            </span>
          )}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Investimento, impressões, cliques e CTR vêm da Meta Ads API. Leads/Respostas vêm do banco (Postgres).
          {filters.metaBucket === 'cap' && (
            <span className="text-blue-600 dark:text-blue-400 font-semibold"> · Meta filtrado para campanhas com "| CAP |" no nome.</span>
          )}
        </p>
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

      {/* Dados da Planilha (AUX | Dashboard) — fonte legada manual */}
      <SheetSection sheetRows={sheetRows} sheetMetrics={sheetMetrics} sheetError={sheetError} kpis={kpis} channelData={channelData} />

      {/* Split: novos vs recorrentes (cruzamento via ActiveCampaign) — logo após os KPIs */}
      <NovosVsRecorrentes acSummary={acSummary} />

      {/* D2 + D3 + D5: Saúde do Funil — 4 KPIs corretos + banner de alerta */}
      <FunnelHealthSection funnel={funnelHealth} acSummary={acSummary} />

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

const NovosVsRecorrentes = ({ acSummary }) => {
  const split = useMemo(() => {
    const novos = acSummary?.totalNewContacts || 0
    const recorrentes = acSummary?.totalExistingContacts || 0
    const total = novos + recorrentes
    return {
      novos, recorrentes, total,
      pctNovos: total > 0 ? (novos / total) * 100 : 0,
      pctRecorrentes: total > 0 ? (recorrentes / total) * 100 : 0,
    }
  }, [acSummary])

  return (
    <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FaUsers className="text-blue-500" />
          Novos vs Recorrentes (via ActiveCampaign)
        </h3>
        <span className="text-xs text-gray-500">
          total: <span className="font-semibold text-text-light dark:text-text-dark">{formatNumber(split.total)}</span> entradas no período
        </span>
      </div>
      {split.total > 0 ? (
        <>
          <div className="flex h-8 rounded-lg overflow-hidden mb-3 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-end pr-3 text-white text-xs font-bold transition-all"
              style={{ width: `${split.pctNovos}%` }}
              title={`${formatNumber(split.novos)} novos`}
            >
              {split.pctNovos >= 12 && `${split.pctNovos.toFixed(1)}%`}
            </div>
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-start pl-3 text-white text-xs font-bold transition-all"
              style={{ width: `${split.pctRecorrentes}%` }}
              title={`${formatNumber(split.recorrentes)} recorrentes`}
            >
              {split.pctRecorrentes >= 12 && `${split.pctRecorrentes.toFixed(1)}%`}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Novos clientes</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {formatNumber(split.novos)} <span className="text-xs font-normal text-gray-500">({split.pctNovos.toFixed(1)}%)</span>
                </p>
                <p className="text-[10px] text-gray-400">primeiro contato no período</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Recorrentes</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {formatNumber(split.recorrentes)} <span className="text-xs font-normal text-gray-500">({split.pctRecorrentes.toFixed(1)}%)</span>
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
  )
}

// ====== Saúde do Funil — D2/D3/D5 ======
const FunnelHealthSection = ({ funnel, acSummary }) => {
  const showWarning = funnel.dadosCarregados && funnel.pctVazamento > 5

  return (
    <section className="space-y-3">
      {/* Banner de alerta (D3) */}
      {showWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-lg p-4 flex items-start gap-3">
          <FaExclamationTriangle className="text-amber-500 w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
              ⚠ Vazamento detectado: {funnel.pctVazamento.toFixed(1)}% das respostas estão sem cadastro de cliente
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              <span className="font-semibold">{formatNumber(funnel.vazados)}</span> respostas no período não têm Client correspondente
              {' — '}provável falha na integração da LP com o ActiveCampaign (iOS in-app browsers, ITP).
            </p>
          </div>
        </div>
      )}

      {/* 4 KPIs (D2) */}
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FaHeartbeat className={showWarning ? "text-amber-500" : "text-emerald-500"} />
            Saúde do Funil — {showWarning ? 'atenção' : 'ok'}
          </h3>
          <span className="text-[10px] text-gray-400">
            cruzamento real de emails entre Lead × Client (calculado client-side enquanto leads-data não expõe endpoint)
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FunnelKpi
            icon={FaUsers}
            label="Clients no período"
            value={formatNumber(funnel.totalClients)}
            color="from-blue-500 to-cyan-500"
            sub="leads captados (deduped)"
          />
          <FunnelKpi
            icon={FaReply}
            label="Respostas únicas"
            value={formatNumber(funnel.leadsUnicos)}
            color="from-pink-500 to-rose-500"
            sub={funnel.duplicatas > 0 ? `${funnel.duplicatas} duplicatas excluídas` : 'pesquisa preenchida'}
          />
          <FunnelKpi
            icon={FaCheckCircle}
            label="Clients que responderam"
            value={formatNumber(funnel.comResposta)}
            color="from-emerald-500 to-teal-500"
            sub={`${funnel.taxaResposta.toFixed(1)}% taxa real`}
            highlight
          />
          <FunnelKpi
            icon={FaExclamationTriangle}
            label="Vazados"
            value={formatNumber(funnel.vazados)}
            color={showWarning ? 'from-amber-500 to-orange-500' : 'from-gray-400 to-gray-500'}
            sub={`${funnel.pctVazamento.toFixed(1)}% das respostas sem Client`}
            warn={showWarning}
          />
        </div>

        {/* Reconciliação matemática expandível */}
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-primary select-none">
            Como esses números se relacionam? (clique pra ver matemática)
          </summary>
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg text-xs font-mono space-y-1 text-gray-700 dark:text-gray-300">
            <div>Leads totais (com duplicatas): {formatNumber(funnel.totalLeads)}</div>
            <div>  − {formatNumber(funnel.duplicatas)} duplicatas</div>
            <div>= {formatNumber(funnel.leadsUnicos)} respostas únicas</div>
            <div>  − {formatNumber(funnel.vazados)} vazados (sem Client)</div>
            <div>= {formatNumber(funnel.leadsUnicos - funnel.vazados)} clients que responderam = {formatNumber(funnel.comResposta)} ✓</div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              Taxa real: {formatNumber(funnel.comResposta)} / {formatNumber(funnel.totalClients)} = <span className="font-bold text-emerald-600">{funnel.taxaResposta.toFixed(2)}%</span>
            </div>
          </div>
        </details>
      </div>

      {/* D5: Saúde técnica (parcial — full quando leads-data /health/detailed estiver pronto) */}
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-5 shadow-sm">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <FaHeartbeat className="text-blue-500" />
          Saúde técnica
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TechHealth label="% vazamento" value={funnel.dadosCarregados ? `${funnel.pctVazamento.toFixed(1)}%` : '—'}
            status={funnel.pctVazamento > 5 ? 'bad' : funnel.pctVazamento > 1 ? 'warn' : 'ok'} />
          <TechHealth label="Contatos AC" value={acSummary?.grandTotalSubscribers ? formatNumber(acSummary.grandTotalSubscribers) : '—'}
            status={acSummary ? 'ok' : 'pending'} />
          <TechHealth label="Listas ativas AC" value={acSummary?.activeLists != null ? formatNumber(acSummary.activeLists) : '—'}
            status={acSummary ? 'ok' : 'pending'} />
          <TechHealth label="Lag webhook AC" value="aguardando endpoint"
            status="pending" subtitle="leads-data L5" />
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Métricas completas (lag webhook, fila BullMQ, jobs falhados) requerem o endpoint <code>GET /health/detailed</code> do leads-data (ainda não implementado — D5 parcial).
        </p>
      </div>
    </section>
  )
}

const FunnelKpi = ({ icon: Icon, label, value, color, sub, highlight, warn }) => (
  <div className={`p-3 rounded-lg ${warn ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300/50' : highlight ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300/50' : 'bg-gray-50 dark:bg-gray-900/30'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}>
        <Icon className="text-white w-3 h-3" />
      </div>
      <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
  </div>
)

const TechHealth = ({ label, value, status, subtitle }) => {
  const dotColor = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-rose-500',
    pending: 'bg-gray-300',
  }[status] || 'bg-gray-300'
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/30">
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} ${status !== 'pending' ? 'animate-pulse' : ''}`} />
      <div className="flex-1">
        <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
        <p className="text-sm font-bold">{value}</p>
        {subtitle && <p className="text-[9px] text-gray-400">{subtitle}</p>}
      </div>
    </div>
  )
}

// ====== Dados da Planilha (AUX | Dashboard) — fonte manual legada ======
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1dGBzqdZpenGDy5RB6K_RXvq7qA5lMgeGWK818a7q5iU/edit'

const SheetSection = ({ sheetRows, sheetMetrics, sheetError, kpis, channelData }) => {
  const loading = sheetRows === null && !sheetError
  const empty = !loading && (sheetRows?.length || 0) === 0

  // Comparativo: Meta vs Planilha (delta percentual em relação à Meta)
  const compare = useMemo(() => {
    if (!sheetMetrics?.totals) return null
    const t = sheetMetrics.totals
    const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null)
    return {
      investimento: { sheet: t.investimento, meta: kpis.investimento, delta: pct(t.investimento, kpis.investimento) },
      impressoes:   { sheet: t.impressoes,   meta: kpis.impressoes,   delta: pct(t.impressoes,   kpis.impressoes) },
      cliques:      { sheet: t.cliques,      meta: kpis.cliques,      delta: pct(t.cliques,      kpis.cliques) },
      leads:        { sheet: t.leads,        meta: kpis.leadsCaptados, delta: pct(t.leads,       kpis.leadsCaptados) },
    }
  }, [sheetMetrics, kpis])

  return (
    <section>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2 flex-wrap">
          <FaFileExcel className="text-emerald-600" />
          Dados da Planilha
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            Google Sheets · AUX | Dashboard
          </span>
        </h2>
        <a
          href={SHEET_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 hover:underline"
        >
          Abrir planilha <FaExternalLinkAlt className="w-2.5 h-2.5" />
        </a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Fonte manual histórica preenchida pelo gestor de tráfego. Pode divergir da Meta (consolidação manual + atraso).
      </p>

      {sheetError && (
        <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
          Falha ao carregar planilha: {sheetError}
        </div>
      )}

      {loading && (
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-5 text-xs text-gray-500">
          Carregando CSV da planilha…
        </div>
      )}

      {empty && !sheetError && (
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-dashed border-gray-300 dark:border-[#27272a] p-5 text-xs text-gray-500">
          Nenhuma linha da planilha cai no período selecionado. (A planilha tem 1 linha por dia em DD/MM/YYYY — confira se foi preenchida.)
        </div>
      )}

      {sheetMetrics?.totals && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <SheetCard label="Investimento" value={formatCurrency(sheetMetrics.totals.investimento)} />
            <SheetCard label="Impressões" value={formatNumber(sheetMetrics.totals.impressoes)} />
            <SheetCard label="Cliques" value={formatNumber(sheetMetrics.totals.cliques)} />
            <SheetCard label="Pageviews" value={formatNumber(sheetMetrics.totals.pageviews)} />
            <SheetCard label="Leads" value={formatNumber(sheetMetrics.totals.leads)} />
            <SheetCard label="CTR médio" value={formatPercent(sheetMetrics.averages.ctr)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <SheetCard label="CPL médio" value={formatCurrency(sheetMetrics.averages.cpl)} />
            <SheetCard label="CPC médio" value={formatCurrency(sheetMetrics.averages.cpc)} />
            <SheetCard label="CPM médio" value={formatCurrency(sheetMetrics.averages.cpm)} />
            <SheetCard label="Conversão Página" value={formatPercent(sheetMetrics.averages.conversaoPagina)} />
            <SheetCard label="Carregamento Página" value={formatPercent(sheetMetrics.averages.carregamentoPagina)} />
            <SheetCard label="Dias na planilha" value={formatNumber(sheetMetrics.dataCount)} />
          </div>

          {/* Quebra por canal: Facebook × Google (planilha aba Resumo Campanhas) */}
          <ChannelSplitBlock channelData={channelData} />

          {compare && (
            <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <FaChartLine className="text-blue-500" />
                Planilha × Meta — divergência
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3 font-semibold">Métrica</th>
                      <th className="py-2 pr-3 font-semibold text-right">Planilha</th>
                      <th className="py-2 pr-3 font-semibold text-right">Meta API</th>
                      <th className="py-2 pr-3 font-semibold text-right">Δ vs Meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <CompareRow label="Investimento" sheet={formatCurrency(compare.investimento.sheet)} meta={formatCurrency(compare.investimento.meta)} delta={compare.investimento.delta} />
                    <CompareRow label="Impressões"   sheet={formatNumber(compare.impressoes.sheet)}    meta={formatNumber(compare.impressoes.meta)}    delta={compare.impressoes.delta} />
                    <CompareRow label="Cliques"      sheet={formatNumber(compare.cliques.sheet)}       meta={formatNumber(compare.cliques.meta)}       delta={compare.cliques.delta} />
                    <CompareRow label="Leads"        sheet={formatNumber(compare.leads.sheet)}         meta={formatNumber(compare.leads.meta)}         delta={compare.leads.delta} />
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Δ é a diferença percentual da planilha em relação à Meta. Diferenças significativas indicam atraso de preenchimento ou consolidação manual.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// Quebra Facebook × Google (vinda da planilha — aba "Resumo Campanhas", colunas Dia Face/Valor Gasto Facebook/Leads Face × Dia Google/Valor Gasto Google/Leads Google)
const ChannelSplitBlock = ({ channelData }) => {
  if (!channelData) {
    return (
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 mb-3 text-xs text-gray-500">
        Carregando quebra Facebook × Google da planilha…
      </div>
    )
  }
  const fb = channelData.facebook || { spend: 0, leads: 0, cpl: 0, days: 0, avgDailySpend: 0 }
  const gg = channelData.google || { spend: 0, leads: 0, cpl: 0, days: 0, avgDailySpend: 0 }
  const totalSpend = fb.spend + gg.spend
  const totalLeads = fb.leads + gg.leads
  const fbPctSpend = totalSpend > 0 ? (fb.spend / totalSpend) * 100 : 0
  const ggPctSpend = totalSpend > 0 ? (gg.spend / totalSpend) * 100 : 0
  const fbPctLeads = totalLeads > 0 ? (fb.leads / totalLeads) * 100 : 0
  const ggPctLeads = totalLeads > 0 ? (gg.leads / totalLeads) * 100 : 0

  if (totalSpend === 0 && totalLeads === 0) {
    return (
      <div className="bg-white dark:bg-[#141419] rounded-xl border border-dashed border-gray-300 dark:border-[#27272a] p-4 mb-3 text-xs text-gray-500">
        Sem dados de Facebook/Google na planilha para o período. (Aba "Resumo Campanhas" — colunas Dia Face/Dia Google.)
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm mb-3">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <FaChartLine className="text-blue-500" />
        Por Canal: Facebook × Google
        <span className="text-[10px] font-normal text-gray-400 ml-1">(planilha · Resumo Campanhas)</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <ChannelCard
          name="Facebook"
          icon={FaFacebook}
          colorFrom="from-blue-600" colorTo="to-blue-400"
          textColor="text-blue-700 dark:text-blue-300"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          borderColor="border-blue-300/50"
          channel={fb}
          pctSpend={fbPctSpend}
          pctLeads={fbPctLeads}
        />
        <ChannelCard
          name="Google"
          icon={FaGoogle}
          colorFrom="from-rose-500" colorTo="to-amber-400"
          textColor="text-amber-700 dark:text-amber-300"
          bgColor="bg-amber-50 dark:bg-amber-900/20"
          borderColor="border-amber-300/50"
          channel={gg}
          pctSpend={ggPctSpend}
          pctLeads={ggPctLeads}
        />
      </div>

      {/* Barra comparativa de share de investimento */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] font-semibold text-gray-500 uppercase mb-1">
          <span>Share de investimento</span>
          <span>{formatCurrency(totalSpend)} total</span>
        </div>
        <div className="flex h-6 rounded-md overflow-hidden">
          {fbPctSpend > 0 && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-end pr-2 text-white text-[10px] font-bold" style={{ width: `${fbPctSpend}%` }}>
              {fbPctSpend >= 10 && `${fbPctSpend.toFixed(1)}%`}
            </div>
          )}
          {ggPctSpend > 0 && (
            <div className="bg-gradient-to-r from-rose-500 to-amber-400 flex items-center justify-start pl-2 text-white text-[10px] font-bold" style={{ width: `${ggPctSpend}%` }}>
              {ggPctSpend >= 10 && `${ggPctSpend.toFixed(1)}%`}
            </div>
          )}
        </div>
      </div>

      {/* Barra comparativa de share de leads */}
      <div>
        <div className="flex justify-between text-[10px] font-semibold text-gray-500 uppercase mb-1">
          <span>Share de leads</span>
          <span>{formatNumber(totalLeads)} total</span>
        </div>
        <div className="flex h-6 rounded-md overflow-hidden">
          {fbPctLeads > 0 && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-end pr-2 text-white text-[10px] font-bold" style={{ width: `${fbPctLeads}%` }}>
              {fbPctLeads >= 10 && `${fbPctLeads.toFixed(1)}%`}
            </div>
          )}
          {ggPctLeads > 0 && (
            <div className="bg-gradient-to-r from-rose-500 to-amber-400 flex items-center justify-start pl-2 text-white text-[10px] font-bold" style={{ width: `${ggPctLeads}%` }}>
              {ggPctLeads >= 10 && `${ggPctLeads.toFixed(1)}%`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ChannelCard = ({ name, icon: Icon, colorFrom, colorTo, textColor, bgColor, borderColor, channel, pctSpend, pctLeads }) => (
  <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-9 h-9 rounded-md bg-gradient-to-br ${colorFrom} ${colorTo} flex items-center justify-center`}>
        <Icon className="text-white w-4 h-4" />
      </div>
      <div>
        <p className={`text-sm font-bold ${textColor}`}>{name}</p>
        <p className="text-[10px] text-gray-500">{channel.days} dia{channel.days === 1 ? '' : 's'} no período</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div>
        <p className="text-[10px] text-gray-500 uppercase font-semibold">Investido</p>
        <p className="text-base font-bold text-text-light dark:text-text-dark">{formatCurrency(channel.spend)}</p>
        <p className="text-[9px] text-gray-400">{pctSpend.toFixed(1)}% do total</p>
      </div>
      <div>
        <p className="text-[10px] text-gray-500 uppercase font-semibold">Leads</p>
        <p className="text-base font-bold text-text-light dark:text-text-dark">{formatNumber(channel.leads)}</p>
        <p className="text-[9px] text-gray-400">{pctLeads.toFixed(1)}% do total</p>
      </div>
      <div>
        <p className="text-[10px] text-gray-500 uppercase font-semibold">CPL</p>
        <p className={`text-base font-bold ${textColor}`}>{formatCurrency(channel.cpl)}</p>
        <p className="text-[9px] text-gray-400">por lead</p>
      </div>
    </div>
    <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
      <p className="text-[10px] text-gray-500">Média diária: <span className="font-semibold text-text-light dark:text-text-dark">{formatCurrency(channel.avgDailySpend)}</span></p>
    </div>
  </div>
)

const SheetCard = ({ label, value }) => (
  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40">
    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold tracking-wider">{label}</p>
    <p className="text-lg font-bold text-text-light dark:text-text-dark mt-1">{value}</p>
    <p className="text-[9px] text-gray-400 mt-0.5">via Planilha</p>
  </div>
)

const CompareRow = ({ label, sheet, meta, delta }) => {
  const deltaColor = delta == null ? 'text-gray-400' : Math.abs(delta) < 5 ? 'text-emerald-600' : Math.abs(delta) < 20 ? 'text-amber-600' : 'text-rose-600'
  const deltaText = delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
  return (
    <tr>
      <td className="py-2 pr-3 font-medium text-text-light dark:text-text-dark">{label}</td>
      <td className="py-2 pr-3 text-right font-mono">{sheet}</td>
      <td className="py-2 pr-3 text-right font-mono">{meta}</td>
      <td className={`py-2 pr-3 text-right font-mono font-semibold ${deltaColor}`}>{deltaText}</td>
    </tr>
  )
}

export default OverviewTab
