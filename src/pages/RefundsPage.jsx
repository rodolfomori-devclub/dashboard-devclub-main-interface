import { useState, useEffect, useMemo, Fragment } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Search, CircleAlert } from 'lucide-react'
import { refundsService } from '../services/refundsService'
import RefundSummary from '../components/charts/RefundSummary'

const SOURCES = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', typeform: 'Typeform', spreadsheet: 'Planilha' }
const STATUSES = { refunded: 'Reembolso confirmado', partially_refunded: 'Reembolso parcial', requested: 'Solicitado', retained: 'Retido no atendimento', reported_refunded: 'Informado na planilha', chargeback: 'Chargeback', dispute: 'Em contestação', rejected: 'Venda rejeitada', cancelled: 'Pedido cancelado' }
const COVERAGE = { available: 'Disponível', limited: 'Cobertura limitada', partial: 'Dados parciais', unavailable: 'Indisponível' }
const BASIS = { refund: 'Cancelamento / estorno', purchase: 'Compra / efetivação', request: 'Solicitação', unknown: 'Não informada' }
const PAGE_SIZE = 20
const initialPeriod = () => {
  const query = new URLSearchParams(window.location.search)
  const startDate = query.get('startDate'), endDate = query.get('endDate')
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (validDate(startDate) && validDate(endDate) && startDate <= endDate && Date.parse(endDate) - Date.parse(startDate) <= 365 * 86400000) return { startDate, endDate }
  const now = new Date()
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) }
}
const dateLabel = value => value ? value.split('-').reverse().join('/') : 'Não informada'
const money = (value, currency) => {
  if (value === null || value === undefined) return 'Não informado'
  if (!currency) return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · moeda não informada`
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value) }
  catch { return `${value} ${currency}` }
}
const badgeClass = kind => kind === 'confirmed' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200' : kind === 'request' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'

export default function RefundsPage() {
  const [period, setPeriod] = useState(initialPeriod)
  const [draft, setDraft] = useState(initialPeriod)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [source, setSource] = useState('all')
  const [status, setStatus] = useState('all')
  const [product, setProduct] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setResult(null)
    refundsService.getOverview({ ...period, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setResult(data); setPage(1) } })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.error || 'Não foi possível carregar os dados. Tente novamente.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [period, refresh])

  const records = useMemo(() => result?.data || [], [result])
  const products = useMemo(() => [...new Set(records.map(r => r.product).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [records])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return records.filter(row => {
      if (source !== 'all' && !row.sources.includes(source) && row.platform !== source) return false
      if (status !== 'all' && row.status !== status) return false
      if (product !== 'all' && row.product !== product) return false
      if (view === 'confirmed' && row.kind !== 'confirmed') return false
      if (view === 'requests' && !['request', 'reported'].includes(row.kind)) return false
      if (view === 'exceptions' && !['dispute', 'cancelled'].includes(row.kind)) return false
      return !term || [row.name, row.email, row.contact, row.product, row.transactionId, row.reason].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))
    })
  }, [records, source, status, product, search, view])
  const counts = useMemo(() => ({ confirmed: filtered.filter(r => r.kind === 'confirmed').length, requests: filtered.filter(r => r.kind === 'request').length, reported: filtered.filter(r => r.kind === 'reported').length, exceptions: filtered.filter(r => ['dispute', 'cancelled'].includes(r.kind)).length }), [filtered])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visiblePage = Math.min(page, pages)
  const visibleRows = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)
  const hasFilters = source !== 'all' || status !== 'all' || product !== 'all' || search || view !== 'all'
  const anySourceAvailable = result?.sources?.some(s => ['available', 'limited', 'partial'].includes(s.status))

  function applyPeriod(event) {
    event.preventDefault()
    if (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate) { setDateError('Escolha um período válido, com início anterior ou igual ao fim.'); return }
    if ((Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000 > 365) { setDateError('Selecione até 366 dias. Períodos menores agilizam a consulta TMB.'); return }
    setDateError(''); setPeriod({ ...draft }); setExpanded(null)
  }
  function setFilter(setter, value) { setter(value); setPage(1); setExpanded(null) }
  function clearFilters() { setSource('all'); setStatus('all'); setProduct('all'); setSearch(''); setView('all'); setPage(1); setExpanded(null) }
  function toggle(row) { setExpanded(expanded === row.id ? null : row.id) }

  function renderDetails(row, prefix) {
    return <div id={`${prefix}-${row.id}`} className="p-5 bg-slate-50 dark:bg-slate-900">
      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-4 text-sm">
        {[
          ['Identificador da compra', row.transactionId || 'Não vinculado'], ['Status na origem', row.originalStatus || 'Não informado'],
          ['Data da compra', dateLabel(row.purchasedAt)], ['Data da solicitação', dateLabel(row.requestedAt)],
          [row.kind === 'reported' ? 'Estorno informado no atendimento' : 'Data de cancelamento / estorno', dateLabel(row.refundedAt)],
          ['Valor efetivamente devolvido', money(row.refundAmount, row.currency)], ['Forma de pagamento', row.paymentMethod || 'Não informada'], ['Contato', row.contact || 'Não informado'],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</dt><dd className="font-medium break-words">{value}</dd></div>)}
      </dl>
      {(row.reason || row.classification) && <p className="mt-5 text-sm"><span className="font-semibold">Motivo: </span>{[row.classification, row.reason].filter(Boolean).join(' · ')}</p>}
      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{row.note}</p>
      {row.sources.length > 1 && <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Solicitação conciliada entre planilha e Typeform por e-mail, produto e data.</p>}
    </div>
  }

  return <div className="hub-page space-y-6">
    <header className="page-heading flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Financeiro / Atendimento</p><h1 className="text-3xl font-semibold">Reembolsos</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">Acompanhe devoluções confirmadas, solicitações e cancelamentos em um só lugar.</p></div>
      <button type="button" className="btn btn-ghost disabled:opacity-50" onClick={() => setRefresh(r => r + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Consultando fontes' : 'Atualizar'}</button>
    </header>
    <form onSubmit={applyPeriod} className="filter-bar ds-card p-4 flex flex-wrap items-end gap-3">
      <div><label htmlFor="refund-start" className="ds-label">De</label><input id="refund-start" className="ds-input" type="date" required value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} /></div>
      <div><label htmlFor="refund-end" className="ds-label">Até</label><input id="refund-end" className="ds-input" type="date" required min={draft.startDate} value={draft.endDate} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))} /></div>
      <button type="submit" className="btn btn-primary">Aplicar período <ArrowUpRight size={15} aria-hidden="true" /></button><p className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto py-2">{dateLabel(period.startDate)} — {dateLabel(period.endDate)}</p>
      {dateError && <p className="basis-full text-sm text-red-600" role="alert">{dateError}</p>}
    </form>
    {error && <div role="alert" className="ds-card p-5 border-red-200 flex flex-wrap items-center gap-3"><CircleAlert size={18} className="text-red-500 shrink-0" /><p className="text-sm">{error}</p><button className="btn btn-ghost ml-auto" type="button" onClick={() => setRefresh(r => r + 1)}>Tentar novamente</button></div>}
    <section aria-label="Disponibilidade das fontes" className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {Object.entries(SOURCES).map(([id, label]) => {
        const state = result?.sources?.find(s => s.id === id)
        const available = state && state.status !== 'unavailable'
        return <article key={id} className="ds-card p-4"><div className="flex justify-between gap-3 items-center"><h2 className="text-sm font-semibold">{label}</h2><span className={`h-2 w-2 rounded-full ${loading ? 'bg-slate-300 animate-pulse' : state?.status === 'available' ? 'bg-blue-500' : 'bg-amber-500'}`} aria-hidden="true" /></div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">{loading ? 'Consultando…' : COVERAGE[state?.status] || 'Não consultada'}{available && !loading ? ` · ${state.recordCount} registros` : ''}</p><p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{state?.message || (loading ? 'Aguardando resposta da fonte.' : 'Sem dados disponíveis nesta consulta.')}</p></article>
      })}
    </section>
    {result?.incomplete && <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 p-4 text-amber-900 dark:text-amber-100 text-sm"><CircleAlert size={18} className="shrink-0 mt-0.5" /><p>Algumas fontes estão indisponíveis ou incompletas. Os números abaixo representam somente os registros recebidos; ausência de dados não significa ausência de reembolsos.</p></div>}
    <RefundSummary records={filtered} sources={result?.sources || []} platform={Object.keys(SOURCES).includes(source) && !['typeform', 'spreadsheet'].includes(source) ? source : ''} overview ready={Boolean(result)} loading={loading} showLink={false} />
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Resumo dos registros filtrados">
      {[
        ['Confirmados nas plataformas', counts.confirmed, 'Totais e parciais, por status'], ['Solicitações de atendimento', counts.requests, 'Inclui pedidos retidos'],
        ['Informados na planilha', counts.reported, 'Sem confirmação financeira vinculada'], ['Contestações e cancelamentos', counts.exceptions, 'Não somam aos reembolsos confirmados'],
      ].map(([label, value, detail]) => <article className="ds-card p-5" key={label}><h2 className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</h2><p className="text-3xl font-semibold tracking-tight mt-4 tabular-nums">{loading || !anySourceAvailable ? '—' : value.toLocaleString('pt-BR')}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{detail}</p></article>)}
    </section>
    <section className="surface-panel ds-card overflow-hidden" aria-labelledby="refund-list-title">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-2"><h2 id="refund-list-title" className="text-base font-semibold">Histórico de registros</h2><span className="text-xs text-slate-500">{loading ? 'Carregando…' : `${filtered.length} registros encontrados`}</span></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">O período considera cancelamento na Guru, compra/efetivação na Hotmart e TMB, e abertura nas solicitações. Valores de compra não representam o total devolvido.</p>
        <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Tipo de registro">{[['all', 'Todos'], ['confirmed', 'Confirmados'], ['requests', 'Atendimento'], ['exceptions', 'Contestações e cancelamentos']].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setFilter(setView, key)} className={`btn btn-sm ${view === key ? 'btn-primary' : 'btn-ghost'}`}>{label}</button>)}</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          <div><label htmlFor="refund-search" className="ds-label">Buscar</label><div className="relative"><Search size={16} aria-hidden="true" className="absolute left-3 top-3 text-slate-400" /><input id="refund-search" type="search" className="ds-input pl-9" placeholder="Nome, e-mail, compra ou motivo" value={search} onChange={e => setFilter(setSearch, e.target.value)} /></div></div>
          <div><label htmlFor="refund-source" className="ds-label">Fonte / plataforma</label><select id="refund-source" className="ds-input" value={source} onChange={e => setFilter(setSource, e.target.value)}><option value="all">Todas as fontes</option>{Object.entries(SOURCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div><label htmlFor="refund-status" className="ds-label">Status</label><select id="refund-status" className="ds-input" value={status} onChange={e => setFilter(setStatus, e.target.value)}><option value="all">Todos os status</option>{Object.entries(STATUSES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div><label htmlFor="refund-product" className="ds-label">Produto</label><select id="refund-product" className="ds-input" value={product} onChange={e => setFilter(setProduct, e.target.value)}><option value="all">Todos os produtos</option>{products.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        </div>{hasFilters && <button type="button" className="text-xs text-blue-600 dark:text-blue-300 mt-3 underline underline-offset-4" onClick={clearFilters}>Limpar filtros</button>}
      </div>
      {loading ? <div role="status" className="p-12 text-center text-sm text-slate-500"><RefreshCw size={24} className="animate-spin mx-auto mb-4 text-blue-500" aria-hidden="true" />Consultando fontes e conciliando registros. A TMB pode levar mais tempo.</div>
        : !visibleRows.length ? <div className="py-16 px-6 text-center"><ArrowDownLeft size={28} className="mx-auto text-slate-400 mb-4" aria-hidden="true" /><h3 className="font-semibold">{error || !anySourceAvailable ? 'Dados indisponíveis' : 'Nenhum registro neste recorte'}</h3><p className="text-sm text-slate-500 mt-2">{error || !anySourceAvailable ? 'Verifique o estado das fontes e tente atualizar.' : 'Ajuste o período ou os filtros para consultar outros registros.'}</p>{hasFilters && <button type="button" className="btn btn-ghost mt-5" onClick={clearFilters}>Limpar filtros</button>}</div>
          : <>
            <div className="hidden md:block overflow-x-auto"><table className="data-table w-full text-sm min-w-[880px]"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs"><tr>{['Data de referência', 'Cliente / produto', 'Fonte', 'Status', 'Valor da compra', 'Detalhes'].map(label => <th key={label} scope="col" className="text-left px-5 py-3 font-medium">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleRows.map(row => <Fragment key={row.id}>
                <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="px-5 py-4 whitespace-nowrap"><p className="font-medium">{dateLabel(row.referenceDate)}</p><p className="text-xs text-slate-500 mt-1">{BASIS[row.dateBasis]}</p></td>
                  <td className="px-5 py-4 max-w-xs"><p className="font-medium">{row.name || 'Cliente não informado'}</p><p className="text-xs text-slate-500 mt-1 break-all">{row.email || 'E-mail não informado'}</p><p className="text-xs mt-2">{row.product || 'Produto não informado'}</p></td>
                  <td className="px-5 py-4 text-xs">{row.sources.map(s => SOURCES[s]).join(' + ')}{row.platform && !row.sources.includes(row.platform) && <p className="text-slate-500 mt-1">{SOURCES[row.platform]}</p>}</td>
                  <td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${badgeClass(row.kind)}`}>{STATUSES[row.status] || row.originalStatus}</span></td>
                  <td className="px-5 py-4 tabular-nums text-xs">{money(row.saleAmount, row.currency)}</td>
                  <td className="px-5 py-4"><button type="button" aria-label={`Detalhes de ${row.name || row.product || 'registro'}`} aria-expanded={expanded === row.id} aria-controls={`desktop-${row.id}`} className="btn btn-ghost btn-sm" onClick={() => toggle(row)}>{expanded === row.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></td>
                </tr>{expanded === row.id && <tr><td colSpan={6} className="p-0">{renderDetails(row, 'desktop')}</td></tr>}
              </Fragment>)}</tbody></table></div>
            <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">{visibleRows.map(row => <li key={row.id}><div className="p-5 space-y-3">
              <div className="flex justify-between items-start gap-3"><div><p className="font-semibold text-sm">{row.name || 'Cliente não informado'}</p><p className="text-xs text-slate-500 mt-1 break-all">{row.email || row.product || 'Não informado'}</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label={`Detalhes de ${row.name || 'registro'}`} aria-expanded={expanded === row.id} aria-controls={`mobile-${row.id}`} onClick={() => toggle(row)}>{expanded === row.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div>
              <p className="text-xs">{row.product || 'Produto não informado'}</p><span className={`inline-flex px-2.5 py-1 rounded-md text-xs ${badgeClass(row.kind)}`}>{STATUSES[row.status]}</span><div className="flex justify-between gap-3 text-xs text-slate-500"><span>{row.sources.map(s => SOURCES[s]).join(' + ')}</span><span>{dateLabel(row.referenceDate)} · {BASIS[row.dateBasis]}</span></div><p className="text-xs">Valor da compra: {money(row.saleAmount, row.currency)}</p>
            </div>{expanded === row.id && renderDetails(row, 'mobile')}</li>)}</ul>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 text-xs text-slate-500"><span>{(visiblePage - 1) * PAGE_SIZE + 1}–{Math.min(visiblePage * PAGE_SIZE, filtered.length)} de {filtered.length}</span><div className="flex items-center gap-3"><button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" aria-label="Página anterior" disabled={visiblePage === 1} onClick={() => { setPage(visiblePage - 1); setExpanded(null) }}><ChevronLeft size={16} /></button><span>{visiblePage} / {pages}</span><button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" aria-label="Próxima página" disabled={visiblePage === pages} onClick={() => { setPage(visiblePage + 1); setExpanded(null) }}><ChevronRight size={16} /></button></div></div>
          </>}
    </section>
    {result && <footer className="text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between gap-2 pb-4"><p>{result.deduplication.removed} registros conciliados · {result.excludedUndated} sem data para o período</p><p>Consulta às {new Date(result.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{result.fromCache ? ' · cache de até 1 min' : ''}</p></footer>}
  </div>
}
