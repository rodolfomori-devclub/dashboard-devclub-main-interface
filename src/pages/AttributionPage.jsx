/* eslint-disable react/prop-types -- Local view components share the typed API contract. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, Check, History, Plus, RefreshCw, Search, X } from 'lucide-react'
import { loadSalesRange, localDateKey, invalidateSalesCache } from '../components/daily/dailyData'
import { createManualSale, getSalesAudit, getSalesLedger, getSalesSellers, manualSaleRecord, mergeSalesOperations, reconcileManualSale, retrySalesSync, saleSnapshot, saveSaleAttribution } from '../services/salesOpsService'
import { formatCurrency } from '../utils/currencyUtils'
import { useQueryClient } from '@tanstack/react-query'
import UtmDetails from '../components/attribution/UtmDetails'
import { UTM_FIELDS } from '../utils/salesData'
import { isNetSalesPlatform, usesPlatformNet } from '../utils/platformCash'
import UtmMappings from '../components/attribution/UtmMappings'
import '../components/attribution/attribution.css'

const FAMILIES = ['MBA', 'DevClub', 'IAClub', 'Seu segundo salário com IA']
const PLATFORMS = ['Guru', 'TMB', 'Asaas', 'Boletex', 'Hotmart', 'Pix direto', 'Transferência', 'Outro']
const money = (value) => value == null ? 'Não informado' : formatCurrency(value)
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada'
const sourceKey = (row) => JSON.stringify([row.source || row.sourceId, row.externalId])
const EMPTY_LEDGER = { attributions: [], manualSales: [] }

function Field({ label, children }) {
  return <label className="flex flex-col gap-1.5 text-sm"><span style={{ color: 'var(--muted)' }}>{label}</span>{children}</label>
}

function Modal({ title, onClose, children }) {
  const dialog = useRef(null)
  useEffect(() => { const node = dialog.current, opener = document.activeElement; node.showModal(); return () => { node.close(); opener?.focus?.() } }, [])
  return <dialog ref={dialog} className="ds-modal" style={{ maxWidth: 760, padding: 24, color: 'var(--text)', margin: 'auto' }} onCancel={event => { event.preventDefault(); onClose() }} aria-label={title}>
    <div className="flex items-center justify-between gap-4 mb-6"><h2 className="text-xl font-semibold">{title}</h2><button className="button" type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
    {children}
  </dialog>
}

function OperationForm({ mode, row, sellers, candidates, onClose, onSaved }) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [manualId] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState({
    sellerId: row?.sellerId || '', status: row?.status || 'reconciled', note: row?.note || '',
    date: localDateKey(), product: '', family: 'DevClub', buyerName: '', buyerEmail: '', gross: '', net: '', cashCollected: '', platform: 'Pix direto',
    source: '', medium: '', campaign: '', content: '', term: '', target: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const netPlatform = isNetSalesPlatform(form.platform)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const input = (key, type = 'text', required = true) => <input className="ds-input" type={type} value={form[key]} onChange={set(key)} required={required} maxLength={type === 'text' ? 500 : undefined} {...(type === 'number' ? { min: 0, step: '0.01' } : {})} />
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      let saved
      if (mode === 'manual') {
        saved = await createManualSale({
          requestId, id: manualId, sellerId: form.sellerId, date: form.date, product: form.product, family: form.family,
          buyerName: form.buyerName, buyerEmail: form.buyerEmail || null, gross: netPlatform ? form.net : form.gross, net: form.net,
          cashCollected: netPlatform ? form.net : form.cashCollected, platform: form.platform, note: form.note,
          utm: Object.fromEntries(['source', 'medium', 'campaign', 'content', 'term'].map((field) => [field, form[field] || null])),
        })
      } else if (mode === 'reconcile') {
        const target = candidates.find((candidate) => sourceKey(candidate) === form.target)
        if (!target) throw new Error('Selecione a transação original da plataforma.')
        saved = await reconcileManualSale(row.manualId, { requestId, source: target.source || target.sourceId, externalId: target.externalId, snapshot: saleSnapshot(target), note: form.note })
      } else {
        saved = await saveSaleAttribution({ requestId, source: row.source || row.sourceId, externalId: row.externalId,
          sellerId: form.sellerId, status: form.status, note: form.note, snapshot: saleSnapshot(row) })
      }
      await onSaved(saved)
    } catch (failure) { setError(failure.message) }
    finally { setSaving(false) }
  }
  return <Modal title={mode === 'manual' ? 'Registrar venda manual' : mode === 'reconcile' ? 'Conciliar venda manual' : 'Atribuir venda'} onClose={saving ? () => {} : onClose}>
    <form onSubmit={submit} className="space-y-5">
      {row && <div className="notice"><strong>{row.buyerName || 'Cliente não informado'}</strong><p>{row.product || 'Produto não informado'} · {row.platform}</p><p>{usesPlatformNet(row) ? 'Venda líquida após taxas' : 'Valor contratado'} {money(row.gross)}{!usesPlatformNet(row) && ` · Líquido ${money(row.net)}`} · Cash collected {money(row.received)}</p></div>}
      {row && <div className="attribution-utm-form"><h3>UTMs informadas na venda</h3><p>Estes são os dados de origem recebidos. O vendedor escolhido manualmente terá prioridade sobre o vínculo por UTM.</p><UtmDetails utm={row.utm} expanded/></div>}
      {mode !== 'reconcile' && <Field label="Vendedor responsável"><select className="ds-input" value={form.sellerId} onChange={set('sellerId')} required><option value="">Selecione um vendedor</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></Field>}
      {mode === 'manual' && <>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Data da venda">{input('date', 'date')}</Field><Field label="Família do produto"><select className="ds-input" value={form.family} onChange={set('family')}>{FAMILIES.map((family) => <option key={family}>{family}</option>)}</select></Field></div>
        <Field label="Produto / oferta">{input('product')}</Field>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Nome do cliente">{input('buyerName')}</Field><Field label="E-mail do cliente (opcional)">{input('buyerEmail', 'email', false)}</Field></div>
        <Field label="Plataforma / recebimento"><select className="ds-input" value={form.platform} onChange={set('platform')}>{PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select></Field>
        {netPlatform ? <>
          <Field label="Valor líquido após taxas (R$)">{input('net', 'number')}</Field>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Guru e Hotmart usam este líquido como valor da venda e cash collected integral, já com as taxas descontadas.</p>
        </> : <>
          <div className="grid sm:grid-cols-3 gap-4"><Field label="Valor contratado (R$)">{input('gross', 'number')}</Field><Field label="Valor líquido informado (R$)">{input('net', 'number')}</Field><Field label="Caixa recebido (R$)">{input('cashCollected', 'number')}</Field></div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Informe cada valor separadamente. O líquido compõe a receita manual; o cash collected considera 40% do contratado na TMB e o caixa declarado nas demais plataformas.</p>
        </>}
        <section className="attribution-utm-form"><h3>Origem e UTMs</h3><p>Informe os campos disponíveis na venda. O vendedor selecionado acima será o responsável, mesmo que a UTM esteja vinculada a outra pessoa.</p><div className="grid sm:grid-cols-2 gap-4">{UTM_FIELDS.map(field => <Field key={field} label={`UTM ${field}`}>{input(field, 'text', false)}</Field>)}</div></section>
      </>}
      {mode === 'assign' && <Field label="Situação da conferência"><select className="ds-input" value={form.status} onChange={set('status')}><option value="pending">Pendente</option><option value="reconciled">Conciliada</option></select></Field>}
      {mode === 'reconcile' && <>
        <div className="notice">Ao vincular, os totais passam a considerar somente a transação da plataforma. O registro manual e seu histórico serão preservados.</div>
        <Field label="Transação da plataforma"><select className="ds-input" value={form.target} onChange={set('target')} required><option value="">Selecione a venda correspondente</option>{candidates.map((candidate) => <option key={sourceKey(candidate)} value={sourceKey(candidate)}>{candidate.platform} · {candidate.buyerName || candidate.externalId} · {candidate.product} · {money(candidate.gross)}</option>)}</select></Field>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Somente transações com identificador de origem aparecem aqui. Amplie o período se a venda estiver em outra data.</p>
      </>}
      <Field label="Observação interna"><textarea className="ds-input" rows={3} maxLength={4000} value={form.note} onChange={set('note')} /></Field>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="flex justify-end gap-3 pt-3"><button className="button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || (mode !== 'reconcile' && !sellers.length)}>{saving ? 'Salvando…' : mode === 'reconcile' ? 'Confirmar conciliação' : 'Salvar venda'}</button></div>
    </form>
  </Modal>
}

function AuditView({ row, onClose }) {
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getSalesAudit(row.isManual ? 'manual' : 'attribution', row.manualId || row.attributionId).then((data) => { if (active) setHistory(data) }, (failure) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [row])
  const actions = { created: 'Venda manual registrada', assigned: 'Vendedor atribuído', reassigned: 'Atribuição atualizada', reconciled: 'Venda manual conciliada', 'manual-linked': 'Registro manual vinculado' }
  return <Modal title="Histórico da venda" onClose={onClose}>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {!history && !error && <p role="status">Carregando histórico…</p>}
    {history?.length === 0 && <p className="notice">Nenhuma alteração registrada.</p>}
    <ol className="space-y-4">{history?.map((entry) => <li key={entry.id} className="surface-panel p-4"><div className="flex justify-between gap-3"><strong>{actions[entry.action] || entry.action}</strong><span className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(entry.created_at).toLocaleString('pt-BR')}</span></div><p className="text-sm mt-2">Responsável: {entry.before_data?.seller_name && entry.before_data.seller_name !== entry.after_data.seller_name ? `${entry.before_data.seller_name} → ` : ''}{entry.after_data.seller_name}</p>{entry.after_data.note && <p className="text-sm mt-2">{entry.after_data.note}</p>}<p className="text-xs mt-3 break-all" style={{ color: 'var(--muted)' }}>Operador Vault: {entry.actor_id}</p></li>)}</ol>
  </Modal>
}

export default function AttributionPage() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(() => ({ from: localDateKey(), to: localDateKey() }))
  const [data, setData] = useState(null)
  const [ledger, setLedger] = useState(EMPTY_LEDGER)
  const [sellers, setSellers] = useState([])
  const [filters, setFilters] = useState({ search: '', source: '', status: '', seller: '', identification: 'all', utmSource: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sellerError, setSellerError] = useState('')
  const [notice, setNotice] = useState('')
  const [operation, setOperation] = useState(null)
  const [audit, setAudit] = useState(null)
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(null)
  const sequence = useRef(0)

  const load = useCallback(async (force = false) => {
    const request = ++sequence.current
    setLoading(true); setError('')
    try {
      const [result, privateLedger] = await Promise.all([
        loadSalesRange(period.from, period.to, { force }),
        getSalesLedger(period.from, period.to, { privateNotes: true }).catch(() => null),
      ])
      if (request === sequence.current) {
        setData(result); setLedger(privateLedger || result.ledger || EMPTY_LEDGER)
        if (result.operationsStatus !== 'ready') setError(result.operationsError || 'O registro de atribuições está indisponível.')
        else if ((privateLedger || result.ledger)?.attributionMappingsStatus === 'unavailable') setError('Não foi possível consultar os vínculos de UTM. As vendas sem atribuição manual podem estar sem vendedor nesta leitura.')
      }
    } catch (failure) { if (request === sequence.current) setError(failure.message) }
    finally { if (request === sequence.current) setLoading(false) }
  }, [period.from, period.to])
  useEffect(() => { load(); return () => { sequence.current += 1 } }, [load])
  useEffect(() => {
    let active = true
    getSalesSellers().then((result) => { if (active) setSellers(result) }, (failure) => { if (active) setSellerError(failure.message) })
    return () => { active = false }
  }, [])
  const currentData = data?.startDate === period.from && data?.endDate === period.to ? data : null
  const records = useMemo(() => mergeSalesOperations(currentData?.records || [], currentData ? ledger : EMPTY_LEDGER).filter((row) => row.kind === 'sale'), [currentData, ledger])
  const linkedManuals = (currentData ? ledger.manualSales : []).filter((sale) => sale.linkedExternalId).map((sale) => ({ ...manualSaleRecord(sale), isLinkedManual: true }))
  const rows = [...records, ...linkedManuals].filter((row) => !row.isAggregate).filter((row) => {
    const search = filters.search.toLocaleLowerCase('pt-BR')
    return (!filters.source || (row.source || row.sourceId) === filters.source)
      && (!filters.status || (filters.status === 'sync-pending' ? row.syncPending : (row.status || 'pending') === filters.status))
      && (!filters.seller || row.sellerId === filters.seller)
      && (filters.identification === 'all' || row.attributionMethod === filters.identification)
      && (!filters.utmSource || row.utm?.source === filters.utmSource)
      && (!search || [row.buyerName, row.buyerEmail, row.product, row.externalId, row.sellerName, ...UTM_FIELDS.map(field => row.utm?.[field])].join(' ').toLocaleLowerCase('pt-BR').includes(search))
  })
  const observedUtmSources = [...new Set(records.map(row => row.utm?.source).filter(value => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const pages = Math.max(1, Math.ceil(rows.length / 25))
  const actualPage = Math.min(page, pages)
  const visibleRows = rows.slice((actualPage - 1) * 25, actualPage * 25)
  const manualRows = records.filter((row) => row.isManual)
  const candidates = records.filter((row) => !row.isManual && row.canAttribute && !row.isAggregate)
  const updateFilter = (key) => (event) => { setFilters((value) => ({ ...value, [key]: event.target.value })); setPage(1) }
  const afterSave = async (saved) => {
    invalidateSalesCache()
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['commissions'] })
    queryClient.invalidateQueries({ queryKey: ['automatic-commissions'] })
    setOperation(null)
    setNotice(saved.syncPending ? 'Registro salvo. A sincronização com a operação comercial está pendente; você pode tentar novamente na lista.' : 'Registro salvo e operação comercial atualizada.')
    try { setLedger(await getSalesLedger(period.from, period.to, { privateNotes: true })) }
    catch { setError('A alteração foi salva, mas não foi possível atualizar a lista. Clique em Atualizar.'); }
  }
  const retry = async (row) => {
    setSyncing(row.id); setError('')
    try { await afterSave(await retrySalesSync(row.isManual ? 'manual' : 'attribution', row.manualId || row.attributionId)) }
    catch (failure) { setError(failure.message) }
    finally { setSyncing(null) }
  }
  return <div className="hub-page space-y-5">
    <header className="page-heading"><div><h1>Atribuição e conciliação</h1><p>Vendas identificadas por UTM ou manualmente. Guru e Hotmart: líquido após taxas; demais: valor contratado.</p></div><div className="flex flex-wrap gap-2"><button className="button" onClick={() => load(true)} disabled={loading}><RefreshCw size={16} />{loading ? 'Atualizando…' : 'Atualizar'}</button><button className="button button-primary" onClick={() => setOperation({ mode: 'manual' })} disabled={!sellers.length}><Plus size={16} />Venda manual</button></div></header>
    {notice && <div className="notice flex items-center justify-between gap-3" role="status"><span>{notice}</span><button className="icon-button" aria-label="Fechar mensagem" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {sellerError && <div className="notice notice-error" role="alert">Vendedores indisponíveis: {sellerError}</div>}
    <UtmMappings sellers={sellers} observedSources={observedUtmSources} onChanged={async () => { invalidateSalesCache(); queryClient.invalidateQueries({ queryKey: ['commissions'] }); queryClient.invalidateQueries({ queryKey: ['automatic-commissions'] }); await load() }}/>
    <section className="filter-bar attribution-filters" aria-label="Filtros das vendas"><Field label="De"><input type="date" className="ds-input" value={period.from} onChange={(event) => { setPeriod({ ...period, from: event.target.value }); setPage(1) }} /></Field><Field label="Até"><input type="date" className="ds-input" value={period.to} onChange={(event) => { setPeriod({ ...period, to: event.target.value }); setPage(1) }} /></Field><Field label="Fonte"><select className="ds-input" value={filters.source} onChange={updateFilter('source')}><option value="">Todas as fontes</option>{['guru', 'tmb', 'asaas', 'boletex', 'hotmart', 'manual'].map((source) => <option key={source} value={source}>{source === 'manual' ? 'Venda manual' : source.toUpperCase()}</option>)}</select></Field><Field label="Situação"><select className="ds-input" value={filters.status} onChange={updateFilter('status')}><option value="">Todas</option><option value="pending">Pendentes</option><option value="reconciled">Conciliadas</option><option value="sync-pending">Sincronização pendente</option></select></Field><Field label="Identificação"><select className="ds-input" value={filters.identification} onChange={updateFilter('identification')}><option value="all">Todas</option><option value="utm">Automática por UTM</option><option value="manual">Atribuição manual</option><option value="unassigned">Sem vendedor</option></select></Field><Field label="Vendedor"><select className="ds-input" value={filters.seller} onChange={updateFilter('seller')}><option value="">Todos os vendedores</option>{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></Field><Field label="UTM Source"><select className="ds-input" value={filters.utmSource} onChange={updateFilter('utmSource')}><option value="">Todas as origens</option>{observedUtmSources.map(source => <option key={source} value={source}>{source}</option>)}</select></Field><div><Field label="Buscar venda"><div className="relative"><Search size={16} className="absolute left-3 top-3" style={{ color: 'var(--muted)' }} /><input className="ds-input" style={{ paddingLeft: 36 }} value={filters.search} onChange={updateFilter('search')} placeholder="Cliente, produto, vendedor, ID ou UTM" /></div></Field></div></section>
    <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Resumo de atribuições">{[
      ['A atribuir', records.filter((row) => !row.isAggregate && !row.sellerId).length, 'Vendas sem vendedor identificado'],
      ['Manuais a conciliar', manualRows.length, 'Aguardando vínculo com uma plataforma'],
      ['Receita manual líquida', money(manualRows.reduce((sum, row) => sum + row.net, 0)), 'Somente manuais ainda não vinculadas'],
      ['Sincronizações pendentes', records.filter((row) => row.syncPending).length, 'Registro salvo, operação ainda pendente'],
    ].map(([title, value, help]) => <article className="stat-card" key={title}><h2 className="text-sm" style={{ color: 'var(--muted)' }}>{title}</h2><strong className="text-3xl tracking-tight">{loading ? '…' : value}</strong><p className="text-xs" style={{ color: 'var(--muted)' }}>{help}</p></article>)}</section>
    {currentData?.sources.some((source) => source.kind === 'sale' && source.status !== 'ready') && <div className="notice">Dados parciais: {currentData.sources.filter((source) => source.kind === 'sale' && source.status !== 'ready').map((source) => source.label).join(', ')}. Atualize para tentar novamente.</div>}
    <section className="surface-panel overflow-hidden" aria-label="Vendas para atribuição"><div className="p-5 flex justify-between gap-3"><h2 className="font-semibold">Vendas do período</h2><span className="text-sm" style={{ color: 'var(--muted)' }}>{rows.length} registros</span></div><div className="relative overflow-x-auto"><table className="data-table w-full"><thead><tr><th>Cliente e produto</th><th>Origem e UTMs</th><th>Valor da venda / caixa</th><th>Vendedor</th><th>Conferência</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
      {visibleRows.map((row) => <tr key={`${row.id}:${row.isLinkedManual ? 'linked' : 'active'}`} style={{ opacity: row.isLinkedManual ? 0.7 : 1 }}><td><strong className="block text-sm">{row.buyerName || 'Cliente não informado'}</strong><span className="block text-xs mt-1" style={{ color: 'var(--muted)' }}>{row.product || 'Produto não informado'}</span><span className="block text-xs mt-1" style={{ color: 'var(--muted)' }}>{dateLabel(row.date)}{row.buyerEmail ? ` · ${row.buyerEmail}` : ''}</span></td><td><span className="text-sm">{row.isManual ? 'Manual' : row.platform}</span><span className="block text-xs max-w-44 truncate" title={row.externalId} style={{ color: 'var(--muted)' }}>{row.isManual ? row.platform : row.externalId || 'ID não informado pela fonte'}</span><UtmDetails utm={row.utm}/></td><td className="whitespace-nowrap"><span className="block text-sm">{money(row.gross)}</span><span className="block text-xs" style={{ color: 'var(--muted)' }}>{usesPlatformNet(row) ? 'Líquido após taxas' : 'Valor contratado'}</span>{!usesPlatformNet(row) && <span className="block text-xs" style={{ color: 'var(--muted)' }}>Líq. {money(row.net)}</span>}<span className="block text-xs" style={{ color: 'var(--muted)' }}>Caixa {money(row.received)}</span></td><td className="text-sm">{row.sellerName || <span style={{ color: 'var(--muted)' }}>Não atribuído</span>}{row.sellerId && <span className="attribution-method">{row.attributionMethod === 'utm' ? 'Automática por UTM' : 'Atribuição manual'}</span>}</td><td><span className="text-xs inline-flex items-center gap-1" style={{ color: row.status === 'reconciled' ? 'var(--success)' : 'var(--warning)' }}>{row.status === 'reconciled' && <Check size={12} />}{row.isLinkedManual ? 'Vinculada à plataforma' : row.status === 'reconciled' ? 'Conciliada' : 'Pendente'}</span>{row.isLinkedManual && <span className="block text-xs mt-1" style={{ color: 'var(--muted)' }}>Fora dos totais manuais</span>}{row.syncPending && <button className="block text-xs mt-2" style={{ color: 'var(--accent)' }} onClick={() => retry(row)} disabled={syncing === row.id}>{syncing === row.id ? 'Sincronizando…' : 'Tentar sincronização'}</button>}</td><td><div className="flex items-center justify-end gap-2">{row.isManual ? !row.isLinkedManual && <button className="button text-xs" onClick={() => setOperation({ mode: 'reconcile', row })} disabled={!candidates.length}><ArrowRightLeft size={14} />Conciliar</button> : <button className="button text-xs" disabled={!row.canAttribute || !sellers.length} onClick={() => setOperation({ mode: 'assign', row })}>{row.sellerId ? 'Revisar' : 'Atribuir'}</button>}{(row.isManual || row.attributionId) && <button className="button" aria-label={`Histórico da venda de ${row.buyerName || 'cliente'}`} onClick={() => setAudit(row)}><History size={15} /></button>}</div></td></tr>)}
      {!loading && !visibleRows.length && <tr><td colSpan={6}><div className="empty-state py-12"><h2>Nenhuma venda neste filtro</h2><p>Ajuste o período ou registre uma venda manual.</p></div></td></tr>}
      {loading && !visibleRows.length && <tr><td colSpan={6}><p className="p-8 text-center" role="status">Carregando vendas e atribuições…</p></td></tr>}
    </tbody></table></div><footer className="p-4 flex items-center justify-between gap-3"><span className="text-xs" style={{ color: 'var(--muted)' }}>Página {actualPage} de {pages}</span><div className="flex gap-2"><button className="button" disabled={actualPage === 1} onClick={() => setPage(actualPage - 1)}>Anterior</button><button className="button" disabled={actualPage === pages} onClick={() => setPage(actualPage + 1)}>Próxima</button></div></footer></section>
    {operation && <OperationForm {...operation} sellers={sellers} candidates={candidates} onClose={() => setOperation(null)} onSaved={afterSave} />}
    {audit && <AuditView row={audit} onClose={() => setAudit(null)} />}
  </div>
}
