/* eslint-disable react/prop-types -- Internal React 19 components with explicit props. */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Building2, Package, UserRound, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { requestApi } from '../lib/api'
import { PageSkeleton } from '../components/WorkspaceLayout'
import GoalMetricEditor from '../components/goals/GoalMetricEditor'
import { GOAL_METRICS, GOAL_SCOPES, GOAL_TIERS, goalPlanKey, goalScopeTargets, normalizeGoalPlan } from '../components/goals/goalConfig'
import '../components/goals/goalsConfig.css'

const HubGoals = lazy(() => import('./HubGoals'))
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SCOPE_ICONS = { overall: Building2, product: Package, team: Users, individual: UserRound }
const SELECT_LABELS = { product: 'Família de produtos', team: 'Time', individual: 'Indivíduo' }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('pt-BR')

export default function GoalsPage() {
  const { currentUser, userRoles, hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const admin = Boolean(userRoles?.isAdmin)
  const initialYear = Number(params.get('year')), initialMonth = Number(params.get('month'))
  const [year, setYear] = useState(Number.isInteger(initialYear) && initialYear >= 2000 && initialYear <= 2100 ? initialYear : new Date().getFullYear())
  const [month, setMonth] = useState(Number.isInteger(initialMonth) && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : new Date().getMonth() + 1)
  const [tab, setTab] = useState('plans'), [scope, setScope] = useState('overall')
  const [selection, setSelection] = useState({ product: 'MBA', team: '', individual: '' })
  const [metric, setMetric] = useState('operational'), [plans, setPlans] = useState([])
  const [options, setOptions] = useState({ teams: [], individuals: [] })
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [optionsLoading, setOptionsLoading] = useState(true), [optionsError, setOptionsError] = useState(''), [optionsRevision, setOptionsRevision] = useState(0)
  const period = `${year}/${month}`, periodRef = useRef(period)
  periodRef.current = period
  const selectProposalPeriod = useCallback((nextYear, nextMonth) => { setYear(nextYear); setMonth(nextMonth) }, [])
  const clearProposalLink = () => { if (params.has('proposta')) setParams(previous => { const next = new URLSearchParams(previous); next.delete('proposta'); return next }, { replace: true }) }

  useEffect(() => {
    if (tab !== 'plans') return
    const controller = new AbortController()
    setLoading(true); setPlans([]); setError('')
    requestApi(`/goal-plans/${year}/${month}`, { signal: controller.signal })
      .then(result => { if (!Array.isArray(result.plans)) throw new Error('A consulta não retornou as metas do período. Tente novamente.'); if (!controller.signal.aborted) setPlans(result.plans.map(normalizeGoalPlan)) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [year, month, revision, tab])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsLoading(true); setOptionsError('')
    requestApi('/goal-plans/options', { signal: controller.signal })
      .then(result => { if (!Array.isArray(result.teams) || !Array.isArray(result.individuals)) throw new Error('A consulta não retornou os cadastros disponíveis.'); if (!controller.signal.aborted) setOptions({ teams: result.teams, individuals: result.individuals }) })
      .catch(failure => { if (!controller.signal.aborted) setOptionsError(failure.message || 'Não foi possível consultar os times e indivíduos.') })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false) })
    return () => controller.abort()
  }, [optionsRevision])

  const targets = goalScopeTargets(scope, options, plans)
  const scopeId = scope === 'overall' ? '' : selection[scope]
  const target = targets.find(item => item.id === scopeId)
  const needsOptions = scope === 'team' || scope === 'individual'
  const editable = admin && target?.active && (!needsOptions || (!optionsLoading && !optionsError))
  const selectedPlan = indicator => plans.find(plan => plan.scope === scope && plan.scopeId === scopeId && plan.metric === indicator)
  const scopePlans = plans.filter(plan => plan.scope === scope)
  async function save(payload) {
    const savedPeriod = period
    const result = await requestApi(`/goal-plans/${savedPeriod}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!result.plan) throw new Error('O servidor não confirmou a gravação da meta. Tente novamente.')
    const saved = normalizeGoalPlan(result.plan)
    if (periodRef.current === savedPeriod) setPlans(previous => [...previous.filter(plan => goalPlanKey(plan) !== goalPlanKey(saved)), saved])
  }
  const editor = indicator => <GoalMetricEditor key={`${period}:${scope}:${scopeId}:${indicator}`} plan={selectedPlan(indicator)} scope={scope} scopeId={scopeId} scopeName={target.name} metric={indicator} editable={editable && (!target.excludedFromRanking || Boolean(selectedPlan(indicator)))} productPlans={plans.filter(plan => plan.scope === 'product')} periodLabel={`${MONTHS[month - 1]} de ${year}`} onSave={save} onReload={() => setRevision(value => value + 1)} />

  return <div className="hub-page goals-config-page">
    <header className="page-heading"><div><h1>Metas da operação</h1><p>Planeje o resultado geral, por produto, time e indivíduo.</p></div>{hasPermission('goal-pace') && <Link className="button button-primary" to={`/pace?year=${year}&month=${month}`}><ArrowUpRight size={17} />Acompanhar o ritmo</Link>}</header>
    <div className="tab-strip" role="tablist" aria-label="Grupo de metas">{[['plans', 'Planejamento mensal'], ['finance', 'Receita por pagamento'], ['legacy', 'Metas comerciais anteriores']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'legacy' ? <><p className="goal-plan-help">Configurações anteriores do módulo comercial. Elas mantêm seus próprios critérios e não alteram o planejamento mensal por escopo.</p><Suspense fallback={<PageSkeleton />}><HubGoals /></Suspense></> : <>
      <div className="filter-bar"><label>Mês<select value={month} onChange={event => { clearProposalLink(); setMonth(Number(event.target.value)) }}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>Ano<input type="number" min="2000" max="2100" value={year} onChange={event => { const next = Number(event.target.value); if (next >= 2000 && next <= 2100) { clearProposalLink(); setYear(next) } }} /></label></div>
      {tab === 'finance' ? <RevenueGoals year={year} month={month} admin={admin} /> : <>
        {admin && <GoalProposalsPanel key={currentUser?.uid} year={year} month={month} subject={currentUser?.uid} proposalId={params.get('proposta')} onSelectPeriod={selectProposalPeriod} onApplied={() => setRevision(value => value + 1)} />}
        <nav className="goal-scope-nav" aria-label="Escopo da meta">{GOAL_SCOPES.map(item => { const Icon = SCOPE_ICONS[item.id]; return <button key={item.id} type="button" aria-pressed={scope === item.id} aria-label={item.label} onClick={() => setScope(item.id)}><Icon size={20} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button> })}</nav>
        <p className="goal-plan-help">Informe a meta geral diretamente ou configure a divisão entre Marketing e Vendas. Metas de produtos, times e indivíduos têm acompanhamento independente; preencher com produtos não cria sincronização automática.</p>
        <section className="goal-scope-context" aria-label="Destino do planejamento"><div><h2>{target?.name || `Selecione um ${scope === 'individual' ? 'indivíduo' : 'time'}`}</h2><p>{MONTHS[month - 1]} de {year} · Valor das vendas e cash collected têm metas e acompanhamento próprios.</p></div>{scope !== 'overall' && <label className="goal-selection">{SELECT_LABELS[scope]}<select className="ds-input" aria-label={SELECT_LABELS[scope]} value={scopeId} disabled={needsOptions && (optionsLoading || Boolean(optionsError))} onChange={event => setSelection(previous => ({ ...previous, [scope]: event.target.value }))}>{needsOptions && <option value="">Selecione {scope === 'team' ? 'um time' : 'um indivíduo'}</option>}{targets.map(item => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{item.excludedFromRanking ? ' · Fora dos cálculos · histórico' : !item.active ? ' · Inativo' : ''}</option>)}</select></label>}</section>
        {target?.excludedFromRanking && <p className="notice">Esta pessoa está fora dos cálculos de desempenho. As metas existentes podem ser consultadas e ajustadas; novos indicadores ficam disponíveis após sua reinclusão pelo administrador.</p>}
        {needsOptions && optionsLoading && <p className="notice" role="status">Carregando times e indivíduos…</p>}
        {needsOptions && optionsError && <div className="notice notice-error" role="alert">Times e indivíduos indisponíveis: {optionsError}<button className="underline ml-3" onClick={() => setOptionsRevision(value => value + 1)}>Consultar cadastros novamente</button></div>}
        {error && <div className="notice notice-error" role="alert">{error}<button className="underline ml-3" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
        {loading ? <PageSkeleton /> : !error && <>
          {target ? <><div className="surface-panel goal-financial-grid">{editor('gross')}{editor('cash')}</div><details className="surface-panel goal-extras"><summary>Outros indicadores</summary><p>As metas de valor operacional, líquido e quantidade continuam disponíveis separadamente.</p><label className="goal-selection">Indicador adicional<select className="ds-input" aria-label="Indicador adicional" value={metric} onChange={event => setMetric(event.target.value)}>{['operational', 'net', 'count'].map(indicator => <option key={indicator} value={indicator}>{GOAL_METRICS[indicator].label}</option>)}</select></label>{editor(metric)}</details></> : !optionsLoading && !optionsError && <div className="surface-panel goal-scope-empty">{targets.some(item => item.active) ? `Selecione ${scope === 'team' ? 'um time' : 'um indivíduo'} para configurar suas metas.` : scope === 'individual' ? 'Ainda não há indivíduos ativos disponíveis. As pessoas aparecem após o primeiro acesso ao módulo comercial.' : 'Ainda não há times ativos disponíveis no módulo comercial.'}</div>}
          {scopePlans.length > 0 && <section className="surface-panel"><div className="goal-history-heading"><h2>Metas configuradas · {GOAL_SCOPES.find(item => item.id === scope).label}</h2><span>{scopePlans.length} {scopePlans.length === 1 ? 'indicador configurado' : 'indicadores configurados'}</span></div><div className="goal-history"><table><thead><tr><th>Destino / indicador</th><th>Meta base</th><th>Supermeta</th><th>Ultrameta</th><th>Ritmo</th></tr></thead><tbody>{scopePlans.map(plan => { const destination = targets.find(item => item.id === plan.scopeId); const format = value => (plan.metric === 'count' ? quantity : currency).format(value); return <tr key={goalPlanKey(plan)}><td>{destination?.name || plan.scopeName || plan.scopeId}<small>{GOAL_METRICS[plan.metric]?.label || plan.metric}{destination?.excludedFromRanking ? ' · Fora dos cálculos' : destination?.active === false ? ' · Cadastro inativo' : ''}</small></td><td>{format(plan.target)}</td><td>{format(plan.superTarget)}</td><td>{format(plan.ultraTarget)}</td><td>{plan.paceBasis === 'business' ? 'Dias úteis' : 'Dias corridos'}</td></tr> })}</tbody></table></div></section>}
        </>}
      </>}
    </>}
  </div>
}

const PROPOSAL_STATUS = { pending: 'Aguardando aprovação', approved: 'Aplicada', rejected: 'Recusada', expired: 'Expirada', stale: 'Meta alterada após a proposta', undone: 'Desfeita', superseded: 'Substituída' }
const proposalDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada'
const proposalField = path => {
  const parts = path.split('.')
  const tier = GOAL_TIERS.find(([key]) => key === parts.at(-1))?.[1] || path
  return parts[0] === 'breakdown' ? `${parts[1] === 'marketing' ? 'Marketing' : 'Vendas'} · ${tier}` : tier
}
function GoalProposalsPanel({ year, month, subject, proposalId, onSelectPeriod, onApplied }) {
  const [access, setAccess] = useState(null), [proposals, setProposals] = useState([]), [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null), [loading, setLoading] = useState(false), [loadError, setLoadError] = useState('')
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(''), [revision, setRevision] = useState(0)
  const [now, setNow] = useState(Date.now()), [undoId, setUndoId] = useState('')
  const saving = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; const timer = setInterval(() => setNow(Date.now()), 1000); return () => { mounted.current = false; clearInterval(timer) } }, [])
  useEffect(() => {
    const controller = new AbortController()
    requestApi('/mcp/status', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setAccess(result) })
      .catch(failure => { if (!controller.signal.aborted) { if (failure.status === 404) setAccess({ enabled: false }); else setLoadError(failure.message) } })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    if (!access?.enabled) return
    const controller = new AbortController()
    setLoading(true); setLoadError(''); setProposals([]); setHistory([]); setSelected(null)
    Promise.all([
      requestApi(`/mcp/proposals?year=${year}&month=${month}`, { signal: controller.signal }),
      requestApi(`/mcp/history?year=${year}&month=${month}`, { signal: controller.signal }),
      proposalId ? requestApi(`/mcp/proposals/${encodeURIComponent(proposalId)}`, { signal: controller.signal }) : Promise.resolve(null),
    ]).then(([pending, previous, linked]) => {
      if (controller.signal.aborted) return
      if (!Array.isArray(pending.proposals) || !Array.isArray(previous.history) || (linked && !linked.proposal)) throw new Error('Não foi possível validar as propostas. Atualize a lista.')
      setProposals(pending.proposals); setHistory(previous.history); setSelected(linked?.proposal || null)
      if (linked?.proposal && (linked.proposal.year !== year || linked.proposal.month !== month)) onSelectPeriod(linked.proposal.year, linked.proposal.month)
    }).catch(failure => { if (!controller.signal.aborted) setLoadError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [access?.enabled, year, month, proposalId, revision, onSelectPeriod])

  async function act(proposal, action, confirmation = {}) {
    if (saving.current) return
    saving.current = true; setBusy(proposal.id); setError(''); setMessage('')
    try {
      const result = await requestApi(`/mcp/proposals/${encodeURIComponent(proposal.id)}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'approve' ? { confirmation } : {}) })
      if (result.proposal?.id !== proposal.id || result.proposal.status !== { approve: 'approved', reject: 'rejected', undo: 'undone' }[action]) throw new Error('O servidor não confirmou a decisão. Atualize as propostas antes de tentar novamente.')
      if (mounted.current) {
        setMessage(action === 'approve' ? 'Alteração aplicada. As metas foram atualizadas.' : action === 'undo' ? 'Alteração desfeita. Os valores anteriores foram restaurados.' : 'Proposta recusada.')
        setUndoId(''); setRevision(value => value + 1)
        if (action !== 'reject') onApplied()
      }
    } catch (failure) {
      if (mounted.current) { setError(failure.message); if ([403, 409, 410].includes(failure.status)) setRevision(value => value + 1) }
    } finally { saving.current = false; if (mounted.current) setBusy('') }
  }
  if (!access?.enabled && !loadError) return null
  const pending = proposals.filter(item => item.status === 'pending' && item.id !== selected?.id)
  const previous = history.filter(item => item.id !== selected?.id)
  const card = item => <GoalProposalCard key={`${item.id}:${item.status}`} proposal={item} subject={subject} now={now} writesEnabled={access?.writesEnabled === true} busy={Boolean(busy) || loading} undoing={undoId === item.id} onUndo={() => setUndoId(item.id)} onCancelUndo={() => setUndoId('')} onAction={(action, confirmation) => act(item, action, confirmation)} />
  return <section className="surface-panel goal-proposals" aria-label="Propostas de metas do Claude" aria-busy={loading || Boolean(busy)}>
    <div className="goal-history-heading"><div><h2>Propostas do Claude</h2><p className="goal-plan-help">Confira os valores e o destino da alteração antes de aprovar. Abrir uma proposta não altera a meta.</p></div><button type="button" className="button" disabled={loading || Boolean(busy)} onClick={() => { setError(''); setRevision(value => value + 1) }}>Atualizar propostas</button></div>
    {access?.enabled && !access.writesEnabled && <p className="notice">As alterações pelo Claude estão pausadas. As propostas continuam disponíveis para consulta.</p>}
    {loadError && <p role="alert" className="notice notice-error">{loadError}</p>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {message && <p role="status" className="goal-editor-success">{message}</p>}
    {loading && <p role="status" className="goal-plan-help">Consultando propostas…</p>}
    {selected && card(selected)}{pending.map(card)}
    {!loading && !loadError && !selected && !pending.length && <p className="goal-plan-help">Nenhuma proposta pendente para este mês.</p>}
    {previous.length > 0 && <details className="goal-proposal-history"><summary>Histórico de alterações pelo Claude ({previous.length})</summary>{previous.map(card)}</details>}
  </section>
}

function GoalProposalCard({ proposal, subject, now, writesEnabled, busy, undoing, onUndo, onCancelUndo, onAction }) {
  const [confirmation, setConfirmation] = useState({})
  const before = proposal.before, after = proposal.after
  const expiresAt = Date.parse(proposal.expiresAt)
  const expired = proposal.status === 'pending' && (!Number.isFinite(expiresAt) || expiresAt <= now)
  const status = expired ? 'expired' : proposal.status
  const own = proposal.requestedBy === subject
  const required = Object.entries(proposal.requiredConfirmation || {})
  const confirmed = required.every(([field, expected]) => typeof confirmation[field] === 'string' && confirmation[field].trim() !== '' && Number(confirmation[field]) === expected)
  const format = value => Number.isFinite(value) ? (proposal.metric === 'count' ? quantity : currency).format(value) : '—'
  const label = GOAL_METRICS[proposal.metric]?.label || proposal.metric
  const target = after?.scopeName || before?.scopeName || (proposal.scope === 'overall' ? 'Geral' : proposal.scopeId)
  const scopeLabel = GOAL_SCOPES.find(item => item.id === proposal.scope)?.label || 'Destino'
  const rows = [...GOAL_TIERS.map(([field, name]) => ({ key: field, name, before: before?.[field], after: after?.[field] }))]
  for (const part of after?.breakdown || []) {
    const old = before?.breakdown?.find(item => item.key === part.key)
    for (const [field, name] of GOAL_TIERS) rows.push({ key: `${part.key}.${field}`, name: `${part.key === 'marketing' ? 'Marketing' : 'Vendas'} · ${name}`, before: old?.[field], after: part[field] })
  }
  const pending = status === 'pending' && own && writesEnabled
  return <article className="goal-proposal" aria-label={`Proposta: ${target} · ${label}`}>
    <header><div><h3>{scopeLabel}: {target} · {label}</h3><p>{MONTHS[proposal.month - 1]} de {proposal.year} · Solicitada em {proposalDate(proposal.createdAt)} · {proposal.clientName || 'Claude'}</p></div><strong className="goal-proposal-status">{PROPOSAL_STATUS[status] || 'Indisponível'}</strong></header>
    <div className="goal-history"><table><caption className="sr-only">Valores antes e depois da proposta</caption><thead><tr><th>Faixa</th><th>Antes</th><th>Proposto</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><td>{row.name}</td><td>{format(row.before)}</td><td>{format(row.after)}</td></tr>)}</tbody></table></div>
    <p className="goal-plan-help">Ritmo: {before?.paceBasis === 'business' ? 'dias úteis' : 'dias corridos'} → {after?.paceBasis === 'business' ? 'dias úteis' : 'dias corridos'}. {status === 'pending' && `Válida até ${proposalDate(proposal.expiresAt)}.`}</p>
    {Array.isArray(proposal.affects) && proposal.affects.length > 0 && <p className="goal-plan-help">Onde aparece: {proposal.affects.join(' · ')}.</p>}
    {!own && <p className="goal-plan-help">Somente quem solicitou esta proposta pode aprovar, recusar ou desfazer a alteração.</p>}
    {pending && <form onSubmit={event => { event.preventDefault(); if (!busy && confirmed) onAction('approve', Object.fromEntries(required.map(([field]) => [field, Number(confirmation[field])])) ) }}>
      {required.length > 0 && <fieldset disabled={busy} className="goal-proposal-confirmation"><legend>Confirme os valores da alteração</legend><p className="goal-plan-help">A variação exige uma conferência adicional. Digite os valores propostos abaixo.</p>{required.map(([field, expected]) => <label className="goal-field" key={field}>{proposalField(field)}: {format(expected)}<input className="ds-input" type="number" inputMode={proposal.metric === 'count' ? 'numeric' : 'decimal'} min="0" step={proposal.metric === 'count' ? '1' : '.01'} required value={confirmation[field] ?? ''} onChange={event => setConfirmation(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}</fieldset>}
      <div className="goal-proposal-actions"><button type="submit" className="button button-primary" disabled={busy || !confirmed}>Aprovar alteração</button><button type="button" className="button" disabled={busy} onClick={() => onAction('reject')}>Recusar proposta</button></div>
    </form>}
    {status === 'approved' && own && writesEnabled && (undoing ? <div className="goal-proposal-confirmation"><h4>Restaurar valores anteriores</h4><p className="goal-plan-help">Serão restaurados os valores da coluna “Antes”. A operação será recusada se a meta tiver sido alterada desde a aprovação.</p><div className="goal-proposal-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => onAction('undo')}>Confirmar restauração</button><button type="button" className="button" disabled={busy} onClick={onCancelUndo}>Cancelar</button></div></div> : <button type="button" className="button" disabled={busy} onClick={onUndo}>Desfazer alteração</button>)}
  </article>
}

function RevenueGoals({year,month,admin}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let active=true;setData(null);setError('');requestApi(`/goals/revenue/month/${year}/${month}`).then(result=>{if(active)setData(result.data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[year,month])
 const save=async()=>{setSaving(true);setError('');try{await requestApi(`/goals/revenue/month/${year}/${month}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});setMessage('Metas financeiras salvas.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <section className="surface-panel space-y-5"><h2 className="text-lg">Receita por meio de pagamento</h2><p className="text-sm text-muted-foreground">Metas financeiras existentes, preservadas no banco do Dashboard.</p>{error&&<p role="alert" className="notice notice-error">{error}</p>}{message&&<p role="status">{message}</p>}{!data&&!error?<PageSkeleton/>:data&&<><fieldset disabled={!admin||saving} className="space-y-5">{[['faturamentoCartao','Faturamento no cartão'],['faturamentoBoleto','Faturamento no boleto'],['investimentoTrafego','Orçamento de aquisição']].map(([key,label])=><div key={key}><h3 className="text-sm mb-2">{label}</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{['base','super','ultra'].map(level=><label key={level} className="ds-label">{level==='base'?'Meta base':level==='super'?'Supermeta':'Ultrameta'} (R$)<input className="ds-input mt-2" type="number" min="0" step=".01" value={data[key]?.[level]??0} onChange={e=>setData({...data,[key]:{...data[key],[level]:Number(e.target.value)}})}/></label>)}</div></div>)}</fieldset>{admin&&<button className="button button-primary" disabled={saving} onClick={save}>{saving?'Salvando…':'Salvar metas financeiras'}</button>}</>}</section>
}
