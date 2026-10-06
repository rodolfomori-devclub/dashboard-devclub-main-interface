import AsaasCashPanel from '../components/daily/AsaasCashPanel'
import AnnualAsaasCashPanel from '../components/daily/AnnualAsaasCashPanel'
import { sourceHasSales } from '../utils/sourceAvailability'
import { usesPlatformNet } from '../utils/platformCash'
import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { RefreshCw, ArrowUpRight, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
import { ChartPanel, RankedBars, MixChart } from '../components/charts/AnalyticsVisuals'
import RevenueHighlights from '../components/charts/RevenueHighlights'
import RefundSummary from '../components/charts/RefundSummary'
import RevenueNotifications from '../components/charts/RevenueNotifications'
import { buildRevenueNotices } from '../utils/revenueBreakdown'
import '../components/charts/periodAnalytics.css'
import WeekSelector from '../components/WeekSelector'
import ProductFilter from '../components/ProductFilter'
import { loadPeriodSales, bucketHasSalesSource } from '../services/periodSalesService'
import { useAuth } from '../contexts/AuthContext'
import { localDateKey } from '../components/daily/dailyData'
import { EMPTY_FILTERS, UNKNOWN, filterSales, filterOptions, groupSales } from '../utils/salesData'
import { summarizePeriod, periodSeries, goalProgress, localDay } from '../utils/periodData'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const currency = (value, currencyCode = 'BRL') => value === null || value === undefined ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(value)
const count = value => Number(value || 0).toLocaleString('pt-BR')
const displayAmount = value => value.known || !value.missing ? currency(value.value) : '—'
const dateBR = value => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Sem data'
const snapshotDate = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Não informada'
const TITLE = { global: 'Visão global', month: 'Visão mensal', year: 'Visão anual' }
const GOALS = { meta: 'Meta', superMeta: 'Super meta', ultraMeta: 'Ultra meta' }
const GROUP_NAMES = { product: 'Produtos', family: 'Famílias', offer: 'Ofertas', payment: 'Meios de pagamento' }
const REVENUE_KEYS = ['revenue', 'digital', 'boleto']

// An unknown bucket makes every later accumulated value unknown for that series.
// Keep independent series and future buckets intact; never restart the sum at zero.
function accumulatedRevenue(rows) {
  const totals = Object.fromEntries(REVENUE_KEYS.map(key => [key, 0]))
  return rows.map(row => {
    const next = { ...row }
    for (const key of REVENUE_KEYS) {
      const value = row[key]
      totals[key] = totals[key] === null || !Number.isFinite(value) ? null : totals[key] + value
      next[key] = totals[key]
    }
    return next
  })
}

function rankedGroup(group, partial = false, label = group.name) {
  return { key: group.name, label, value: group.revenue.known || !group.revenue.missing ? group.revenue.value : null, count: group.count, partial: partial || group.revenue.missing > 0 }
}

function initialRange(mode) {
  const today = localDateKey()
  const year = Number(today.slice(0, 4))
  if (mode === 'year') return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
  if (mode === 'month') return monthRange(today.slice(0, 7))
  const d = new Date(`${today}T12:00:00Z`)
  const weekday = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (weekday === 0 ? 6 : weekday === 1 ? 7 : weekday - 1))
  return { startDate: d.toISOString().slice(0, 10), endDate: weekday === 1 ? new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : today }
}
function monthRange(value) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return null
  return { startDate: `${value}-01`, endDate: new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10) }
}

// eslint-disable-next-line react/prop-types
export default function PeriodDashboard({ mode = 'global' }) {
  const { userRoles, hasPermission } = useAuth()
  const [range, setRange] = useState(() => initialRange(mode))
  const [draft, setDraft] = useState(() => initialRange(mode))
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [offer, setOffer] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 1 })
  const [chartMode, setChartMode] = useState('area')
  const [accumulated, setAccumulated] = useState(false)
  const [dimension, setDimension] = useState('product')
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [traffic, setTraffic] = useState(null)
  const [trafficError, setTrafficError] = useState('')
  const [trafficLoading, setTrafficLoading] = useState(false)
  const [goals, setGoals] = useState(null)
  const [goalDraft, setGoalDraft] = useState({})
  const [goalError, setGoalError] = useState('')
  const [savingGoal, setSavingGoal] = useState(null)
  const [goalNotice, setGoalNotice] = useState('')
  const [detailKind, setDetailKind] = useState('sale')
  const [detailPage, setDetailPage] = useState(1)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const today = localDateKey()
    const endDate = range.endDate > today ? today : range.endDate
    setLoading(true); setData(previous => previous?.startDate === range.startDate && previous?.endDate === endDate ? previous : null); setError(''); setProgress({ current: 0, total: 0 })
    if (range.startDate > endDate) { setLoading(false); setError('Este período ainda não começou. Selecione um período iniciado.'); return }
    loadPeriodSales(range.startDate, endDate, { annual: mode === 'year', historical: mode === 'month', force: range.force === true, signal: controller.signal, isCancelled: () => !active, onProgress: value => { if (active) setProgress(value) }, onSnapshot: result => { if (active) setData(result) } })
      .then(result => { if (active) { setData(result); setDetailPage(1) } })
      .catch(() => { if (active) setError('Não foi possível atualizar este período. Os dados anteriores, quando disponíveis, foram mantidos. Tente novamente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [range, mode])

  useEffect(() => {
    if (mode === 'global') return
    const controller = new AbortController()
    const suffix = mode === 'month' ? `/${Number(range.startDate.slice(5, 7))}` : ''
    setGoals(null); setGoalError(''); setGoalNotice('')
    axios.get(`${BASE}/goals/${mode}/${range.startDate.slice(0, 4)}${suffix}`, { signal: controller.signal, timeout: 15000 })
      .then(response => {
        if (!response.data?.success) throw new Error('unavailable')
        setGoals(response.data.data); setGoalDraft(response.data.data)
      })
      .catch(() => { if (!controller.signal.aborted) setGoalError('Metas indisponíveis. Nenhum valor foi substituído por zero.') })
    return () => controller.abort()
  }, [mode, range])

  const allRecords = useMemo(() => data?.records || [], [data])
  const filtered = useMemo(() => filterSales(allRecords, filters).filter(row => !offer || (offer === UNKNOWN ? !row.offer : row.offer === offer)), [allRecords, filters, offer])
  const summary = useMemo(() => summarizePeriod(filtered), [filtered])
  const relevantSources = data?.sources.filter(source => !filters.platform || source.platform === filters.platform || source.id === 'manual') || []
  const availableSales = relevantSources.some(source => source.kind === 'sale' && sourceHasSales(source) && (source.id !== 'manual' || filtered.some(row => row.sourceId === 'manual' && row.kind === 'sale')))
  const sourceAvailable = ids => relevantSources.some(source => ids.includes(source.id) && sourceHasSales(source))
  const digitalAvailable = sourceAvailable(['guru', 'hotmart']) || summary.digital.count > 0
  const boletoAvailable = sourceAvailable(['tmb', 'asaas', 'boletex']) || summary.boleto.count > 0
  const chart = useMemo(() => {
    const values = periodSeries(filtered, range.startDate, range.endDate, mode === 'year')
    const today = localDateKey()
    const sources = data?.sources.filter(source => !filters.platform || source.platform === filters.platform || source.id === 'manual') || []
    const observedByBucket = new Map()
    for (const record of filtered) {
      const date = mode === 'year' && record.cohortMonth ? `${record.cohortMonth}-01` : localDay(record.date)
      const key = mode === 'year' ? date?.slice(0, 7) : date
      if (key) { if (!observedByBucket.has(key)) observedByBucket.set(key, []); observedByBucket.get(key).push(record) }
    }
    values.rows = values.rows.map(row => {
      if (row.date > today) return { ...row, revenue: null, digital: null, boleto: null, count: null, affiliate: null, refund: null, commercial: null }
      const end = mode === 'year' ? new Date(Date.UTC(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)), 0, 12)).toISOString().slice(0, 10) : row.date
      const observed = observedByBucket.get(mode === 'year' ? row.date.slice(0, 7) : row.date) || []
      const hasSource = ids => bucketHasSalesSource(sources, ids, row.date, end)
      const sales = hasSource(['guru', 'hotmart', 'tmb', 'asaas', 'boletex']) || observed.some(record => record.kind === 'sale')
      const digital = hasSource(['guru', 'hotmart']) || observed.some(record => record.kind === 'sale' && ['Guru', 'Hotmart'].includes(record.platform))
      const boleto = hasSource(['tmb', 'asaas', 'boletex']) || observed.some(record => record.kind === 'sale' && ['TMB', 'Asaas', 'Boletex'].includes(record.platform))
      const guru = hasSource(['guru']) || observed.some(record => record.kind === 'sale' && record.platform === 'Guru' && !record.isManual)
      const refund = hasSource(['guruRefunds', 'hotmartRefunds']) || observed.some(record => record.kind === 'refund')
      return { ...row, revenue: sales ? row.revenue : null, count: sales ? row.count : null, digital: digital ? row.digital : null, boleto: boleto ? row.boleto : null, affiliate: guru ? row.affiliate : null, commercial: guru ? row.commercial : null, refund: refund ? row.refund : null }
    })
    return values
  }, [filtered, range, mode, data, filters.platform])
  const revenueRows = useMemo(() => accumulated ? accumulatedRevenue(chart.rows) : chart.rows, [chart.rows, accumulated])
  const groups = useMemo(() => groupSales(summary.sales, dimension), [summary.sales, dimension])
  const platforms = useMemo(() => groupSales(summary.sales, 'sourceId'), [summary.sales])
  const families = useMemo(() => groupSales(summary.sales, 'family'), [summary.sales])
  const payments = useMemo(() => groupSales(summary.sales, 'payment'), [summary.sales])
  const details = useMemo(() => filtered.filter(row => row.kind === detailKind).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [filtered, detailKind])
  const detailPages = Math.max(1, Math.ceil(details.length / 20))
  const currentPage = Math.min(detailPage, detailPages)
  const visibleDetails = details.slice((currentPage - 1) * 20, currentPage * 20)
  const hasFilters = Object.values(filters).some(Boolean) || Boolean(offer)
  const salesPartial = relevantSources.some(source => source.kind === 'sale' && source.status !== 'ready')
  const boletoPartial = relevantSources.some(source => ['asaas', 'boletex', 'tmb', 'manual'].includes(source.id) && source.status !== 'ready')
  const cacheStatus = progress.generatedAt ? progress : data?.cache
  const notifications = data ? buildRevenueNotices(relevantSources, { ...filters, offer }, { partial: salesPartial || summary.total.revenue.missing > 0, cache: cacheStatus, records: filtered }) : []

  function selectGroup(name) {
    const value = name === 'Não informado' ? UNKNOWN : name
    if (dimension === 'offer') { setOffer(value); setDetailPage(1); setExpanded(null) }
    else changeFilter(dimension, value)
  }
  function changeFilter(key, value) { setFilters(old => ({ ...old, [key]: value })); setDetailPage(1); setExpanded(null) }
  function applyRange(event) {
    event.preventDefault()
    if (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate || (Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000 > 365) { setError('Selecione um período válido de até 366 dias.'); return }
    setRange({ ...draft, force: false }); setSelectedWeek(null); setTraffic(null); setTrafficError(''); setExpanded(null)
  }
  function selectWeek(week) {
    const next = { startDate: localDateKey(week.startDate), endDate: localDateKey(week.endDate) }
    setSelectedWeek(week); setDraft(next); setRange(next); setTraffic(null); setTrafficError('')
  }
  async function fetchTraffic() {
    setTrafficLoading(true); setTrafficError('')
    try {
      const response = await axios.get(`${BASE}/meta/all-accounts-spend/7`, { timeout: 60000 })
      if (response.data.unavailable) throw new Error('unavailable')
      setTraffic(response.data)
    } catch { setTrafficError('Gastos de tráfego indisponíveis. Não foi calculado ROAS.'); setTraffic(null) }
    finally { setTrafficLoading(false) }
  }
  async function saveGoal(key) {
    if (!userRoles?.isAdmin) return
    const values = Object.fromEntries(Object.keys(GOALS).map(field => [field, Number(goalDraft[field])]))
    if (Object.keys(GOALS).some(field => goalDraft[field] === '' || !Number.isFinite(values[field]) || values[field] < 0)) { setGoalError('Preencha as três faixas com números maiores ou iguais a zero.'); return }
    if (values.superMeta < values.meta || values.ultraMeta < values.superMeta) { setGoalError('A supermeta deve ser maior ou igual à meta, e a ultrameta maior ou igual à supermeta.'); return }
    setSavingGoal(key); setGoalError(''); setGoalNotice('')
    try {
      const suffix = mode === 'month' ? `/${Number(range.startDate.slice(5, 7))}` : ''
      const response = await axios.post(`${BASE}/goals/${mode}/${range.startDate.slice(0, 4)}${suffix}`, values)
      setGoals(response.data.data || values); setGoalNotice('As três faixas foram salvas em conjunto.')
    } catch (error) { setGoalError(error.response?.data?.error || 'Não foi possível salvar a meta. O valor anterior foi mantido.') }
    finally { setSavingGoal(null) }
  }
  function exportRows() {
    const safeCell = value => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"` }
    const rows = [['Data', 'Fonte', 'Cliente', 'Email', 'Produto', 'Família', 'Pagamento', 'Tipo', 'Valor operacional', 'Recebido', 'Oferta'], ...filtered.map(row => [row.date, row.platform, row.buyerName, row.buyerEmail, row.product, row.family, row.payment, row.kind, row.revenue, row.received, row.offer])]
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(safeCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `vendas-${range.startDate}-${range.endDate}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  return <div className="hub-page period-analytics space-y-6">
    <header className="page-heading flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500 mb-2">Performance comercial</p><h1 className="text-3xl font-semibold">{TITLE[mode]}</h1><p className="text-sm text-slate-500 mt-2">Receita, produtos e meios de pagamento. Do consolidado a cada venda.</p></div><div className="period-heading-actions"><RevenueNotifications items={notifications} /><button type="button" className="btn btn-ghost disabled:opacity-40" onClick={exportRows} disabled={!filtered.length || loading}><Download size={16} />Exportar</button><button type="button" className="btn btn-ghost disabled:opacity-40" disabled={loading} title={mode === 'global' ? 'Atualizar fontes' : 'Atualizar histórico e hoje'} onClick={() => setRange(previous => ({ ...previous, force: true }))}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Atualizar</button></div></header>
    <RevenueHighlights records={filtered} sources={relevantSources} filters={{ ...filters, offer }} loading={loading} ready={Boolean(data)} error={Boolean(error)} />
    <RefundSummary records={filtered} sources={relevantSources} platform={filters.platform} ready={Boolean(data)} loading={loading} error={Boolean(error)} startDate={range.startDate} endDate={range.endDate > localDateKey() ? localDateKey() : range.endDate} />
    <form onSubmit={applyRange} className="filter-bar ds-card p-4 flex flex-wrap items-end gap-3">
      {mode === 'month' ? <div><label htmlFor="period-month" className="ds-label">Mês</label><input id="period-month" className="ds-input" type="month" required value={draft.startDate.slice(0, 7)} onChange={e => { const value = monthRange(e.target.value); if (value) setDraft(value) }} /></div>
        : mode === 'year' ? <div><label htmlFor="period-year" className="ds-label">Ano</label><input id="period-year" type="number" min="2020" max={new Date().getFullYear() + 1} required className="ds-input" value={Number(draft.startDate.slice(0, 4))} onChange={e => { if (/^\d{4}$/.test(e.target.value)) setDraft({ startDate: `${e.target.value}-01-01`, endDate: `${e.target.value}-12-31` }) }} /></div>
          : <><div><label htmlFor="period-start" className="ds-label">De</label><input id="period-start" type="date" required className="ds-input" value={draft.startDate} onChange={e => setDraft(old => ({ ...old, startDate: e.target.value }))} /></div><div><label htmlFor="period-end" className="ds-label">Até</label><input id="period-end" type="date" required min={draft.startDate} className="ds-input" value={draft.endDate} onChange={e => setDraft(old => ({ ...old, endDate: e.target.value }))} /></div></>}
      <button type="submit" className="btn btn-primary">Aplicar período <ArrowUpRight size={15} /></button>{mode === 'global' && <WeekSelector onWeekSelect={selectWeek} selectedWeek={selectedWeek} autoSelect={false} label="Semana de lançamento" />}<p className="text-xs text-slate-500 sm:ml-auto">{dateBR(range.startDate)} — {dateBR(range.endDate)}</p>
    </form>
    <section className="ds-card p-4" aria-label="Filtros de vendas"><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">{[['family', 'Família'], ['product', 'Produto'], ['platform', 'Plataforma'], ['payment', 'Pagamento']].map(([key, label]) => key === 'product' && mode === 'global' ? <ProductFilter key={key} value={filters.product} options={filterOptions(allRecords, 'product')} onChange={value => changeFilter('product', value)} /> : <div key={key}><label htmlFor={`period-${key}`} className="ds-label">{label}</label><select id={`period-${key}`} className="ds-input" value={filters[key]} onChange={e => changeFilter(key, e.target.value)}><option value="">Todos</option>{(key === 'platform' ? [...new Set([...(data?.sources.filter(source => source.kind === 'sale').map(source => source.platform) || []), ...filterOptions(allRecords, key)])] : filterOptions(allRecords, key)).map(value => <option key={value} value={value}>{value}</option>)}<option value={UNKNOWN}>Não informado</option></select></div>)}<div><label htmlFor="period-offer" className="ds-label">Oferta</label><select id="period-offer" className="ds-input" value={offer} onChange={e => { setOffer(e.target.value); setDetailPage(1) }}><option value="">Todas</option>{filterOptions(allRecords, 'offer').map(value => <option key={value} value={value}>{value}</option>)}<option value={UNKNOWN}>Não informada</option></select></div></div>{hasFilters && <button className="text-xs text-blue-600 dark:text-blue-300 mt-3 underline" type="button" onClick={() => { setFilters({ ...EMPTY_FILTERS }); setOffer(''); setDetailPage(1) }}>Limpar filtros</button>}</section>
    <details className="ds-card p-4"><summary className="text-sm font-medium cursor-pointer">Origem e campanhas</summary><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">{[['source', 'Origem UTM'], ['medium', 'Mídia'], ['campaign', 'Campanha'], ['content', 'Conteúdo'], ['term', 'Termo']].map(([key, label]) => <div key={key}><label htmlFor={`period-utm-${key}`} className="ds-label">{label}</label><select id={`period-utm-${key}`} className="ds-input" value={filters[key]} onChange={e => changeFilter(key, e.target.value)}><option value="">Todos</option>{(key === 'platform' ? [...new Set([...(data?.sources.filter(source => source.kind === 'sale').map(source => source.platform) || []), ...filterOptions(allRecords, key)])] : filterOptions(allRecords, key)).map(value => <option key={value} value={value}>{value}</option>)}<option value={UNKNOWN}>Não informado</option></select></div>)}</div><p className="text-xs text-slate-500 mt-3">As fontes que não enviam atribuição permanecem como não informadas.</p></details>
    {error && <div className="ds-card p-4 text-red-600 text-sm" role="alert">{error}</div>}
    {loading && <div role="status" className="ds-card p-5 text-sm flex items-center gap-3"><RefreshCw size={18} className="animate-spin text-blue-600 shrink-0" /><span>{mode === 'global' ? 'Consultando as plataformas' : data ? 'Atualizando o período' : 'Preparando o período'}{progress.total > 0 && mode !== 'global' ? ` · ${progress.current} de ${progress.total} consultas concluídas` : ''}. {data ? 'Os valores anteriores permanecem disponíveis.' : 'Os valores aparecem após a consolidação.'}</span></div>}
    {mode !== 'global' && <section className="period-cache-summary" aria-label="Atualização do histórico"><p>Histórico atualizado diariamente às 04h (Brasília). Somente hoje permanece em atualização durante o dia.</p>{cacheStatus?.oldestSnapshotAt && <p>Histórico coletado: {snapshotDate(cacheStatus.oldestSnapshotAt)}{cacheStatus.newestSnapshotAt !== cacheStatus.oldestSnapshotAt ? ` a ${snapshotDate(cacheStatus.newestSnapshotAt)}` : ''} (Brasília).</p>}{cacheStatus?.todaySnapshotAt && <p>Dados de hoje coletados em {snapshotDate(cacheStatus.todaySnapshotAt)}{cacheStatus.todayNewestSnapshotAt !== cacheStatus.todaySnapshotAt ? ` a ${snapshotDate(cacheStatus.todayNewestSnapshotAt)}` : ''} (Brasília).</p>}<p>Vendas manuais e atribuições são consultadas novamente a cada carregamento. Use Atualizar para consultar novamente o período completo.</p></section>}
    {data && <>
      <ChartPanel
        className="analytics-feature period-revenue"
        title={`Evolução ${mode === 'year' ? 'mensal' : 'diária'}`}
        description={accumulated ? 'Receita acumulada desde o início do período, com séries independentes.' : 'Receita observada em cada intervalo, com séries independentes.'}
        action={<div className="period-chart-controls">
          <div className="period-segment" role="group" aria-label="Leitura da receita">
            {[[false, 'Por período'], [true, 'Acumulado']].map(([value, label]) => <button key={label} type="button" aria-pressed={accumulated === value} onClick={() => setAccumulated(value)}>{label}</button>)}
          </div>
          <div className="period-segment" role="group" aria-label="Tipo de gráfico">
            {[['area', 'Área'], ['line', 'Linhas'], ['bar', 'Barras']].map(([key, label]) => <button key={key} type="button" aria-pressed={chartMode === key} onClick={() => setChartMode(key)}>{label}</button>)}
          </div>
        </div>}
        footer={<div className="period-chart-notes">
          <p>Receita operacional mantém a regra do dashboard: líquido calculado Guru + líquido Hotmart + valor contratado TMB/Asaas/Boletex. Entradas e parcelas recebidas são apresentadas separadamente. {summary.total.revenue.missing > 0 && `${summary.total.revenue.missing} registros sem valor disponível.`}</p>
          {chart.undated > 0 && <p className="period-data-note">{count(chart.undated)} registros sem data neste eixo. Permanecem no consolidado, sem distribuição proporcional inventada.</p>}
          {accumulated && <p>Quando um intervalo não informa valor, o acumulado dessa série permanece indisponível a partir dele. Datas futuras não são projetadas.</p>}
        </div>}
      >
        <div className="period-revenue-layout">
          <div className="period-revenue-plot">
            <div className="period-plot-context"><span className="period-observed-range">{dateBR(range.startDate)} a {dateBR(range.endDate)} · {mode === 'year' ? 'mês a mês' : 'dia a dia'}</span><span className={salesPartial ? 'period-coverage period-coverage--partial' : 'period-coverage'}>{salesPartial ? 'Consolidado parcial' : 'Fontes de vendas disponíveis'}</span></div>
            <ReferenceChart rows={availableSales ? revenueRows : []} series={[{ key: 'revenue', label: 'Receita operacional', unit: 'currency' }, { key: 'digital', label: 'Guru + Hotmart', unit: 'currency' }, { key: 'boleto', label: 'Boletos', unit: 'currency' }]} title="Evolução da receita" mode={chartMode} daily={mode !== 'year'} height={410} />
          </div>
        </div>
      </ChartPanel>
      <div className="analytics-grid analytics-grid--wide">
        <ChartPanel title="Volume de vendas" description={mode === 'year' ? 'Quantidade observada em cada mês.' : 'Quantidade observada em cada dia.'} footer={salesPartial ? 'Contagem parcial das fontes disponíveis. Dados ausentes não equivalem a zero.' : 'A contagem acompanha o mesmo período e os mesmos filtros da receita.'}>
          <ReferenceChart rows={availableSales ? chart.rows : []} series={[{ key: 'count', label: 'Vendas', unit: 'count', color: 'var(--chart-2)' }]} title="Volume de vendas" mode="bar" daily={mode !== 'year'} height={285} pointLabels />
        </ChartPanel>
        <ChartPanel title="Mix de pagamentos" description="Participação na quantidade de vendas." footer={<>{salesPartial ? 'Mix parcial das vendas recebidas. ' : ''}Meios não identificados aparecem como “Não informado”.{payments.some(group => group.count < 0) && ' Ajustes negativos de contagem permanecem no consolidado e não formam fatias.'}</>}>
          <MixChart items={payments.filter(group => Number.isFinite(group.count) && group.count >= 0).map(group => ({ key: group.name, label: group.name, value: group.count }))} totalLabel="vendas no mix" emptyLabel="Sem contagem de vendas neste recorte" />
        </ChartPanel>
      </div>
      <section className="period-secondary-metrics" aria-label="Indicadores complementares">{[
        ['Guru + Hotmart', sourceAvailable(['guru', 'hotmart']) || summary.digital.count ? displayAmount(summary.digital.revenue) : '—', digitalAvailable ? `${count(summary.digital.count)} vendas digitais` : 'Vendas digitais indisponíveis'],
        ['TMB + Asaas + Boletex', sourceAvailable(['tmb', 'asaas', 'boletex']) || summary.boleto.count ? displayAmount(summary.boleto.revenue) : '—', boletoAvailable ? `${count(summary.boleto.count)} vendas contratadas${boletoPartial ? ' · parcial' : ''}` : 'Contratos indisponíveis'],
        ['Afiliações', sourceAvailable(['guru']) ? displayAmount(summary.total.affiliate) : '—', 'Líquido informado pela Guru'],
        ['Vendas do comercial', sourceAvailable(['guru']) ? displayAmount(summary.commercial.revenue) : '—', `${count(summary.commercial.count)} vendas · UTM comercial na Guru`],
        ['Entradas e recebimentos', sourceAvailable(['asaas', 'boletex']) || summary.total.received.known ? displayAmount(summary.total.received) : '—', 'Recebimentos associados às vendas disponíveis'],
      ].map(([label, value, detail]) => <article className="ds-card p-5" key={label}><h2 className="text-xs font-medium text-slate-500">{label}</h2><p className="text-xl font-semibold mt-3 tabular-nums">{value}</p><p className="text-xs text-slate-500 mt-2">{detail}</p></article>)}</section>
      <>{mode === 'year' ? <AnnualAsaasCashPanel key={`${range.startDate}:${range.endDate}`} startDate={range.startDate} endDate={range.endDate > localDateKey() ? localDateKey() : range.endDate} filters={{ ...filters, offer }} /> : <AsaasCashPanel sources={data.sources} records={filtered} filters={{ ...filters, offer }} startDate={range.startDate} endDate={range.endDate} loading={loading} error={Boolean(error)} />}</>
      <section className="ds-card p-5"><h2 className="font-semibold mb-4">Resultado por fonte</h2><div className="overflow-x-auto"><table className="data-table w-full text-sm min-w-[750px]"><thead><tr>{['Fonte', 'Vendas', 'Receita operacional', 'Valor das vendas', 'Líquido', 'Recebido', 'Pendente'].map(label => <th key={label} className="text-left text-xs font-medium text-slate-500 py-3 pr-4">{label}</th>)}</tr></thead><tbody>{platforms.map(group => <tr className="border-t border-slate-100 dark:border-slate-800" key={group.name}><td className="py-4 font-medium">{data.sources.find(source => source.id === group.name)?.label || group.name}</td><td>{count(group.count)}</td>{['revenue', 'gross', 'net', 'received', 'pending'].map(key => <td key={key} className="tabular-nums pr-4">{displayAmount(group[key])}</td>)}</tr>)}{relevantSources.filter(source => (source.reason === 'checkout_disabled' || source.status === 'not_requested') && !platforms.some(group => group.name === source.id)).map(source => <tr key={source.id}><td className="py-4 font-medium">{source.label}</td><td>—</td><td colSpan={5} className="text-slate-500">Vendas e valores contratados não informados; caixa exibido separadamente.</td></tr>)}</tbody></table></div><p className="text-xs text-slate-500 mt-4">— significa valor não disponibilizado pela fonte. Guru e Hotmart usam sempre o líquido após taxas; demais plataformas usam o valor contratado. Valor das vendas e cash collected não são somados entre si.</p></section>
      <div className="analytics-grid">
        <ChartPanel title="Famílias de produtos" description="Receita operacional por família, no recorte selecionado." footer={salesPartial ? 'Comparação parcial das fontes recebidas. Valores não informados permanecem indisponíveis.' : 'Sem distribuir valores de produtos não identificados entre as famílias.'}>
          <RankedBars items={families.map(group => rankedGroup(group, salesPartial))} limit={7} onSelect={item => changeFilter('family', item.key === 'Não informado' ? UNKNOWN : item.key)} />
        </ChartPanel>
        <ChartPanel title="Receita por fonte" description="Compare a contribuição de cada plataforma." footer="Valores operacionais das fontes. Recebimentos de caixa não são somados a contratos.">
          <RankedBars items={[
            ...platforms.map(group => rankedGroup(group, relevantSources.find(source => source.id === group.name)?.status !== 'ready', data.sources.find(source => source.id === group.name)?.label || group.name)),
            ...relevantSources.filter(source => source.kind === 'sale' && !sourceHasSales(source) && !platforms.some(group => group.name === source.id)).map(source => ({ key: source.id, label: source.label || source.platform, value: null, partial: true })),
          ]} limit={10} />
        </ChartPanel>
      </div>
      <ChartPanel title="Distribuição das vendas" description="Ranking e detalhe usam o mesmo agrupamento e os mesmos filtros."
        action={<div><label htmlFor="period-group" className="sr-only">Agrupar por</label><select id="period-group" className="ds-input text-sm" value={dimension} onChange={e => setDimension(e.target.value)}>{[['product', 'Produto'], ['family', 'Família'], ['offer', 'Oferta'], ['payment', 'Pagamento']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>}
        footer={salesPartial ? 'Ranking parcial. A participação considera somente a receita conhecida deste recorte.' : 'A participação considera somente a receita conhecida deste recorte.'}>
        <div className="period-distribution-layout">
          <div className="period-ranking"><h3>{GROUP_NAMES[dimension]} com maior receita</h3><p>Selecione um grupo para filtrar as vendas.</p><RankedBars items={groups.map(group => rankedGroup(group, salesPartial))} limit={6} onSelect={item => selectGroup(item.key)} /></div>
          <div className="period-distribution-table overflow-x-auto"><table className="data-table w-full text-sm min-w-[650px]"><thead><tr>{['Grupo', 'Vendas', 'Receita operacional', 'Participação', 'Ticket médio'].map(label => <th className="py-3 text-left text-xs font-medium text-slate-500 pr-4" key={label}>{label}</th>)}</tr></thead><tbody>{groups.map(group => <tr className="border-t border-slate-100 dark:border-slate-800" key={group.name}><td className="py-4 pr-4 max-w-sm"><button type="button" className="text-left hover:underline" onClick={() => selectGroup(group.name)}>{group.name}</button></td><td>{count(group.count)}</td><td className="tabular-nums">{displayAmount(group.revenue)}</td><td>{summary.total.revenue.value ? `${(group.revenue.value / summary.total.revenue.value * 100).toFixed(1)}%` : '—'}</td><td className="tabular-nums">{group.count && group.revenue.known ? currency(group.revenue.value / group.count) : '—'}</td></tr>)}</tbody></table>{!groups.length && <p className="py-8 text-center text-sm text-slate-500">Nenhuma venda encontrada com estes filtros.</p>}</div>
        </div>
      </ChartPanel>
      <ChartPanel title="Comercial e afiliações" description="Séries informadas pela Guru, dentro do mesmo recorte." footer="Comercial considera vendas com UTM comercial; afiliações preservam o líquido informado pela fonte.">
        <ReferenceChart rows={availableSales ? chart.rows : []} series={[{ key: 'commercial', label: 'Comercial', unit: 'currency', color: 'var(--chart-2)' }, { key: 'affiliate', label: 'Afiliação', unit: 'currency', color: 'var(--chart-3)' }]} title="Comercial e afiliações" daily={mode !== 'year'} height={255} />
      </ChartPanel>
      <section className="ds-card p-5"><div className="flex flex-wrap justify-between gap-3 items-center mb-4"><h2 className="font-semibold">Detalhamento</h2><select aria-label="Tipo de registro" className="ds-input !w-auto" value={detailKind} onChange={e => { setDetailKind(e.target.value); setDetailPage(1) }}><option value="sale">Vendas</option><option value="refund">Estornos / contestações</option></select></div><div className="overflow-x-auto"><table className="data-table w-full text-sm min-w-[800px]"><thead><tr>{['Cliente / produto', 'Data', 'Plataforma', 'Pagamento', 'Valor operacional', 'Detalhes'].map(label => <th className="text-left py-3 text-xs text-slate-500 pr-4" key={label}>{label}</th>)}</tr></thead><tbody>{visibleDetails.map((row, index) => {
        const id = `${row.id}-${index}`
        return <Fragment key={id}><tr className="border-t border-slate-100 dark:border-slate-800"><td className="py-4 pr-4 max-w-xs"><p className="font-medium">{row.buyerName || (row.isAggregate ? 'Saldo sem detalhamento' : 'Cliente não informado')}</p><p className="text-xs text-slate-500 mt-1">{row.product || 'Produto não informado'}</p></td><td className="whitespace-nowrap pr-4">{dateBR(localDay(row.date))}</td><td className="pr-4">{row.platform}{row.sourceId === 'manual' ? ' · Manual' : ''}</td><td className="pr-4">{row.payment}</td><td className="tabular-nums pr-4">{currency(row.revenue)}</td><td><button type="button" className="btn btn-ghost btn-sm" aria-label={`Detalhes de ${row.buyerName || 'registro'}`} aria-expanded={expanded === id} onClick={() => setExpanded(expanded === id ? null : id)}>{expanded === id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td></tr>{expanded === id && <tr><td colSpan={6} className="p-4 bg-slate-50 dark:bg-slate-900"><dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">{[['E-mail', row.buyerEmail || 'Não informado'], ['Oferta', row.offer || 'Não informada'], ['Identificador', row.externalId || 'Não informado'], ['Valor da venda', currency(row.gross)], ['Líquido', currency(row.net)], ['Taxas', currency(row.fees)], ['Afiliação', currency(row.affiliate)], ['Recebido', currency(row.received)], ...(!usesPlatformNet(row) ? [['Preço de tabela', currency(row.listPrice)]] : []), ['Pendente', currency(row.pending)], ['Origem UTM', row.utm.source || 'Não informada'], ['Campanha', row.utm.campaign || 'Não informada']].map(([label, value]) => <div key={label}><dt className="text-slate-500 mb-1">{label}</dt><dd className="font-medium break-words">{value}</dd></div>)}</dl>{row.isAggregate && <p className="text-xs text-amber-700 mt-4">Saldo consolidado sem transações individualizadas. Não foi distribuído entre produtos, famílias ou dias.</p>}</td></tr>}</Fragment>
      })}</tbody></table></div>{!details.length && <p className="text-center text-sm text-slate-500 py-8">Nenhum registro neste recorte.</p>}<div className="flex justify-between items-center mt-4 text-xs text-slate-500"><span>{count(details.length)} registros</span><div className="flex gap-3 items-center"><button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" disabled={currentPage === 1} onClick={() => setDetailPage(currentPage - 1)}>Anterior</button>{currentPage} / {detailPages}<button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" disabled={currentPage === detailPages} onClick={() => setDetailPage(currentPage + 1)}>Próxima</button></div></div></section>
    </>}
    {mode !== 'global' && <section className="ds-card p-5"><div className="flex flex-wrap justify-between items-center gap-3 mb-5"><div><h2 className="font-semibold">Metas do período</h2><p className="text-xs text-slate-500 mt-1">{hasFilters ? 'Progresso do recorte filtrado diante da meta geral.' : salesPartial ? 'Progresso parcial da receita operacional diante da meta geral.' : 'Progresso da receita operacional diante da meta geral.'}</p></div>{hasPermission('goals') && <Link to="/metas" className="text-sm text-blue-600 dark:text-blue-300">Gerenciar metas</Link>}</div>{goalError && <p role="alert" className="text-sm text-amber-700 mb-3">{goalError}</p>}{goalNotice && <p role="status" className="text-sm text-blue-600 mb-3">{goalNotice}</p>}{goals && <div className="grid lg:grid-cols-3 gap-5">{Object.entries(GOALS).map(([key, label]) => {
      const goal = Number(goals[key]) || 0
      const pace = goalProgress(summary.total.revenue.value, goal, range.startDate, range.endDate, localDateKey())
      return <article key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4"><h3 className="text-sm font-semibold">{label}</h3><p className="text-2xl font-semibold mt-3">{loading || !availableSales || pace.actual === null ? '—' : `${pace.actual.toFixed(1)}%`}</p><div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${loading ? 0 : Math.min(100, pace.actual || 0)}%` }} /></div><p className="text-xs text-slate-500 mt-3">Esperado (dias corridos): {pace.expected.toFixed(1)}% · Meta: {currency(goal)}</p><p className="text-xs text-slate-500 mt-1">Projeção no ritmo atual: {loading || !availableSales ? '—' : currency(pace.projected)}</p><div className="mt-4 flex gap-2"><label htmlFor={`goal-${key}`} className="sr-only">Valor da {label}</label><input disabled={!userRoles?.isAdmin || savingGoal !== null} id={`goal-${key}`} type="number" min="0" step="0.01" className="ds-input min-w-0" value={goalDraft[key] ?? ''} onChange={e => setGoalDraft(old => ({ ...old, [key]: e.target.value }))} />{userRoles?.isAdmin && <button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" disabled={savingGoal !== null} onClick={() => saveGoal(key)}>{savingGoal === key ? 'Salvando…' : 'Salvar faixas'}</button>}</div></article>
    })}</div>}</section>}
    {mode === 'global' && selectedWeek && <section className="ds-card p-5"><div className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="font-semibold">Lançamento · semana {selectedWeek.weekNumber}</h2><p className="text-xs text-slate-500 mt-1">Vendas da semana selecionada e consulta complementar de mídia.</p></div><button type="button" disabled={trafficLoading} className="btn btn-ghost disabled:opacity-40" onClick={fetchTraffic}>{trafficLoading ? 'Consultando…' : 'Consultar mídia recente'}</button></div>{trafficError && <p role="alert" className="text-sm text-amber-700 mt-4">{trafficError}</p>}{traffic && <div className="mt-5"><p className="font-semibold">Gasto recente: {traffic.mixedCurrency ? 'Contas em moedas diferentes' : currency(Number(traffic.totalSpend), traffic.currencies?.[0] || 'BRL')}</p>{traffic.partial && <p className="text-xs text-amber-700 mt-2">Consulta parcial: algumas contas não responderam.</p>}<p className="text-xs text-slate-500 mt-2">{traffic.period || 'Últimos 7 dias consultados na Meta'}. Esta consulta não fornece o intervalo histórico da semana selecionada. O ROAS da semana fica indisponível para evitar comparar períodos diferentes.</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{(traffic.accountsWithSpend || []).map(account => <div key={account.accountId} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"><p className="text-xs text-slate-500">{account.accountName}</p><p className="font-medium mt-1">{currency(Number(account.spend), account.currency || 'BRL')}</p></div>)}</div></div>}</section>}
    {data && <p className="text-xs text-slate-500 pb-4">Atualizado às {new Date(data.fetchedAt).toLocaleTimeString('pt-BR')} · Os filtros usam os registros disponíveis, sem ratear valores sem identificação.</p>}
  </div>
}
