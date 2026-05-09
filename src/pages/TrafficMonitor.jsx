import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  FaChartLine, FaShare, FaPoll, FaEnvelope, FaBolt, FaSpinner,
  FaDatabase, FaExternalLinkAlt,
} from 'react-icons/fa'

import MonitorFilters from '../components/MonitorFilters'
import OverviewTab from '../components/TrafficMonitor/OverviewTab'
import AttributionTab from '../components/TrafficMonitor/AttributionTab'
import SurveyTab from '../components/TrafficMonitor/SurveyTab'
import ActiveCampaignTab from '../components/TrafficMonitor/ActiveCampaignTab'
import RealTimeTab from '../components/TrafficMonitor/RealTimeTab'
import { resolvePeriod, periodLabel, groupByDay, filterByLocalDate } from '../components/TrafficMonitor/utils'

import { leadsService } from '../services/leadsService'
import { metaAdsClient } from '../services/metaAdsClient'
import { activeCampaignService } from '../services/activeCampaignService'
import trafficSheetsService from '../services/trafficSheetsService'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: FaChartLine },
  { id: 'attribution', label: 'Atribuição & UTM', icon: FaShare },
  { id: 'survey', label: 'Pesquisa Detalhada', icon: FaPoll },
  { id: 'activecampaign', label: 'ActiveCampaign', icon: FaEnvelope },
  { id: 'realtime', label: 'Real-Time', icon: FaBolt },
]

const DEFAULT_FILTERS = {
  period: 'today',
  customStart: null,
  customEnd: null,
  compare: false,
  utmSources: [],
  utmMediums: [],
  utmCampaigns: [],
  tags: [],
  metaBucket: null, // null = todas campanhas Meta | 'cap' = só Captação
}

const TrafficMonitor = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [activeTab, setActiveTab] = useState('overview')

  // Loading flags
  const [loadingCore, setLoadingCore] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(60000)
  const [lastUpdate, setLastUpdate] = useState(null)
  const refreshTimerRef = useRef(null)

  // Goals (Postgres)
  const [goals, setGoals] = useState({ cpm: 0, ctr: 0, cpl: 0, conversao: 0 })

  // Core data (overview-level)
  const [overview, setOverview] = useState(null)
  const [attribution, setAttribution] = useState(null)
  const [tagsMetrics, setTagsMetrics] = useState(null)
  const [metaInsights, setMetaInsights] = useState(null)
  const [metaDaily, setMetaDaily] = useState(null)
  const [acSummary, setAcSummary] = useState(null)
  const [clientsTotal, setClientsTotal] = useState(0)
  const [surveyTotal, setSurveyTotal] = useState(0)

  // Compare data (período anterior)
  const [prev, setPrev] = useState(null)
  const [metaError, setMetaError] = useState(null)

  // Lazy data (carregados quando aba é ativada)
  const [allClients, setAllClients] = useState(null)
  const [allSurveyLeads, setAllSurveyLeads] = useState(null)
  const [loadingHeavy, setLoadingHeavy] = useState(false)

  // Planilha (Google Sheets — AUX | Dashboard)
  const [sheetRows, setSheetRows] = useState(null)
  const [sheetMetrics, setSheetMetrics] = useState(null)
  const [sheetError, setSheetError] = useState(null)
  const [channelData, setChannelData] = useState(null) // { facebook, google }

  const periodFilters = useMemo(() => resolvePeriod(filters), [filters])

  // ============ GOALS ============
  useEffect(() => {
    axios.get(`${API_URL}/goals/traffic-goals`)
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setGoals({ cpm: 0, ctr: 0, cpl: 0, conversao: 0, ...res.data.data })
        }
      })
      .catch((e) => console.error('goals err', e))
  }, [])

  const handleGoalChange = async (key, value) => {
    const next = { ...goals, [key]: value }
    setGoals(next)
    try { await axios.put(`${API_URL}/goals/traffic-goals`, next) } catch (e) { console.error('goal save err', e) }
  }

  // ============ CORE LOAD (sempre que filtros mudam) ============
  const loadCore = useCallback(async () => {
    setLoadingCore(true)
    setError(null)
    const { startDate, endDate, comparePrevStart, comparePrevEnd } = periodFilters
    if (!startDate || !endDate) {
      setLoadingCore(false)
      return
    }
    try {
      const [
        ovRes, atRes, tgRes, miRes, mdRes, cTotal, sTotal,
      ] = await Promise.allSettled([
        leadsService.fetchOverview({ startDate, endDate }),
        leadsService.fetchAttribution({ startDate, endDate }),
        leadsService.fetchTagsMetrics({ startDate, endDate }),
        metaAdsClient.fetchInsights({ startDate, endDate, bucket: filters.metaBucket }).catch((e) => { setMetaError(e?.response?.data?.message || e?.message || 'Meta Ads indisponível'); return null }),
        metaAdsClient.fetchDailySpend({ days: Math.max(1, periodFilters.days || 7), bucket: filters.metaBucket }).catch((e) => null),
        leadsService.fetchClientsCount({
          startDate, endDate,
          utmSource: filters.utmSources?.length ? filters.utmSources.join(',') : undefined,
          utmMedium: filters.utmMediums?.length ? filters.utmMediums.join(',') : undefined,
          utmCampaign: filters.utmCampaigns?.length ? filters.utmCampaigns.join(',') : undefined,
          tags: filters.tags?.length ? filters.tags.join(',') : undefined,
        }),
        leadsService.fetchSurveyCount({ startDate, endDate }),
      ])

      setOverview(ovRes.status === 'fulfilled' ? ovRes.value : null)
      setAttribution(atRes.status === 'fulfilled' ? atRes.value : null)
      setTagsMetrics(tgRes.status === 'fulfilled' ? tgRes.value : null)
      const metaInsightsVal = miRes.status === 'fulfilled' ? miRes.value : null
      setMetaInsights(metaInsightsVal)
      setMetaDaily(mdRes.status === 'fulfilled' ? mdRes.value : null)
      // Detecta payload "indisponível" (backend respondeu 200 mas com flag)
      if (metaInsightsVal?.unavailable) {
        setMetaError(metaInsightsVal.message || 'Meta Ads indisponível (token ausente/expirado em produção)')
      } else if (metaInsightsVal) {
        setMetaError(null)
      }
      setClientsTotal(cTotal.status === 'fulfilled' ? cTotal.value : 0)
      setSurveyTotal(sTotal.status === 'fulfilled' ? sTotal.value : 0)
      setLastUpdate(new Date())

      // Compare period
      if (filters.compare && comparePrevStart && comparePrevEnd) {
        const [pCT, pST, pMI, pOv] = await Promise.allSettled([
          leadsService.fetchClientsCount({ startDate: comparePrevStart, endDate: comparePrevEnd }),
          leadsService.fetchSurveyCount({ startDate: comparePrevStart, endDate: comparePrevEnd }),
          metaAdsClient.fetchInsights({ startDate: comparePrevStart, endDate: comparePrevEnd, bucket: filters.metaBucket }).catch(() => null),
          leadsService.fetchOverview({ startDate: comparePrevStart, endDate: comparePrevEnd }),
        ])
        setPrev({
          clientsTotal: pCT.status === 'fulfilled' ? pCT.value : 0,
          surveyTotal: pST.status === 'fulfilled' ? pST.value : 0,
          metaInsights: pMI.status === 'fulfilled' ? pMI.value : null,
          overview: pOv.status === 'fulfilled' ? pOv.value : null,
        })
      } else {
        setPrev(null)
      }
    } catch (e) {
      setError('Erro ao carregar dados.')
      console.error(e)
    } finally {
      setLoadingCore(false)
    }
  }, [periodFilters.startDate, periodFilters.endDate, periodFilters.comparePrevStart, periodFilters.comparePrevEnd, filters.compare, filters.metaBucket, JSON.stringify(filters.utmSources), JSON.stringify(filters.utmMediums), JSON.stringify(filters.utmCampaigns), JSON.stringify(filters.tags)])

  useEffect(() => { loadCore() }, [loadCore])

  // ============ AUTO-REFRESH ============
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        leadsService.clearCache()
        metaAdsClient.clearCache()
        loadCore()
      }, refreshInterval)
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current) }
  }, [autoRefresh, refreshInterval, loadCore])

  // ============ LAZY: Survey (aba pesquisa + attribution + overview) ============
  useEffect(() => {
    if (activeTab !== 'survey' && activeTab !== 'overview' && activeTab !== 'attribution') return
    const { startDate, endDate } = periodFilters
    if (!startDate || !endDate) return
    let cancelled = false
    setLoadingHeavy(true)
    leadsService.fetchAllSurveyLeads({ startDate, endDate, maxRecords: 8000 })
      .then((d) => { if (!cancelled) setAllSurveyLeads(d) })
      .catch(() => { if (!cancelled) setAllSurveyLeads([]) })
      .finally(() => { if (!cancelled) setLoadingHeavy(false) })
    return () => { cancelled = true }
  }, [activeTab, periodFilters.startDate, periodFilters.endDate])

  // ============ LAZY: All clients (atribuição + overview) ============
  useEffect(() => {
    if (activeTab !== 'attribution' && activeTab !== 'overview') return
    const { startDate, endDate } = periodFilters
    if (!startDate || !endDate) return
    let cancelled = false
    setLoadingHeavy(true)
    leadsService.fetchAllClients({
      startDate, endDate, maxRecords: 8000,
      utmSource: filters.utmSources?.length ? filters.utmSources.join(',') : undefined,
      utmMedium: filters.utmMediums?.length ? filters.utmMediums.join(',') : undefined,
      utmCampaign: filters.utmCampaigns?.length ? filters.utmCampaigns.join(',') : undefined,
      tags: filters.tags?.length ? filters.tags.join(',') : undefined,
    })
      .then((d) => { if (!cancelled) setAllClients(d) })
      .catch(() => { if (!cancelled) setAllClients([]) })
      .finally(() => { if (!cancelled) setLoadingHeavy(false) })
    return () => { cancelled = true }
  }, [activeTab, periodFilters.startDate, periodFilters.endDate, JSON.stringify(filters.utmSources), JSON.stringify(filters.utmMediums), JSON.stringify(filters.utmCampaigns), JSON.stringify(filters.tags)])

  // ============ PLANILHA (AUX | Dashboard) ============
  // Carrega CSV público e filtra por período (DATA é DD/MM/YYYY).
  useEffect(() => {
    if (activeTab !== 'overview') return
    const { startDate, endDate } = periodFilters
    if (!startDate || !endDate) return
    let cancelled = false
    const startD = new Date(`${startDate}T00:00:00`)
    const endD = new Date(`${endDate}T23:59:59`)
    trafficSheetsService.getDataByPeriod(startD, endD)
      .then((rows) => {
        if (cancelled) return
        setSheetRows(rows)
        setSheetMetrics(trafficSheetsService.calculateMetrics(rows))
        setSheetError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setSheetRows([])
        setSheetMetrics(null)
        setSheetError(e?.message || 'Falha ao carregar planilha')
      })
    // Quebra por canal Facebook × Google (aba diferente da planilha)
    trafficSheetsService.getChannelDataByPeriod(startD, endD)
      .then((d) => { if (!cancelled) setChannelData(d) })
      .catch(() => { if (!cancelled) setChannelData(null) })
    return () => { cancelled = true }
  }, [activeTab, periodFilters.startDate, periodFilters.endDate])

  // ============ LAZY: AC summary (overview + activecampaign) ============
  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'activecampaign') return
    const { startDate, endDate } = periodFilters
    if (!startDate || !endDate) return
    let cancelled = false
    activeCampaignService.getListsSummary({ startDate, endDate })
      .then((r) => { if (!cancelled) setAcSummary(r?.data || null) })
      .catch(() => { if (!cancelled) setAcSummary(null) })
    return () => { cancelled = true }
  }, [activeTab, periodFilters.startDate, periodFilters.endDate])

  // ============ FILTER OPTIONS ============
  const sourceOptions = useMemo(() =>
    (attribution?.bestSources || []).map(s => ({ value: s.source, label: s.source, count: s.count }))
  , [attribution])

  const mediumOptions = useMemo(() =>
    (attribution?.bestMediums || []).map(m => ({ value: m.medium, label: m.medium, count: m.count }))
  , [attribution])

  const campaignOptions = useMemo(() => {
    if (!allClients) return []
    const map = {}
    for (const c of allClients) {
      const k = c.utmCampaign
      if (k) map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([v, c]) => ({ value: v, label: v, count: c }))
  }, [allClients])

  const tagOptions = useMemo(() =>
    (tagsMetrics?.tagDistribution || []).slice(0, 100).map(t => ({ value: t.tagName, label: t.tagName, count: t.count }))
  , [tagsMetrics])

  // ============ FILTROS LOCAIS POR DATA (corrige timezone UTC vs local) ============
  const surveyLeadsLocal = useMemo(
    () => filterByLocalDate(allSurveyLeads || [], periodFilters.startDate, periodFilters.endDate, (l) => l.createdAt || l.data),
    [allSurveyLeads, periodFilters.startDate, periodFilters.endDate]
  )
  const clientsLocal = useMemo(
    () => filterByLocalDate(allClients || [], periodFilters.startDate, periodFilters.endDate, (c) => c.createdAt),
    [allClients, periodFilters.startDate, periodFilters.endDate]
  )

  // ============ DERIVE KPIS ============
  const kpis = useMemo(() => {
    const insights = metaInsights?.data?.[0] || metaInsights || {}
    const investimento = parseFloat(insights.spend || 0)
    const impressoes = parseInt(insights.impressions || 0, 10)
    const cliques = parseInt(insights.clicks || 0, 10)
    const ctr = parseFloat(insights.ctr || 0)
    const cpm = parseFloat(insights.cpm || 0)

    // Usa contagens locais (filtradas por dia local) se já carregaram;
    // cai pro count da API como fallback enquanto carrega
    const respostas = surveyLeadsLocal.length > 0 || allSurveyLeads ? surveyLeadsLocal.length : surveyTotal
    const leadsCaptados = clientsLocal.length > 0 || allClients ? clientsLocal.length : clientsTotal
    const cpl = leadsCaptados > 0 ? investimento / leadsCaptados : 0
    const taxaResposta = leadsCaptados > 0 ? (respostas / leadsCaptados) * 100 : 0
    const conversaoPesquisa = leadsCaptados > 0 ? (respostas / leadsCaptados) * 100 : 0

    return {
      investimento, impressoes, cliques, ctr, cpm, cpl,
      respostas, leadsCaptados, taxaResposta, conversaoPesquisa,
    }
  }, [metaInsights, clientsTotal, surveyTotal, surveyLeadsLocal, clientsLocal, allSurveyLeads, allClients])

  const prevKpis = useMemo(() => {
    if (!prev) return null
    const insights = prev.metaInsights?.data?.[0] || prev.metaInsights || {}
    const investimento = parseFloat(insights.spend || 0)
    const impressoes = parseInt(insights.impressions || 0, 10)
    const cliques = parseInt(insights.clicks || 0, 10)
    const ctr = parseFloat(insights.ctr || 0)
    const cpm = parseFloat(insights.cpm || 0)
    const respostas = prev.surveyTotal
    const leadsCaptados = prev.clientsTotal
    const cpl = leadsCaptados > 0 ? investimento / leadsCaptados : 0
    const taxaResposta = leadsCaptados > 0 ? (respostas / leadsCaptados) * 100 : 0
    const conversaoPesquisa = leadsCaptados > 0 ? (respostas / leadsCaptados) * 100 : 0
    return {
      investimento, impressoes, cliques, ctr, cpm, cpl,
      respostas, leadsCaptados, taxaResposta, conversaoPesquisa,
    }
  }, [prev])

  // ============ DAILY SERIES (Overview chart) ============
  // Agrupa por dia LOCAL (BRT). Restringe ao intervalo do filtro para não mostrar
  // dias "vazados" via UTC.
  const dailySeries = useMemo(() => {
    const surveyByDay = groupByDay(surveyLeadsLocal, (l) => l.createdAt || l.data)
    const clientsByDay = groupByDay(clientsLocal, (c) => c.createdAt)
    const metaByDay = {}
    if (metaDaily?.dailyData) {
      for (const day of metaDaily.dailyData) {
        const d = (day.date || day.date_start || '').slice(0, 10)
        if (!d) continue
        // Só inclui se cair no intervalo do filtro
        if (periodFilters.startDate && d < periodFilters.startDate) continue
        if (periodFilters.endDate && d > periodFilters.endDate) continue
        metaByDay[d] = day
      }
    }
    const days = new Set([...Object.keys(surveyByDay), ...Object.keys(clientsByDay), ...Object.keys(metaByDay)])
    return [...days].sort().map((d) => {
      const meta = metaByDay[d] || {}
      const respostas = surveyByDay[d] || 0
      const leads = clientsByDay[d] || 0
      const investimento = parseFloat(meta.spend || 0)
      const impressoes = parseInt(meta.impressions || 0, 10)
      const cliques = parseInt(meta.clicks || 0, 10)
      const ctr = parseFloat(meta.ctr || 0)
      const cpl = leads > 0 ? investimento / leads : 0
      const conversao = leads > 0 ? (respostas / leads) * 100 : 0
      const [, m, day] = d.split('-')
      return { date: `${day}/${m}`, fullDate: d, investimento, impressoes, cliques, ctr, leads, respostas, cpl, conversao }
    })
  }, [surveyLeadsLocal, clientsLocal, metaDaily, periodFilters.startDate, periodFilters.endDate])

  // Apply filter callback (do AttributionTab → filtros globais)
  const handleApplyFilter = (patch) => setFilters(f => ({ ...f, ...patch }))

  if (loadingCore && !overview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="w-12 h-12 text-primary animate-spin" />
          <p className="text-sm text-gray-500">Carregando Monitor de Tráfego...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-slate-50 to-blue-50 dark:from-background-dark dark:via-gray-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-text-light to-primary dark:from-text-dark dark:to-primary bg-clip-text text-transparent">
            Monitor de Tráfego
          </h1>
          <p className="text-text-muted-light dark:text-text-muted-dark text-sm mt-1">
            {periodLabel(filters)} · análise multi-fonte: Leads API · Meta Ads · ActiveCampaign
          </p>
        </header>

        {/* Filtros globais */}
        <MonitorFilters
          filters={filters}
          onChange={setFilters}
          sourceOptions={sourceOptions}
          mediumOptions={mediumOptions}
          campaignOptions={campaignOptions}
          tagOptions={tagOptions}
          onRefresh={() => { leadsService.clearCache(); metaAdsClient.clearCache(); loadCore() }}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(a => !a)}
          refreshInterval={refreshInterval}
          onChangeInterval={setRefreshInterval}
          lastUpdate={lastUpdate}
          loading={loadingCore}
        />

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        {metaError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3">
            <span className="font-bold shrink-0">⚠ Meta Ads indisponível</span>
            <div className="flex-1">
              <p className="text-xs">Os cards de Investimento, Impressões, Cliques, CTR, CPM e CPC ficarão zerados até o token ser renovado. Demais fontes (Leads API, ActiveCampaign) operam normalmente.</p>
              <p className="text-[10px] mt-1 font-mono opacity-70 break-all">{metaError}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 items-center">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                    : 'bg-white dark:bg-[#141419] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-[#27272a]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}

          <Link
            to="/dados"
            className="ml-2 flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            title="Abrir explorador de dados (planilha)"
          >
            <FaDatabase className="w-3.5 h-3.5" />
            Dados (planilha)
            <FaExternalLinkAlt className="w-2.5 h-2.5 opacity-60" />
          </Link>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <OverviewTab
            filters={filters}
            periodFilters={periodFilters}
            dailySeries={dailySeries}
            kpis={kpis}
            prevKpis={prevKpis}
            goals={goals}
            onGoalChange={handleGoalChange}
            allClients={allClients || []}
            allSurveyLeads={allSurveyLeads || []}
            acSummary={acSummary}
            sheetRows={sheetRows}
            sheetMetrics={sheetMetrics}
            sheetError={sheetError}
            channelData={channelData}
          />
        )}
        {activeTab === 'attribution' && (
          <AttributionTab
            attribution={attribution}
            allClients={allClients || []}
            allSurveyLeads={allSurveyLeads || []}
            onApplyFilter={handleApplyFilter}
            filters={filters}
          />
        )}
        {activeTab === 'survey' && (
          <SurveyTab
            allSurveyLeads={allSurveyLeads || []}
            allClients={allClients || []}
            loading={loadingHeavy}
            periodFilters={periodFilters}
          />
        )}
        {activeTab === 'activecampaign' && (
          <ActiveCampaignTab periodFilters={periodFilters} filters={filters} kpis={kpis} />
        )}
        {activeTab === 'realtime' && <RealTimeTab />}
      </div>
    </div>
  )
}

export default TrafficMonitor
