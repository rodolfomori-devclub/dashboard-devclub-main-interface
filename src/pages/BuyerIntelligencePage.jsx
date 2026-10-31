/* eslint-disable react/prop-types -- Internal display components receive aggregate metrics only. */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { requestApi } from '../lib/api'
import { PageSkeleton } from '../components/WorkspaceLayout'
import { brazilToday, count, dateLabel, oraculoBuyersUrl, percentage, validCount, validPeriod } from '../components/buyers/buyerIntelligence'
import { BuyerHistoryOverview, BuyerProductOverview } from '../components/buyers/BuyerHistoryOverview'
import '../components/buyers/buyerIntelligence.css'

const importStatus = { COMPLETED: 'Concluída', FAILED: 'Não concluída', RUNNING: 'Em andamento', PENDING: 'Aguardando' }
function Metric({ title, value, detail, children }) {
  return <article className="buyers-metric"><h2>{title}</h2><strong>{value}</strong><p>{detail}</p>{children}</article>
}
function Distribution({ title, description, rows, denominator, empty, label }) {
  return <section className="surface-panel buyers-distribution"><header><h2>{title}</h2><p>{description}</p></header>
    {rows.length ? <table className="data-table"><thead><tr><th scope="col">{label}</th><th scope="col">Pedidos</th><th scope="col">Da base</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row"><span>{row.label}</span><span className="buyers-bar" aria-hidden="true"><i style={{ width: validCount(denominator) && denominator > 0 && validCount(row.value) ? `${Math.min(100, row.value / denominator * 100)}%` : '0%' }} /></span></th><td>{count(row.value)}</td><td>{percentage(row.value, denominator)}</td></tr>)}</tbody></table>
      : <p className="buyers-empty">{empty}</p>}
    <p className="buyers-denominator">Base de comparação: {count(denominator)} pedidos.</p>
  </section>
}

export default function BuyerIntelligencePage() {
  const [params, setParams] = useSearchParams()
  const [today] = useState(brazilToday)
  const selected = useMemo(() => {
    const value = { dateFrom: params.get('dateFrom'), dateTo: params.get('dateTo') }
    return validPeriod(value, today) ? value : { dateFrom: '2024-01-01', dateTo: today }
  }, [params, today])
  const [draft, setDraft] = useState(selected)
  const [filterError, setFilterError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const oraculoUrl = oraculoBuyersUrl(import.meta.env.VITE_ORACULO_URL)
  useEffect(() => { setDraft(selected) }, [selected])
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, data: null, error: '' })
    requestApi(`/buyer-intelligence/overview?${new URLSearchParams(selected)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ loading: false, data, error: '' }) })
      .catch(error => { if (!controller.signal.aborted) setState({ loading: false, data: null, error: error.message }) })
    return () => controller.abort()
  }, [selected, refresh])
  function apply(event) {
    event.preventDefault()
    if (!validPeriod(draft, today)) { setFilterError('Selecione um período entre 01/01/2024 e hoje, com a data inicial antes da final.'); return }
    setFilterError('')
    setParams(draft)
  }
  const data = state.data
  const launches = (data?.launchCountBeforePurchaseDistribution || []).map(row => ({ key: row.launches, label: row.launches === '0' ? 'Nenhum observado' : row.launches === '1' ? '1 lançamento' : `${row.launches} lançamentos`, value: row.purchases }))
  const sources = (data?.priorSourceDistribution || []).map(row => ({ key: row.source, label: row.source === '(sem utm_source)' ? 'Origem não informada' : row.source, value: row.purchases }))
  const linkedPercent = data ? percentage(data.linkedPurchases, data.coverage.totalPurchases) : '—'
  return <div className="hub-page buyers-intelligence-page">
    <header className="page-heading"><div><h1>Inteligência de compradores</h1><p>Conecte pedidos, produtos, inscrições e interações para conhecer a trajetória de quem compra.</p></div><div className="buyers-actions">
      {oraculoUrl && <a className="button" href={oraculoUrl} target="_blank" rel="noopener noreferrer">Abrir fichas no Oráculo<ArrowUpRight size={16} aria-hidden="true" /></a>}
      <button className="button button-primary" disabled={state.loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />{state.loading ? 'Consultando…' : 'Atualizar'}</button>
    </div></header>
    <form className="filter-bar buyers-period" onSubmit={apply} aria-label="Período dos pedidos"><label>De<input type="date" className="ds-input" min="2024-01-01" max={today} value={draft.dateFrom} onChange={event => setDraft({ ...draft, dateFrom: event.target.value })} required /></label><label>Até<input type="date" className="ds-input" min="2024-01-01" max={today} value={draft.dateTo} onChange={event => setDraft({ ...draft, dateTo: event.target.value })} required /></label><button className="button" type="submit">Aplicar período</button><p>Data do pedido, no horário de Brasília. As inscrições anteriores podem estar fora desse período.</p></form>
    {filterError && <p className="notice notice-error" role="alert">{filterError}</p>}
    {state.loading && <PageSkeleton />}
    {state.error && <section className="surface-panel buyers-error" role="alert"><h2>Consulta indisponível</h2><p>{state.error}</p><button className="button" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button></section>}
    {data && <>
      <p className="buyers-period-caption">Pedidos de {dateLabel(data.period?.dateFrom || selected.dateFrom)} a {dateLabel(data.period?.dateTo || selected.dateTo)}. Indicadores consultados na base do Oráculo.</p>
      <section className="surface-panel buyers-coverage" aria-label="Cobertura dos vínculos"><div className="buyers-coverage-main"><h2>Quanto da base já está conectado?</h2><p><strong>{linkedPercent}</strong><span>{count(data.linkedPurchases)} de {count(data.coverage.totalPurchases)} pedidos ligados a um perfil</span></p><div className="buyers-coverage-track" aria-hidden="true"><i style={{ width: data.coverage.totalPurchases ? `${Math.min(100, data.linkedPurchases / data.coverage.totalPurchases * 100)}%` : '0%' }} /></div><small>Vínculos de identidade registrados. Um perfil ainda pode exigir revisão.</small></div><dl><div><dt>Pedidos aprovados</dt><dd>{count(data.approvedPurchases)}</dd></div><div><dt>Aprovados com perfil</dt><dd>{count(data.approvedLinkedPurchases)}</dd></div><div><dt>Pedidos sem vínculo ativo</dt><dd>{count(data.unlinkedPurchases)}</dd></div><div><dt>Pendentes de revisão</dt><dd>{count(data.reviewPending)}</dd></div></dl></section>
      {data.coverage.totalPurchases === 0 && <p className="notice">Nenhum pedido observado neste período. Amplie as datas para consultar outro recorte.</p>}
      <section className="buyers-metric-grid" aria-label="Indicadores de compradores">
        <Metric title="Perfis com pedidos aprovados" value={count(data.profiles)} detail={`${count(data.coverage.withLeadProfiles)} ${data.coverage.withLeadProfiles === 1 ? 'tem' : 'têm'} cadastro de lead vinculado.`}><small>Perfis agrupados por evidências, não pessoas únicas confirmadas.</small></Metric>
        <Metric title="Indício de recompra" value={percentage(data.repeatBuyerProfiles, data.denominators?.repeatBuyerProfiles)} detail={`${count(data.repeatBuyerProfiles)} de ${count(data.denominators?.repeatBuyerProfiles)} perfis têm mais de um pedido aprovado no período.`}><small>{count(data.crossProviderProfiles)} {data.crossProviderProfiles === 1 ? 'perfil tem' : 'perfis têm'} pedidos em mais de uma plataforma; pode haver duplicidade.</small></Metric>
        <Metric title="Inscrição anterior à compra" value={percentage(data.approvedWithPriorParticipation, data.approvedLinkedPurchases)} detail={`${count(data.approvedWithPriorParticipation)} de ${count(data.approvedLinkedPurchases)} pedidos aprovados com perfil têm inscrição anterior registrada.`}><small>Inscrição não comprova presença em aulas ou engajamento.</small></Metric>
        <Metric title="UTM anterior observada" value={percentage(data.approvedWithPriorUtm, data.approvedLinkedPurchases)} detail={`${count(data.approvedWithPriorUtm)} de ${count(data.approvedLinkedPurchases)} pedidos aprovados com perfil têm ao menos uma UTM em inscrição anterior.`}><small>Uma UTM disponível não comprova qual anúncio causou a compra.</small></Metric>
      </section>
      <div className="buyers-distribution-grid">
        <Distribution title="Lançamentos antes da compra" description="Lançamentos distintos com inscrição registrada antes de cada pedido aprovado com perfil." rows={launches} denominator={data.denominators?.launchDistribution} label="Lançamentos observados" empty="Nenhum pedido aprovado com perfil neste período." />
        <Distribution title="Origem da última inscrição" description="UTM Source da inscrição mais recente anterior a cada pedido. Somente pedidos com inscrição anterior registrada." rows={sources} denominator={data.denominators?.priorSourceDistribution} label="Origem observada" empty="Nenhuma inscrição anterior registrada para os pedidos deste período." />
      </div>
      <BuyerHistoryOverview data={data} />
      <BuyerProductOverview data={data} />
      <section className="surface-panel buyers-reading"><h2>Como interpretar esta leitura</h2><p>{data.notice}</p><p>“Nenhum observado” significa que a base não contém uma inscrição anterior vinculada. Isso não prova que a pessoa comprou no primeiro contato. Valores financeiros continuam nos relatórios de vendas e conciliação.</p><div className="buyers-reading-footer"><span>{data.lastImport ? `Última importação: ${dateLabel(data.lastImport.completedAt, true)} · ${importStatus[data.lastImport.status] || data.lastImport.status}` : 'Nenhuma importação histórica registrada.'}</span>{oraculoUrl && <a href={oraculoUrl} target="_blank" rel="noopener noreferrer">Consultar histórico individual no Oráculo<ArrowUpRight size={14} aria-hidden="true" /></a>}</div></section>
    </>}
  </div>
}
